# Obra na Mão — F14–F16 Concorrência, permissões granulares e administração

**Data:** 2026-10-01  
**Status:** desenho arquitetural para revisão  
**Branch:** `feat/lan-f13-f17-hardening-concurrency-permissions-migration`  
**Base:** `031aac08ef412c24fb7f2836c70f5f957be9d869` (PR #60, F8–F12 final)  
**Escopo exclusivo desta branch:** F14, F15 e F16  
**Workstream paralelo reservado:** `hardening/pr60-security-migration-docs` — F13 residual + F17

## 1. Objetivo

Fechar três lacunas que permanecem depois da centralização F8–F12 sem duplicar o trabalho de hardening/migração em execução paralela:

- **F14 — concorrência otimista:** impedir que dois Desktops sobrescrevam silenciosamente a mesma informação central;
- **F15 — permissões granulares:** ampliar a autorização atual de `role + modules + channels` para ações concretas (`view`, `create`, `edit`, `delete`, `approve`) mantendo Cloudflare como autoridade;
- **F16 — administração:** disponibilizar no painel online existente uma forma segura de um administrador configurar essas permissões e propagar o novo snapshot aos servidores LAN.

O resultado continua sendo um único produto, com a arquitetura existente:

```text
Desktop(s) → LAN Server / SQLite central
                  │
                  ├─ autorização pelo snapshot Cloud
                  └─ SyncCoordinator único no PC principal
                                  │
                                  ↓
                         Cloudflare / D1 ↔ PWA
```

## 2. Restrições inegociáveis

1. Não alterar nem substituir o fluxo `Desktop ↔ Cloudflare/D1 ↔ PWA`.
2. Não criar segundo `SyncCoordinator`.
3. Não implementar backup, restore, migração local→central ou `ModuleMigrationService`; isso pertence ao workstream paralelo F13/F17.
4. Não modificar o comportamento `migration-required`/`central-active` além do estritamente necessário para consumir dados após a integração futura.
5. Não criar ACL local independente no servidor LAN.
6. Cloudflare/D1 continua autoridade para empresa, membro, role, módulos, canais e permissões.
7. O servidor LAN pode operar offline com o último snapshot válido, como já ocorre com identidade/módulos.
8. Revogação de dispositivo LAN continua sendo controle local de transporte; não vira editor de permissões do usuário.
9. Sem fallback silencioso para SQLite local quando a fonte central estiver configurada.
10. Sem servidor remoto público, exposição à Internet ou dependência paga obrigatória.
11. `DESKTOP_AUTO_RELEASE_ENABLED=false` permanece intocado.
12. Nenhum merge, deploy ou GitHub Release faz parte desta branch sem autorização explícita posterior.

## 3. Estratégia para trabalho paralelo

A branch `hardening/pr60-security-migration-docs` está alterando hotspots do LAN Server, especialmente `server.mjs`, `repository.mjs` e componentes de migração/segurança. Para reduzir conflito:

### Durante a execução paralela

F14 começa por arquivos novos e contratos independentes:

- migration SQL/sidecar de revisão;
- `concurrency-service.mjs`;
- testes de unidade do serviço;
- contrato de conflito/HTTP;
- adaptador Desktop para preservar `revision` junto aos registros.

F15/F16 concentra mudanças no backend Web/Cloud e no painel de administração, que não pertencem ao workstream F13/F17.

### Depois que o hardening estabilizar

Antes de finalizar F14:

1. atualizar esta branch com o head final reconciliado de F13/F17;
2. preservar as mudanças de segurança/integridade/migração;
3. integrar o `ConcurrencyService` nos hotspots finais (`repository.mjs`, `server.mjs` e endpoints de domínio) com alterações pequenas;
4. rerodar todos os testes, pois evidência anterior ao rebase deixa de valer.

Nenhuma alteração de hotspot será resolvida por escolha cega de `ours/theirs`.

---

# F14 — Concorrência otimista

## 4. Problema

Hoje o servidor central é o único writer do SQLite, o que evita corrupção física, mas não evita conflito lógico:

```text
PC A lê registro rev 7
PC B lê registro rev 7
PC A salva → valor A
PC B salva depois → valor B
```

Sem revisão esperada, a gravação de B pode apagar silenciosamente a alteração de A.

F14 deve transformar o segundo save em conflito explícito.

## 5. Abordagens consideradas

### A. Coluna `revision` em todas as tabelas

Vantagem: revisão fica ao lado do registro.  
Desvantagem: exige alterar muitas tabelas de F8–F12, amplia conflito com F13/F17 e cria migrações repetitivas.

### B. Tabela sidecar central de revisões — escolhida

Criar uma estrutura central equivalente a:

```text
record_revisions
- resource_type
- resource_id
- revision
- updated_at
PRIMARY KEY(resource_type, resource_id)
```

Vantagens:

- não muda dezenas de schemas de negócio;
- funciona para CRUD genérico e raízes de operações compostas;
- reduz conflito com a branch de migração;
- revisão pode ser adicionada a respostas sem contaminar os dados de domínio persistidos;
- permite criar revisões para recursos compostos (`rdo`, `folha`, `ponto-mensal`) sem inventar colunas auxiliares em filhos substituíveis.

### C. Event sourcing completo

Fora de escopo. Resolveria concorrência/auditoria de forma mais ampla, mas reestruturaria o produto desnecessariamente.

## 6. Contrato de revisão

Toda leitura de entidade central editável devolve metadado:

```json
{
  "id": 123,
  "...": "campos atuais",
  "revision": 4
}
```

A `revision` é metadado de transporte e não precisa ser armazenada como coluna na tabela de negócio.

### Criação

- novo registro nasce com revisão `1`;
- resposta do POST inclui `revision: 1`.

### Atualização

Cliente envia revisão observada:

```json
{
  "expectedRevision": 4,
  "data": { "...": "alterações" }
}
```

No mesmo `BEGIN IMMEDIATE`:

1. servidor lê revisão atual;
2. compara com `expectedRevision`;
3. se divergir, não altera o registro;
4. se coincidir, aplica a alteração;
5. incrementa a revisão;
6. commit;
7. resposta inclui nova revisão.

### Exclusão

DELETE de registro versionado também exige `expectedRevision`, evitando apagar uma versão que o usuário não chegou a observar.

## 7. Resposta de conflito

Contrato HTTP:

```http
409 Conflict
```

```json
{
  "error": "revision_conflict",
  "resourceType": "obras",
  "resourceId": 123,
  "expectedRevision": 4,
  "currentRevision": 5,
  "current": { "...": "estado atual autorizado" }
}
```

Regras:

- nunca incluir segredos;
- `current` respeita a mesma autorização de leitura;
- não fazer merge automático;
- não aplicar `last-write-wins` silencioso;
- retry só ocorre depois que o usuário/client recarrega a revisão atual.

## 8. Operações compostas

Operações compostas usam revisão na **raiz lógica**.

### RDO

`rdos:<id>` é a raiz. Salvar RDO + equipe + equipamentos + ocorrências + anexos + tarefas ocorre em uma única transação e exige a revisão do RDO existente.

### Folha

`folhas_pagamento:<id>` é a raiz para alterações/confirmações que modificam a competência. Confirmação exige revisão esperada da folha.

### Ponto

`pontos_mensais:<id>` é a raiz para gravação composta de marcações.

### Financeiro

- edição de `contas` usa a revisão da conta;
- registro idempotente de pagamento continua usando o identificador de requisição existente e não ganha mecanismo concorrente duplicado;
- ações que mudam estado já existente devem validar a revisão do recurso raiz quando aplicável.

### Planejamento

Entidades existentes usam a revisão do próprio registro. Operações que recalculam visão/curva permanecem leitura e não exigem revisão.

## 9. Compatibilidade e capability

O LAN Server anuncia capability explícita, por exemplo:

```json
{
  "features": ["optimistic-concurrency-v1"]
}
```

Quando essa capability estiver ativa:

- mutações de recursos versionados existentes sem `expectedRevision` retornam erro explícito de precondição;
- clientes atualizados sempre enviam a revisão;
- não existe downgrade silencioso para last-write-wins.

Como o recurso ainda não foi publicado e releases estão congelados, servidor e Desktop serão validados como um candidato compatível antes de distribuição.

## 10. UX Desktop de conflito

A UI não tenta resolver conteúdo automaticamente.

Ao receber `revision_conflict`:

- mostrar mensagem clara: “Este registro foi alterado em outro computador.”;
- oferecer **Recarregar versão atual**;
- quando o formulário puder preservar a edição local sem risco, oferecer **Revisar minhas alterações** depois do reload;
- nunca reenviar automaticamente com a nova revisão sem intervenção do fluxo da tela.

A implementação pode começar com reload explícito para os fluxos críticos; merge visual campo-a-campo não é requisito de F14.

## 11. Gate F14

Testes obrigatórios:

- dois clientes leem rev N;
- A salva com N → sucesso e N+1;
- B salva com N → 409;
- estado de A permanece intacto;
- B recarrega N+1 e salva → sucesso N+2;
- DELETE stale → 409;
- transação composta stale não altera filhos;
- falha durante operação composta não incrementa revisão;
- revisão não atravessa tenant/instância;
- local mode continua sem depender do sidecar LAN;
- sync/PWA não recebe um segundo mecanismo de concorrência LAN paralelo ao protocolo Cloud existente.

---

# F15 — Permissões granulares

## 12. Modelo de autoridade

O modelo atual possui:

- `role` (`admin`, `foreman`, `employee`);
- `modules`;
- `channels`;
- status do membro;
- status do dispositivo.

F15 adiciona **ações**, sem substituir essas dimensões.

Cloudflare/D1 calcula e fornece ao LAN Server as permissões efetivas de cada membro.

O LAN Server apenas executa o snapshot recebido.

## 13. Taxonomia única

Ações universais:

```text
view
create
edit
delete
approve
```

Domínios:

```text
core
operation
planning
finance
rh
```

Forma conceitual:

```json
{
  "permissions": {
    "core": ["view", "create", "edit"],
    "operation": ["view", "create", "edit", "approve"],
    "planning": ["view"],
    "finance": [],
    "rh": []
  }
}
```

Não criar nomes alternativos como `write`, `manage`, `update`, `pay`, `confirm` no motor principal. Endpoints especializados são mapeados para uma das cinco ações.

## 14. Mapeamento de operação → ação

CRUD genérico:

- GET/list → `view`;
- POST → `create`;
- PUT/PATCH → `edit`;
- DELETE → `delete`.

Operações de decisão/fechamento:

- confirmar/fechar folha → `approve` em RH;
- registrar/confirmar ação financeira que efetiva pagamento → `approve` em Financeiro quando a rota representa efetivação, não mero cadastro;
- ação de aprovação/finalização operacional → `approve` em Operação;
- alterações comuns de planejamento → `edit`;
- leitura de dashboard/DRE/overview → `view`.

O plano de implementação deverá listar explicitamente cada endpoint especializado já existente e sua ação para impedir autorização implícita.

## 15. Roles como templates, não segunda ACL

Roles permanecem por compatibilidade e para defaults de UX.

Regras:

- `admin`: permissões efetivas completas para domínios habilitados, respeitando regras de owner/licença já existentes;
- `foreman` e `employee`: recebem templates iniciais coerentes com o comportamento atual;
- configuração granular do membro pode restringir/ampliar dentro dos módulos/canais que a conta possui;
- um usuário não ganha permissão para módulo que não está em seus entitlements;
- `desktop` continua obrigatório para LAN Desktop;
- remover módulo/canal no Cloud continua sobrepondo qualquer permissão granular armazenada.

O backend Cloud produz `effectivePermissions`; o LAN Server não replica as regras de templates.

## 16. Snapshot versionado

Evoluir o snapshot LAN de membro para transportar, além de role/modules/channels:

```json
{
  "permissions": { ... },
  "permissionsRevision": "..."
}
```

A revisão global do snapshot/identidade continua sendo usada para detectar atualização do cache.

No banco LAN, o cache ganha somente o necessário para armazenar o snapshot de permissões recebido. Nenhum endpoint LAN permite editar essas permissões.

### Offline

Se Internet cair:

- último snapshot válido continua autorizando;
- UI/diagnóstico pode indicar snapshot desatualizado conforme regra já existente;
- mudança feita online só entra em vigor no LAN após refresh;
- revogação local de dispositivo continua podendo bloquear imediatamente, independentemente do snapshot.

## 17. Compatibilidade de rollout

Durante a transição:

- snapshots antigos sem `permissions` continuam usando a política atual `role + modules + channels`;
- snapshots novos com `permissions` usam o avaliador granular;
- capability/policy version permite ao servidor informar a versão entendida;
- após todos os consumidores do candidato serem atualizados, os testes exigem snapshot granular nos cenários F15.

Isso evita quebrar servidores já configurados durante a reconciliação de branches.

## 18. Avaliador único de autorização

Criar uma função/serviço único equivalente a:

```text
authorizeAction(context, { domain, action, resource? })
```

Todos os caminhos passam por ela:

- CRUD genérico;
- RDO;
- Planejamento;
- Financeiro;
- RH/folha/ponto;
- endpoints administrativos LAN continuam com regra administrativa própria e não são confundidos com permissões de negócio.

Esconder botão na UI nunca substitui autorização de backend.

## 19. Gate F15

Cobrir pelo menos:

- `view` sem `edit` lê mas não altera;
- `create` não implica `edit`;
- `edit` não implica `delete`;
- `approve` separado de `edit`;
- módulo ausente bloqueia mesmo com ação presente;
- canal Desktop ausente bloqueia LAN;
- dispositivo revogado bloqueia antes da ação granular;
- snapshot atualizado passa a valer sem reiniciar servidor;
- snapshot antigo mantém comportamento legado durante rollout;
- Admin não atravessa tenant;
- rotas especializadas obedecem a mesma política das rotas genéricas.

---

# F16 — Painel e administração

## 20. Local correto da administração

A edição de permissões fica no **painel online existente**, porque Cloudflare/D1 é a autoridade.

Não criar editor local independente no Desktop ou LAN Server.

Desktop pode mostrar:

- identidade atual;
- role;
- módulos;
- permissões efetivas somente leitura;
- data/revisão do último snapshot;
- link/ação para abrir a administração online existente.

## 21. Painel Web/PWA

Evoluir a experiência atual de usuários/membros para incluir permissões granulares.

Para cada membro administrável:

1. role;
2. módulos;
3. canais;
4. matriz por domínio × ação;
5. indicação clara do que é bloqueado por módulo/canal/licença;
6. estado efetivo antes de salvar.

Exemplo conceitual:

| Domínio | Ver | Criar | Editar | Excluir | Aprovar |
|---|---|---|---|---|---|
| Cadastros | ✓ | ✓ | ✓ | — | — |
| Operação/RDO | ✓ | ✓ | ✓ | — | ✓ |
| Planejamento | ✓ | — | ✓ | — | — |
| Financeiro | ✓ | — | — | — | — |
| RH | — | — | — | — | — |

A UI deve ser mobile-first e não depender de hover.

## 22. Proteções administrativas

- somente usuário com autoridade administrativa Cloud atual pode editar outro membro;
- usuário não pode conceder módulo/canal que a empresa/licença não possui;
- canonical owner, quando aplicável ao modelo atual, não pode ser acidentalmente bloqueado do próprio tenant;
- impedir remoção do último administrador quando a regra atual exigir ao menos um administrador;
- alterações críticas exigem confirmação clara;
- salvar é transacional;
- registrar auditoria Cloud com ator, alvo e diff resumido de role/modules/channels/permissions;
- nenhum segredo/token aparece na UI ou auditoria.

## 23. Fluxo de propagação

```text
Admin salva permissões no Web
        ↓
Cloudflare/D1 persiste + audita
        ↓
revision/snapshot muda
        ↓
LAN Server executa refresh atual
        ↓
lan_members_cache recebe effectivePermissions
        ↓
próxima requisição do Desktop usa nova política
```

Não reiniciar servidor e não refazer pareamento para atualizar permissão.

Quando offline, permanece o último snapshot válido até o refresh ser possível.

## 24. UX de templates

Para reduzir erro de configuração:

- escolher/trocar role pode sugerir um template de permissões;
- a UI mostra o resultado antes de aplicar;
- alterações granulares tornam o membro explicitamente customizado quando diferirem do template;
- nunca sobrescrever customizações silenciosamente ao reabrir o painel.

O armazenamento Cloud persiste as escolhas do membro; templates são ferramenta de edição, não autoridade paralela.

## 25. Gate F16

Testes obrigatórios:

- somente admin autorizado abre/edita;
- módulos/canais fora da licença não podem ser concedidos;
- salvar matriz persiste e audita;
- snapshot seguinte contém permissões efetivas esperadas;
- LAN refresh aplica a nova política sem restart;
- remoção de `edit` bloqueia imediatamente após refresh;
- owner/último admin protegido;
- UI mobile permite configurar toda matriz;
- Desktop, se exibir resumo, é read-only;
- nenhuma permissão pode ser alterada diretamente pelo LAN Server.

---

# 26. Ordem de implementação

A ordem lógica permanece:

```text
F14 concorrência
 ↓
F15 motor de permissões
 ↓
F16 administração
```

Por causa do workstream paralelo, a execução física é dividida:

```text
Enquanto F13/F17 está ativo
├─ F14: sidecar + ConcurrencyService + testes/contratos (arquivos novos)
├─ F15: schema/contrato Cloud + avaliador granular isolado
└─ F16: backend/painel Cloud, sem tocar migração

Após F13/F17 estabilizar
↓
reconciliar branches
↓
wire F14 nos hotspots finais LAN
↓
wire F15 no snapshot/cache final
↓
integração F16 → snapshot → LAN
↓
gate completo F14–F16
```

Nenhuma fase será declarada concluída apenas porque a parte isolada passou; o gate integrado após a reconciliação é obrigatório.

# 27. Teste integrado final

Cenário mínimo:

1. PC A e PC B estão conectados ao mesmo LAN Server;
2. ambos leem a mesma obra na revisão N;
3. A altera e salva → N+1;
4. B tenta salvar N → recebe conflito e não sobrescreve A;
5. Admin online remove `edit` de B para `core`;
6. LAN Server atualiza snapshot;
7. B continua podendo `view`, mas save é 403;
8. Admin devolve `edit` e concede `approve` apenas em Operação;
9. B volta a editar core e aprovar operação, mas continua sem `approve` em Financeiro/RH;
10. `lan-client` continua sem SyncCoordinator;
11. PC principal continua sincronizando pelo pipeline existente com Cloudflare/D1/PWA;
12. nenhuma parte de migração/backup é duplicada por F14–F16.

# 28. CI e release gate

Antes de qualquer integração final:

- Desktop lint/test/build verdes;
- LAN server completo verde;
- Web/PWA regressions verdes;
- Cloudflare tests/build verdes;
- testes F14 de concorrência multi-cliente verdes;
- testes F15 de autorização genérica/especializada verdes;
- testes F16 de edição + snapshot + refresh verdes;
- `DESKTOP_AUTO_RELEASE_ENABLED=false` confirmado;
- `Publish GitHub release` deve permanecer skipped;
- nenhum production deploy/migrate/smoke sem autorização explícita.

# 29. Fora do escopo

- backup/restore central — F13 paralelo;
- migração local→central — F17 paralelo;
- limpeza do banco local pós-migração;
- remote/public server;
- escrita LAN offline com fila local;
- CRDT/event sourcing;
- merge automático de edições concorrentes;
- ACL local independente;
- cobrança/Cloud pago como requisito;
- merge/release/deploy.

# 30. Critério de pronto

F14–F16 só estão prontos quando:

1. nenhuma edição central stale sobrescreve silenciosamente a versão atual;
2. todas as rotas de negócio usam a mesma política granular;
3. Cloud continua sendo a única autoridade de permissões;
4. painel administrativo altera e audita permissões de forma segura;
5. refresh de snapshot muda autorização LAN sem restart/repareamento;
6. workstream F13/F17 foi reconciliado sem regressão ou duplicação;
7. Desktop/LAN/Web/PWA continuam compatíveis;
8. CI final do mesmo SHA está verde;
9. release/deploy continuam bloqueados até decisão explícita.