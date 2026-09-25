# Central de Licenças — Fases 5 a 7

Data: 2026-09-25
Status: design aprovado; aguardando revisão do documento antes do plano de implementação
Branches de trabalho: `feat/license-center-phases-5-7` em `OBRANAMAOCOMERCIAL` e `MercadoLivre`

## 1. Objetivo

Levar a nova Central de Licenças, hoje disponível no painel geral do repositório `MercadoLivre` em modo somente leitura, até as fases 5, 6 e 7 do roadmap original:

- Fase 5: habilitar as ações administrativas reais de escrita.
- Fase 6: comprovar paridade entre a Central antiga e a nova por testes transacionais e E2E.
- Fase 7: operar a nova Central em paralelo com a Central antiga, mantendo a antiga disponível como fallback.

A regra central permanece a mesma das fases 1 a 4: **duplicar/substituir a interface administrativa, não duplicar o sistema de licenciamento**.

## 2. Restrições obrigatórias

1. Nenhum cliente, licença, usuário, dispositivo ou loja preexistente pode ser alterado por testes automatizados.
2. O E2E live pode escrever em produção somente em registros sintéticos criados pelo próprio run.
3. `OBRANAMAOCOMERCIAL` continua sendo a autoridade central de licenciamento para Obra na Mão e Débora Lactação e o orquestrador da Loja Online.
4. `MercadoLivre` não terá acesso direto aos D1 de licenciamento.
5. A Loja Online continuará sendo administrada por sua API interna própria, acessada pelo Obra por Service Binding.
6. Não haverá migração de dados, novo D1, cópia de clientes ou cópia de licenças.
7. A Central antiga `artisys.dev/sistema#owner` permanece disponível durante toda a fase 7.
8. A fase 8, incluindo remoção ou redirecionamento da Central antiga, está fora do escopo.
9. A futura reorganização de URLs sob `artisys.dev` também está fora do escopo desta entrega.

## 3. Estado atual

As fases 1 a 4 já estão concluídas:

- existe endpoint interno GET-only em `obra-na-mao-comercial` para gerar o snapshot da Central;
- o `artisys-mercadolivre` consulta esse snapshot por `OBRA_LICENSING`;
- a nova página `/licenses` exibe Obra na Mão, Débora Lactação, Loja Online e auditoria;
- a leitura usa segredo dedicado e não expõe credenciais ao navegador;
- a Central antiga e seus fluxos de escrita continuam intactos.

Os fluxos administrativos existentes que devem ser reutilizados já incluem:

### Obra na Mão

- criação de empresa/licença;
- alteração de módulos;
- alteração de canais;
- alteração de plano;
- alteração de validade;
- alteração de limites de usuários, projetos e dispositivos;
- suspensão/reativação por mutação do status da licença;
- revogação/reativação de dispositivo sem alterar a licença da empresa.

### Débora Lactação

- `grant`;
- `status`;
- `revoke`;
- renovação de 6 meses por reaplicação de `grant`, preservando a regra já existente de estender a partir da validade atual quando ela ainda estiver ativa.

### Loja Online

- criação de empresa + administrador + licença;
- edição de plano/status/validade/limite de usuários;
- extensão de validade;
- bloqueio;
- desbloqueio;
- auditoria.

## 4. Arquitetura aprovada

A nova Central não implementará lógica de licenciamento própria.

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

A Central antiga e a nova devem chegar às mesmas funções de domínio. Quando a lógica hoje estiver acoplada à rota HTTP antiga, ela será extraída para um serviço compartilhado antes de ser reutilizada pela nova superfície interna.

Não será criado proxy genérico para `/api/owner/*`, nem endpoint capaz de encaminhar caminhos arbitrários.

## 5. Superfície interna de escrita

O Worker `obra-na-mao-comercial` ganhará uma superfície server-to-server explícita para a nova Central. Os nomes abaixo são o contrato proposto e podem ser agrupados em um único módulo interno, desde que permaneçam allowlisted e tipados.

### Snapshot

- `GET /api/internal/license-center/snapshot` — já existente.

### Obra na Mão

- `POST /api/internal/license-center/obra/companies`
- `PUT /api/internal/license-center/obra/companies/:id`
- `PUT /api/internal/license-center/obra/devices/:id`

A criação e atualização devem chamar a mesma lógica usada por `POST /api/owner/companies` e `PUT /api/owner/companies/:id`. A atualização de dispositivo deve preservar a semântica atual de `PUT /api/owner/devices/:id`.

### Débora Lactação

- `POST /api/internal/license-center/debora/license`

Payload:

```json
{
  "action": "grant | status | revoke",
  "email": "..."
}
```

A rota deve chamar as mesmas funções de `grant/status/revoke` usadas pela Central antiga.

### Loja Online

- `POST /api/internal/license-center/loja-online/companies`
- `PUT /api/internal/license-center/loja-online/companies/:id/license`
- `POST /api/internal/license-center/loja-online/companies/:id/extend`
- `POST /api/internal/license-center/loja-online/companies/:id/block`
- `POST /api/internal/license-center/loja-online/companies/:id/unblock`

Essas rotas não devem reproduzir regras da Loja Online; devem reutilizar `lojaOnlineRequest` e a API interna já existente no Worker `artisys-lojaonline`.

## 6. Autenticação e autorização server-to-server

Leitura e escrita terão credenciais independentes.

### Obra

- `LICENSE_CENTER_READ_SECRET` — já existente.
- `LICENSE_CENTER_WRITE_SECRET` — novo.
- `LICENSE_CENTER_WRITE_ENABLED` — novo feature flag de emergência.

### MercadoLivre

- `OBRA_LICENSE_CENTER_READ_SECRET` — já existente.
- `OBRA_LICENSE_CENTER_WRITE_SECRET` — novo.

Regras:

1. endpoints GET de snapshot continuam aceitando apenas o segredo de leitura;
2. endpoints mutáveis aceitam apenas o segredo de escrita;
3. segredo de leitura nunca autoriza escrita;
4. segredo de escrita nunca é enviado ao navegador;
5. quando `LICENSE_CENTER_WRITE_ENABLED` não estiver habilitado, toda operação de escrita interna retorna erro de escrita desabilitada;
6. a autenticação administrativa do browser continua sendo a sessão existente do painel `MercadoLivre`.

## 7. API do painel geral

O `MercadoLivre` continuará protegendo `/licenses` e suas APIs com o cookie administrativo existente.

A API pública do painel será restrita à sessão de admin e poderá ser organizada como:

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

O Worker `artisys-mercadolivre` apenas valida sessão, valida formato de entrada, adiciona a credencial server-to-server e encaminha a ação allowlisted ao `OBRA_LICENSING`.

Depois de qualquer mutação bem-sucedida, a interface deve refazer `GET /api/license-center` antes de considerar o estado final atualizado.

## 8. Interface da Central nova

### Obra na Mão

A UI deve permitir:

- criar empresa/licença;
- editar plano;
- editar validade;
- editar módulos;
- editar canais;
- editar `maxUsers`;
- editar `maxProjects`;
- editar `maxDevices`;
- suspender;
- reativar;
- revogar e reativar dispositivos individualmente.

### Débora Lactação

A UI deve permitir:

- consultar licença por e-mail;
- liberar Pro;
- renovar por mais 6 meses usando a mesma ação `grant` já existente;
- revogar;
- reativar por `grant`.

### Loja Online

A UI deve permitir:

- criar empresa/tenant;
- editar plano;
- editar validade;
- editar limite de usuários;
- estender por 1, 3, 6 ou 12 meses;
- bloquear;
- desbloquear.

A auditoria deve continuar visível após as mutações.

## 9. Proteção de E2E live

O E2E live usará produção apenas para registros que ele próprio criar.

Cada execução terá `qaRunId` único, por exemplo:

```text
20260925-173445-a8f3
```

Convenções obrigatórias:

```text
Empresa Obra: ARTISYS QA E2E <qaRunId>
Empresa Loja:  ARTISYS QA E2E LOJA <qaRunId>
E-mail:        qa-license-<qaRunId>@example.test
```

As chamadas automatizadas incluirão:

```text
X-Artisys-QA-Run: <qaRunId>
```

Quando o header existir, o backend entra em modo de guarda QA.

### Regra de guarda

Uma mutação QA somente pode executar se o alvo comprovar pertencer ao mesmo run por identidade persistida e/ou campos canônicos do registro. Para registro já criado, a autorização deve verificar no servidor, antes da mutação:

- ID foi registrado como criado por este run durante a execução; e
- e-mail contém exatamente o `qaRunId` esperado; e
- nome, quando aplicável, usa o prefixo `ARTISYS QA E2E` e contém o mesmo `qaRunId`.

Se qualquer verificação falhar:

```text
403 qa_scope_violation
```

O servidor não deve confiar apenas em valores enviados pelo browser para decidir que um registro pertence ao QA.

## 10. Baseline de segurança

Antes do primeiro write do E2E live, o script captura um baseline de IDs e campos administrativos relevantes dos registros preexistentes.

O teste mantém dois conjuntos:

- `baselineIds`: tudo que já existia antes do run;
- `createdIds`: somente IDs retornados por criações efetuadas no run.

Regra obrigatória:

```text
qualquer mutação E2E deve ter targetId ∈ createdIds
e targetId ∉ baselineIds
```

O relatório final deve comprovar `existingIdsTouched = 0`.

Diferenças detectadas em registros preexistentes durante a janela do teste não autorizam rollback automático. Elas são reportadas para revisão, pois podem representar atividade legítima simultânea.

## 11. Matriz E2E — Obra na Mão

Fluxo live:

1. capturar baseline;
2. criar empresa/licença QA pela nova Central;
3. capturar IDs retornados;
4. reler snapshot pela nova Central;
5. confirmar mesmos IDs e estado na autoridade do Obra;
6. alterar limites;
7. reler e confirmar;
8. alterar módulos e canais;
9. reler e confirmar;
10. alterar validade;
11. reler e confirmar;
12. suspender;
13. reler e confirmar estado suspenso/revogado;
14. reativar;
15. reler e confirmar estado ativo;
16. quando existir dispositivo QA criado pelo próprio fluxo, testar revogação e reativação apenas desse dispositivo;
17. confirmar eventos de auditoria;
18. terminar com a licença QA inativa/revogada.

O teste de dispositivo não pode usar dispositivo preexistente. Se o fluxo não criar um dispositivo QA de forma segura, essa etapa será coberta por E2E isolado com ambiente controlado e não por produção.

## 12. Matriz E2E — Débora Lactação

Fluxo live:

1. usar e-mail QA inexistente antes do run;
2. `grant`;
3. confirmar `active` por status e snapshot;
4. executar novo `grant` para comprovar renovação de +6 meses segundo a regra existente;
5. confirmar nova validade por releitura;
6. `revoke`;
7. confirmar `revoked`;
8. `grant` novamente;
9. confirmar `active`;
10. confirmar auditoria;
11. finalizar com `revoke`.

## 13. Matriz E2E — Loja Online

Fluxo live:

1. criar empresa/administrador/licença QA;
2. capturar companyId/licenseId;
3. reler e confirmar `ACTIVE`;
4. editar plano e `maxUsers`;
5. reler e confirmar;
6. estender validade;
7. reler e confirmar;
8. bloquear;
9. reler e confirmar `BLOCKED`;
10. desbloquear;
11. reler e confirmar `ACTIVE`;
12. confirmar auditoria;
13. finalizar com bloqueio do registro QA.

## 14. E2E isolado

Antes do live, o repositório deve ter testes locais/CI que exercitem a mesma UI e contratos sem escrever em produção.

O E2E isolado deve usar Playwright e mocks/controladores de teste para comprovar:

- autenticação administrativa;
- renderização da Central;
- emissão dos requests esperados;
- re-fetch após cada mutação;
- mensagens de erro;
- confirmações de ações destrutivas;
- bloqueio de métodos/ações não allowlisted;
- guarda `qa_scope_violation`;
- desktop, tablet e mobile quando a superfície for responsiva.

O QA transacional existente do Obra deve ser reutilizado/estendido onde fizer sentido, evitando duplicar harness de Playwright sem necessidade.

## 15. Paridade da fase 6

Uma operação não é considerada aprovada apenas porque o write retornou 2xx.

Para cada mutação:

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

A criação deve confirmar os mesmos IDs, e-mail e estado nas duas superfícies. Alterações devem confirmar os mesmos módulos, canais, limites, validade e status. Suspensão, bloqueio e reativação devem ser confirmados por nova leitura independente.

O relatório final deve conter, no mínimo:

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

## 16. Limpeza dos registros QA

Não será introduzido DELETE físico apenas para facilitar o teste.

Ao final do live:

- Obra QA termina `suspended/revoked`;
- Débora QA termina `revoked`;
- Loja Online QA termina `BLOCKED`.

Os registros permanecem identificáveis como QA e seus eventos continuam disponíveis para auditoria.

Um mecanismo futuro de purge físico, caso desejado para CI recorrente, será uma entrega separada e deverá aceitar exclusivamente registros QA explicitamente marcados.

## 17. Feature flag e rollback

### Corte imediato de escrita

`LICENSE_CENTER_WRITE_ENABLED=false` deve fazer a nova Central voltar a um estado efetivamente read-only sem afetar a Central antiga.

### Rollback do MercadoLivre

Reverter o Worker `artisys-mercadolivre` para a versão anterior remove a superfície de escrita nova. A Central antiga continua operacional.

### Rollback do Obra

Reverter o Worker `obra-na-mao-comercial` para a versão anterior remove os endpoints internos novos. Como não há migração de schema, não existe migração reversa de banco.

### Registros QA

Rollback automatizado nunca pode restaurar, editar ou apagar IDs de `baselineIds`. Ele só pode inativar os registros pertencentes ao run atual.

## 18. Ordem de implantação

1. refatorar/expor as operações compartilhadas no Obra sem alterar a semântica da Central antiga;
2. adicionar testes de contrato e segurança no Obra;
3. adicionar a superfície de escrita e UI no MercadoLivre;
4. adicionar E2E isolado;
5. executar CI completo dos repositórios envolvidos;
6. deploy do Obra com endpoints internos e feature flag inicialmente controlada;
7. deploy do MercadoLivre;
8. configurar `LICENSE_CENTER_WRITE_SECRET` e `OBRA_LICENSE_CENTER_WRITE_SECRET` com o mesmo valor;
9. habilitar a escrita para a execução controlada;
10. executar E2E live;
11. validar relatório de paridade e `existingIdsTouched = 0`;
12. manter escrita habilitada para operação paralela da fase 7 somente após todos os gates passarem;
13. manter a Central antiga disponível.

## 19. Critérios de conclusão

### Fase 5

Considerada concluída quando a nova Central consegue executar, através das autoridades existentes e sem acesso direto aos bancos:

- Obra: criar, editar, alterar validade, suspender, reativar, alterar módulos, canais e limites; dispositivo somente quando alvo QA seguro estiver disponível;
- Débora: liberar, consultar, renovar, revogar e reativar;
- Loja Online: criar, editar, estender, bloquear e desbloquear.

### Fase 6

Considerada concluída quando:

- CI relevante passa;
- E2E isolado passa;
- E2E live passa;
- writes são confirmados por releituras independentes;
- auditoria corresponde às ações;
- `existingIdsTouched = 0`;
- todos os registros QA terminam inativos.

### Fase 7

Considerada concluída quando:

- a nova Central permanece com escrita habilitada para operação real;
- a Central antiga continua íntegra e disponível;
- o rollback por feature flag permanece funcional;
- nenhuma rota, autenticação ou API antiga necessária é removida.

## 20. Fora do escopo

- fase 8;
- remoção da Central antiga;
- mudança do domínio `artisys.dev` para apontar a nova Central;
- inventário/migração de todas as URLs do ecossistema;
- alteração de D1/schema motivada apenas por esta entrega;
- purge físico de registros QA;
- reescrita da autoridade da Loja Online;
- criação de um novo sistema de autenticação administrativa.

## 21. Resultado esperado

Ao final, existirão duas interfaces administrativas operacionais sobre as mesmas autoridades de dados:

```text
Central nova     → leitura + escrita real → uso principal na fase 7
Central antiga   → leitura + escrita real → fallback preservado
```

As regras de negócio continuam centralizadas nos serviços existentes. O painel `MercadoLivre` funciona como interface/orquestrador administrativo, não como nova autoridade de licenças.