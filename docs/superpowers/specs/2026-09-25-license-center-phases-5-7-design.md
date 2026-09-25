# Central de Licenças — Fases 5 a 7

Data: 2026-09-25
Status: design aprovado, incluindo governança de paridade futura; pronto para plano de implementação
Branches: `feat/license-center-phases-5-7` em `OBRANAMAOCOMERCIAL` e `MercadoLivre`

## 1. Objetivo

Levar a nova Central de Licenças, hoje disponível no painel geral do `MercadoLivre` em modo somente leitura, até as fases 5, 6 e 7 do roadmap original:

- **Fase 5:** habilitar escrita administrativa real.
- **Fase 6:** comprovar paridade entre a Central antiga e a nova por testes transacionais e E2E.
- **Fase 7:** operar a nova Central em paralelo com a Central antiga, mantendo a antiga disponível como fallback.

Princípio obrigatório: **duplicar/substituir a interface administrativa, não duplicar o sistema de licenciamento**.

## 2. Restrições obrigatórias

1. Nenhum cliente, licença, usuário, dispositivo ou loja preexistente pode ser alterado por testes automatizados.
2. O E2E live pode escrever em produção somente em registros sintéticos criados pelo próprio run.
3. `OBRANAMAOCOMERCIAL` continua sendo a autoridade de licenciamento para Obra na Mão e Débora Lactação e o orquestrador da Loja Online.
4. `MercadoLivre` não terá acesso direto aos D1 de licenciamento.
5. A Loja Online continuará sendo administrada por sua API interna própria, acessada pelo Obra por Service Binding.
6. Não haverá novo D1, migração de dados, cópia de clientes ou cópia de licenças.
7. `artisys.dev/sistema#owner` permanece disponível durante toda a fase 7.
8. A fase 8 está fora do escopo.
9. A reorganização futura de URLs sob `artisys.dev` está fora do escopo.
10. Não será criado DELETE físico apenas para facilitar QA.

## 3. Estado atual

As fases 1 a 4 já entregaram:

- `GET /api/internal/license-center/snapshot` no `obra-na-mao-comercial`;
- leitura server-to-server via `OBRA_LICENSING`;
- página `/licenses` no `artisys-mercadolivre`;
- visualização de Obra, Débora, Loja Online e auditoria;
- segredo dedicado de leitura;
- Central antiga intacta.

As regras de escrita já existem e devem ser reutilizadas:

### Obra na Mão

- criar empresa/licença;
- alterar módulos, canais, plano, validade e limites;
- suspender/reativar licença;
- revogar/reativar dispositivo sem alterar a licença da empresa.

### Débora Lactação

- `grant`;
- `status`;
- `revoke`;
- renovação de 6 meses reaplicando `grant`, preservando a regra existente de extensão a partir da validade atual quando ainda ativa.

### Loja Online

- criar empresa + administrador + licença;
- editar plano/status/validade/limite de usuários;
- estender validade;
- bloquear/desbloquear;
- consultar auditoria.

## 4. Arquitetura

```text
Browser
  ↓
artisys-mercadolivre
  ↓ Service Binding OBRA_LICENSING
obra-na-mao-comercial
  ├─ serviços atuais do Obra
  ├─ serviços atuais da Débora
  └─ Service Binding LOJAONLINE_LICENSING
       ↓
     artisys-lojaonline
```

A Central antiga e a nova devem convergir para as mesmas funções de domínio. Quando uma regra estiver acoplada à rota HTTP antiga, ela será extraída para função/serviço compartilhado antes de ser usada pela nova superfície interna.

É proibido:

- copiar `createLicense`, `mutateLicense` ou regras equivalentes para `MercadoLivre`;
- acessar D1 de licenciamento diretamente a partir de `MercadoLivre`;
- criar proxy genérico para `/api/owner/*`;
- criar endpoint que encaminhe um path arbitrário recebido do browser.

## 5. Contrato interno de escrita no Obra

O `obra-na-mao-comercial` ganhará somente operações allowlisted.

### Snapshot existente

- `GET /api/internal/license-center/snapshot`

### Obra

- `POST /api/internal/license-center/obra/companies`
- `PUT /api/internal/license-center/obra/companies/:id`
- `PUT /api/internal/license-center/obra/devices/:id`

Essas rotas reutilizam a lógica de `POST /api/owner/companies`, `PUT /api/owner/companies/:id` e `PUT /api/owner/devices/:id`.

### Débora

- `POST /api/internal/license-center/debora/license`

Payload:

```json
{
  "action": "grant | status | revoke",
  "email": "..."
}
```

A rota reutiliza as mesmas funções de domínio da Central antiga.

### Loja Online

- `POST /api/internal/license-center/loja-online/companies`
- `PUT /api/internal/license-center/loja-online/companies/:id/license`
- `POST /api/internal/license-center/loja-online/companies/:id/extend`
- `POST /api/internal/license-center/loja-online/companies/:id/block`
- `POST /api/internal/license-center/loja-online/companies/:id/unblock`

Essas rotas reutilizam `lojaOnlineRequest` e a API interna existente no `artisys-lojaonline`.

## 6. Segredos e feature flag

### Obra

- `LICENSE_CENTER_READ_SECRET` — existente.
- `LICENSE_CENTER_WRITE_SECRET` — novo.
- `LICENSE_CENTER_WRITE_ENABLED` — novo.

### MercadoLivre

- `OBRA_LICENSE_CENTER_READ_SECRET` — existente.
- `OBRA_LICENSE_CENTER_WRITE_SECRET` — novo.

Regras:

1. snapshot aceita somente credencial de leitura;
2. mutações aceitam somente credencial de escrita;
3. leitura não autoriza escrita;
4. o segredo de escrita nunca chega ao browser;
5. com `LICENSE_CENTER_WRITE_ENABLED=false`, toda mutação interna retorna erro de escrita desabilitada;
6. a sessão administrativa existente do MercadoLivre continua sendo a autenticação do operador humano.

## 7. API do painel geral

A superfície do `MercadoLivre` fica restrita à sessão admin existente:

- `GET /api/license-center`
- `POST /api/license-center/obra/companies`
- `PUT /api/license-center/obra/companies/:id`
- `PUT /api/license-center/obra/devices/:id`
- `POST /api/license-center/debora/license`
- `POST /api/license-center/loja-online/companies`
- `PUT /api/license-center/loja-online/companies/:id/license`
- `POST /api/license-center/loja-online/companies/:id/extend`
- `POST /api/license-center/loja-online/companies/:id/block`
- `POST /api/license-center/loja-online/companies/:id/unblock`

O Worker valida sessão e formato de entrada, adiciona o segredo server-to-server e encaminha somente a operação allowlisted ao `OBRA_LICENSING`.

Depois de qualquer mutação bem-sucedida, a UI deve refazer `GET /api/license-center`. O estado final exibido nunca será assumido apenas a partir da resposta do POST/PUT.

## 8. Interface da Central nova

### Obra na Mão

A UI deve permitir criar empresa/licença, editar plano/validade/módulos/canais/limites, suspender, reativar e administrar dispositivos individualmente.

### Débora Lactação

A UI deve permitir consultar, liberar Pro, renovar por +6 meses via `grant`, revogar e reativar via `grant`.

### Loja Online

A UI deve permitir criar tenant, editar plano/validade/maxUsers, estender por 1/3/6/12 meses, bloquear e desbloquear.

A auditoria permanece visível e deve refletir as operações efetuadas.

## 9. Identidade e isolamento do E2E live

Cada execução recebe `qaRunId` único, por exemplo:

```text
20260925-173445-a8f3
```

Convenções obrigatórias:

```text
Empresa Obra: ARTISYS QA E2E <qaRunId>
Empresa Loja:  ARTISYS QA E2E LOJA <qaRunId>
E-mail:        qa-license-<qaRunId>@example.test
```

As chamadas de QA carregam:

```text
X-Artisys-QA-Run: <qaRunId>
```

### Guarda server-side

Quando esse header existir, o backend deve validar o alvo a partir de dados **já persistidos**, e nunca apenas a partir do payload recebido.

- Obra/empresa: o registro persistido deve ter nome com prefixo `ARTISYS QA E2E`, e o nome + e-mail persistidos devem conter o mesmo `qaRunId`.
- Débora: o e-mail persistido/consultado deve ser exatamente o e-mail QA derivado daquele `qaRunId`.
- Loja Online: nome da empresa e e-mail do administrador retornados pela autoridade da Loja devem conter o mesmo `qaRunId`.
- Dispositivo: o dispositivo deve pertencer a uma empresa que passe a guarda QA do mesmo run; nunca basta o ID do dispositivo enviado pelo teste.

Falha em qualquer condição:

```text
403 qa_scope_violation
```

Essa guarda não exige tabela nova. Ela usa identidade canônica persistida na própria autoridade de cada produto.

## 10. Baseline no test runner

Antes do primeiro write, o E2E live captura um baseline dos IDs preexistentes e dos campos administrativos necessários para comparação.

O runner mantém:

- `baselineIds`: IDs existentes antes do run;
- `createdIds`: IDs retornados por criações feitas pelo próprio run.

Uma mutação automatizada só pode ser emitida quando:

```text
targetId ∈ createdIds
targetId ∉ baselineIds
```

Essa é uma segunda barreira, independente da guarda server-side.

O relatório final deve registrar `existingIdsTouched = 0`.

Se um registro preexistente mudar durante a janela do teste por atividade legítima, o teste reporta a diferença e não tenta restaurá-lo automaticamente.

## 11. Verificação independente da autoridade

O E2E live terá duas leituras distintas após cada write:

1. leitura pela nova Central, usando a sessão administrativa do `artisys-mercadolivre`;
2. leitura direta da autoridade do `obra-na-mao-comercial` pelo próprio runner, usando `LICENSE_CENTER_READ_SECRET` em variável de ambiente e o endpoint interno de snapshot.

O segredo de leitura da autoridade fica apenas no processo do runner e nunca é injetado no browser.

Para Loja Online, a leitura independente continua sendo obtida pelo snapshot do Obra, que por sua vez consulta a autoridade da Loja via Service Binding. Não se criará acesso direto do runner ao D1 da Loja.

## 12. Matriz E2E — Obra

1. capturar baseline;
2. criar empresa/licença QA pela nova Central;
3. capturar IDs retornados e adicioná-los a `createdIds`;
4. reler pela nova Central;
5. reler diretamente no snapshot da autoridade do Obra;
6. comparar IDs, e-mail, status e limites;
7. alterar limites e confirmar nas duas leituras;
8. alterar módulos/canais e confirmar;
9. alterar validade e confirmar;
10. suspender e confirmar `suspended/revoked`;
11. reativar e confirmar `active`;
12. confirmar auditoria;
13. se existir dispositivo criado pelo próprio fluxo QA, revogar/reativar apenas esse dispositivo e confirmar que a licença da empresa não mudou;
14. finalizar com a licença QA inativa/revogada.

Se não houver maneira segura de criar um dispositivo QA no próprio run, o fluxo de dispositivo é certificado apenas pelo E2E isolado, nunca por um dispositivo real preexistente.

## 13. Matriz E2E — Débora

1. confirmar que o e-mail QA ainda não tem licença ativa;
2. `grant`;
3. confirmar `active` pela nova Central e pela autoridade;
4. aplicar novo `grant`;
5. confirmar renovação de +6 meses conforme a regra existente;
6. `revoke` e confirmar `revoked`;
7. `grant` novamente e confirmar `active`;
8. confirmar auditoria;
9. finalizar com `revoke`.

## 14. Matriz E2E — Loja Online

1. criar empresa/admin/licença QA;
2. capturar IDs e adicioná-los a `createdIds`;
3. confirmar `ACTIVE`;
4. editar plano e `maxUsers` e confirmar;
5. estender validade e confirmar;
6. bloquear e confirmar `BLOCKED`;
7. desbloquear e confirmar `ACTIVE`;
8. confirmar auditoria;
9. finalizar com o registro QA bloqueado.

## 15. E2E isolado e CI

Antes do live, Playwright e testes de contrato devem comprovar sem escrever em produção:

- autenticação administrativa;
- renderização da Central;
- emissão das operações corretas;
- re-fetch após mutação;
- mensagens de erro;
- confirmações destrutivas;
- rejeição de método/rota não allowlisted;
- separação entre segredo de leitura e escrita;
- feature flag desligada;
- `qa_scope_violation` para alvo não-QA;
- desktop, tablet e mobile quando aplicável.

O harness transacional já existente do Obra deve ser reutilizado/estendido onde fizer sentido.

## 16. Critério de paridade da fase 6

2xx não é suficiente. Cada operação segue:

```text
WRITE
  ↓
READ nova Central
  ↓
READ autoridade real
  ↓
AUDIT
  ↓
comparação
```

O relatório mínimo:

```text
Obra create .............. PASS/FAIL
Obra update limits ....... PASS/FAIL
Obra modules/channels .... PASS/FAIL
Obra expiry .............. PASS/FAIL
Obra suspend ............. PASS/FAIL
Obra reactivate .......... PASS/FAIL
Debora grant ............. PASS/FAIL
Debora renew ............. PASS/FAIL
Debora revoke ............ PASS/FAIL
Debora reactivate ........ PASS/FAIL
Loja create .............. PASS/FAIL
Loja update .............. PASS/FAIL
Loja extend .............. PASS/FAIL
Loja block ............... PASS/FAIL
Loja unblock ............. PASS/FAIL
Audit .................... PASS/FAIL
Existing IDs touched ..... 0
QA records active ........ 0
```

## 17. Limpeza lógica do QA

Não haverá DELETE físico nesta entrega.

Ao final:

- Obra QA → `suspended/revoked`;
- Débora QA → `revoked`;
- Loja Online QA → `BLOCKED`.

Os eventos permanecem para auditoria. Um purge físico futuro, se desejado, será entrega separada e aceitará exclusivamente registros QA explicitamente identificados.

## 18. Rollback

### Nível 1 — cortar escrita

`LICENSE_CENTER_WRITE_ENABLED=false` faz a nova Central voltar a um estado efetivamente read-only sem afetar a Central antiga.

### Nível 2 — MercadoLivre

Rollback do `artisys-mercadolivre` remove a superfície nova. A Central antiga segue disponível.

### Nível 3 — Obra

Rollback do `obra-na-mao-comercial` remove os endpoints internos novos. Como não há migração de schema, não existe migração reversa de banco.

Rollback automatizado nunca pode alterar/apagar IDs de `baselineIds`; somente pode inativar registros pertencentes ao run atual.

## 19. Ordem de implantação

1. extrair/reutilizar operações de domínio no Obra sem alterar a semântica das rotas antigas;
2. adicionar superfície interna de escrita + testes de contrato e segurança;
3. adicionar proxy allowlisted + UI de escrita no MercadoLivre;
4. adicionar governança de paridade futura e seus gates de CI/runtime;
5. adicionar E2E isolado;
6. executar CI relevante;
7. deploy do Obra com escrita controlada por feature flag;
8. deploy do MercadoLivre;
9. configurar o mesmo valor em `LICENSE_CENTER_WRITE_SECRET` e `OBRA_LICENSE_CENTER_WRITE_SECRET`;
10. executar gate live de paridade de capacidades;
11. executar E2E live com registros QA exclusivos;
12. validar paridade, auditoria, `existingIdsTouched = 0` e `QA records active = 0`;
13. manter escrita habilitada para operação paralela somente após todos os gates passarem;
14. manter a Central antiga ativa.

## 20. Critérios de conclusão

### Fase 5

Nova Central consegue, pelas autoridades existentes:

- Obra: criar, editar, validade, suspender, reativar, módulos, canais, limites e dispositivo somente quando houver alvo QA seguro;
- Débora: liberar, consultar, renovar, revogar e reativar;
- Loja Online: criar, editar, estender, bloquear e desbloquear.

### Fase 6

- CI relevante passa;
- E2E isolado passa;
- E2E live passa;
- writes são confirmados por duas leituras independentes;
- auditoria corresponde às ações;
- `existingIdsTouched = 0`;
- todos os registros QA terminam inativos;
- gate de paridade administrativa não possui capacidade obrigatória ausente no Painel Geral.

### Fase 7

- nova Central permanece com escrita habilitada para operação real;
- Central antiga continua íntegra e disponível;
- rollback por feature flag permanece funcional;
- nenhuma rota/autenticação/API antiga necessária é removida;
- nenhuma capacidade administrativa obrigatória pode ficar silenciosamente disponível apenas na Central antiga.

## 21. Governança de paridade futura do painel administrativo

A paridade futura é um requisito de arquitetura, não uma convenção humana. O objetivo é impedir que uma funcionalidade administrativa nova seja adicionada à autoridade/Central antiga e fique silenciosamente ausente do Painel Geral.

### 21.1 Registro canônico de capacidades

O `OBRANAMAOCOMERCIAL` manterá um registro canônico versionado:

```text
apps/web/qa/admin-parity-capabilities.json
```

Cada capacidade administrativa deve declarar, no mínimo:

```json
{
  "id": "obra.company.update-license",
  "authorityRoutes": ["PUT /api/owner/companies/:id"],
  "legacySurface": "Central Artisys / Cliente / Licença",
  "generalPanelRequired": true,
  "generalPanelCapability": "obra.company.update-license",
  "e2e": ["qa-license-center-isolated", "qa-license-center-live"],
  "status": "active"
}
```

Se uma capacidade for deliberadamente exclusiva da Central antiga ou infraestrutura interna, isso deve ser explícito:

```json
{
  "generalPanelRequired": false,
  "reason": "internal-only"
}
```

`generalPanelRequired:false` sem `reason` é inválido.

### 21.2 Scanner automático das rotas administrativas

O CI do Obra terá um verificador que percorre recursivamente `apps/web/backend/**/*.ts`, extrai declarações de rota com `/api/owner/` e exige que toda rota administrativa encontrada esteja:

1. associada a uma capacidade no registro; ou
2. explicitamente classificada como não destinada ao Painel Geral, com justificativa.

Adicionar uma nova rota `/api/owner/*` sem classificação faz o CI falhar.

O verificador também cruza o registro com `apps/web/qa/ui-capability-matrix.json` e `apps/web/qa/business-capabilities.json`, reutilizando a governança já existente em vez de criar uma matriz paralela desconectada.

### 21.3 Contrato de capacidades exposto pela autoridade

O snapshot interno do Obra passará a expor metadados de paridade, sem segredos:

```json
{
  "adminParity": {
    "contractVersion": 1,
    "requiredCapabilities": [
      "obra.company.create",
      "obra.company.update-license",
      "debora.license.manage",
      "loja-online.license.manage"
    ]
  }
}
```

`contractVersion` deve ser incrementado quando o conjunto ou semântica de capacidades administrativas obrigatórias mudar.

### 21.4 Capacidades suportadas pelo Painel Geral

O `MercadoLivre` manterá uma lista explícita, exportada pelo código, das capacidades que a nova interface realmente implementa. Exemplo conceitual:

```js
export const SUPPORTED_LICENSE_CENTER_CAPABILITIES = new Set([
  "obra.company.create",
  "obra.company.update-license",
  "debora.license.manage",
  "loja-online.license.manage"
]);
```

O endpoint `/api/license-center` compara a lista da autoridade com a lista suportada localmente e devolve:

```json
{
  "parity": {
    "status": "ok | incomplete",
    "missing": []
  }
}
```

Uma capacidade obrigatória ausente nunca pode ficar invisível: a página `/licenses` deve mostrar um alerta administrativo de paridade incompleta com os IDs faltantes.

### 21.5 Gate cross-repo antes da fase 7 e em releases futuras

O `MercadoLivre` terá um script de verificação live que consulta o snapshot publicado do Obra com a credencial de leitura, compara `requiredCapabilities` com `SUPPORTED_LICENSE_CENTER_CAPABILITIES` e falha com saída explícita quando houver divergência.

Exemplo esperado:

```text
ADMIN_PARITY_FAILURE
missing: obra.company.change-admin-email
```

Esse gate é obrigatório antes de habilitar escrita na fase 7 e deve permanecer disponível para releases futuras.

### 21.6 Regra para mudanças futuras

Uma nova funcionalidade administrativa segue obrigatoriamente esta sequência:

```text
nova rota/regra administrativa
        ↓
capacidade registrada/classificada
        ↓
Painel Geral implementa ou exclusão é justificada
        ↓
teste/E2E associado
        ↓
gate de paridade passa
        ↓
release
```

Portanto a regra deixa de ser “lembrar de atualizar o painel novo” e passa a ser “o repositório não aceita silenciosamente uma capacidade administrativa não classificada, e a operação/release detecta quando uma capacidade obrigatória ainda não existe no Painel Geral”.

## 22. Fora do escopo

- fase 8;
- remover/redirecionar a Central antiga;
- mover a nova Central para um path do `artisys.dev`;
- inventariar/migrar URLs do ecossistema;
- novo D1 ou migração de schema motivada apenas por esta entrega;
- purge físico de QA;
- reescrever a autoridade da Loja Online;
- criar novo sistema de login administrativo.

## 23. Resultado esperado

```text
Central nova     → leitura + escrita real → uso principal na fase 7
Central antiga   → leitura + escrita real → fallback preservado
```

As regras continuam centralizadas nas autoridades existentes. O `MercadoLivre` permanece uma interface/orquestrador administrativo, não uma nova autoridade de licenças.

Além da paridade funcional inicial, futuras capacidades administrativas não podem ficar silenciosamente fora do Painel Geral: o registro canônico, o scanner de rotas, o handshake de capacidades e o gate live tornam qualquer divergência explícita e testável.
