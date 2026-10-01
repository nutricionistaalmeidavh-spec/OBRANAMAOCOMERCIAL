# PR #60 — Segurança, migração e hardening operacional

Data: 2026-10-01
Branch: `hardening/pr60-security-migration-docs`
Base: `feat/desktop-lan-server-foundation` @ `7bcc760466ad45a6555c434f2258f37416ff863b`

## Objetivo

Adicionar, em paralelo à evolução funcional da PR #60, três camadas de fechamento arquitetural antes de qualquer merge/release:

1. isolamento e autorização por empresa/dispositivo/usuário no servidor LAN;
2. migração segura de dados locais para a fonte central, com backup, validação e rollback;
3. documentação/checklist objetivo da PR #60, refletindo o código real e os gates de release.

A implementação deve preservar os modos `local`, `lan-host` e `lan-client`, sem alterar silenciosamente o fluxo existente Desktop ↔ Cloudflare/D1 ↔ PWA e sem fallback implícito para dados locais quando a fonte central estiver configurada.

## Estado atual observado

### Segurança

A autenticação LAN já valida token de dispositivo, status do dispositivo, membro ativo, canal Desktop e módulos autorizados. O contexto autenticado também carrega `companyId`.

O ponto de hardening é o caminho genérico das entidades. Hoje o servidor autentica/autorizada a tabela, mas `repository.list/get/save/remove` não recebe o contexto da empresa autenticada. Isso permite que a proteção dependa de filtros enviados pelo próprio cliente ou apenas do ID global do registro.

Consequências que precisam ser eliminadas:

- leitura de registro por ID sem escopo explícito de empresa;
- update/delete por ID sem escopo explícito de empresa;
- listagem com `empresa_id` controlado pelo cliente;
- referências cruzadas entre empresas por IDs válidos;
- endpoints especializados de Financeiro/RH/Planejamento executando operações sem validar o `companyId` do ator no nível do serviço/repositório.

### Migração

`ModuleStorageStateService` já possui os estados `local`, `central-ready`, `central-active` e `migration-required`, e marca módulos com dados locais como `migration-required` quando o modo operacional deixa de ser local.

Ainda falta um orquestrador de migração que faça a transição de forma segura e verificável.

O `BackupService` atual cria/restaura SQLite, mas:

- ainda usa nomenclatura legada `Fluxo-DRE-Backup` / `fluxo-dre.sqlite` dentro do Obra na Mão Comercial;
- não valida integridade/schema do arquivo restaurado antes da troca;
- não mantém manifesto da migração;
- não vincula backup a módulo, versão de schema ou tentativa de migração;
- não oferece rollback automático quando uma migração central falha.

## Abordagem escolhida

### 1. Isolamento por empresa no servidor LAN

Criar uma camada de escopo de tenant obrigatória no repositório, em vez de confiar em filtros de rota.

#### Regras

- Toda rota autenticada de negócio recebe `context.companyId`.
- O servidor nunca aceita `company_id` do cliente como autoridade de tenant.
- Para entidades com `empresa_id`, o servidor força/valida o `empresa_id` com base no contexto autenticado.
- Para entidades sem `empresa_id` direto, o repositório resolve a empresa por relacionamento pai (obra, RDO, conta, folha, ponto etc.).
- `GET /:id`, `PUT /:id` e `DELETE /:id` retornam `404` quando o registro não pertence à empresa do ator, evitando enumeração entre tenants.
- Admin continua sendo Admin apenas dentro da empresa vinculada ao servidor; papel Admin não remove isolamento de tenant.

#### Estrutura sugerida

- `apps/lan-server/src/tenant-scope.mjs`: resolução de empresa por tabela/relacionamento e helpers de assert/filters.
- `apps/lan-server/src/repository.mjs`: variantes scoped de `list/get/save/remove` ou assinatura com `companyId` obrigatório.
- `apps/lan-server/src/server.mjs`: passa `context.companyId` ao repositório/serviços.
- Serviços especializados recebem o companyId quando necessário.

#### Testes obrigatórios

- empresa A não lê/lista/edita/remove dados da empresa B;
- cliente não consegue trocar `empresa_id` no payload;
- referências cruzadas entre empresas falham;
- IDs válidos de outro tenant retornam 404;
- dispositivo revogado falha imediatamente;
- membro removido/inativo falha;
- membro sem canal Desktop falha;
- código de pareamento é one-shot e expirado não funciona;
- host do servidor não concede Admin automaticamente.

## 2. Migração local → central com backup e rollback

Criar um `ModuleMigrationService` no Desktop. Ele será a única camada autorizada a promover módulo de `migration-required` para `central-active` quando houver dados locais existentes.

### Fluxo por módulo

1. **Preflight**
   - confirmar modo `lan-host` ou `lan-client`;
   - confirmar capability central do módulo;
   - confirmar credencial LAN válida;
   - levantar contagens locais e dependências;
   - bloquear se houver inconsistência estrutural conhecida.

2. **Backup obrigatório**
   - criar snapshot SQLite antes de qualquer escrita remota;
   - usar nomenclatura Obra na Mão;
   - gerar manifesto JSON com data, versão/schema, módulo, contagens, hash/identificador do banco e destino do servidor.

3. **Exportação determinística**
   - ler entidades do módulo em ordem de dependência;
   - normalizar referências;
   - não apagar ou modificar a origem local durante a cópia.

4. **Importação idempotente**
   - enviar para o servidor central usando chaves/import IDs estáveis;
   - reexecutar uma migração interrompida não pode duplicar registros;
   - registrar progresso por etapa/tabela.

5. **Validação**
   - comparar contagens esperadas vs. gravadas;
   - validar relações críticas e amostras por ID/import key;
   - executar leitura de sanidade pelo cliente LAN.

6. **Commit lógico**
   - somente depois da validação completa marcar o módulo `central-active`;
   - registrar conclusão da migração e preservar backup.

7. **Falha / rollback**
   - manter módulo como `migration-required`;
   - não ativar roteamento central parcial;
   - preservar banco local original intacto;
   - permitir retry seguro;
   - se a falha ocorrer após gravações remotas, usar identificador da tentativa para limpar/reverter apenas o lote daquela tentativa, quando suportado.

### Ordem de migração

1. core/relacionamentos necessários;
2. operação/RDO;
3. planejamento;
4. financeiro;
5. RH.

A migração não deve ser monolítica. Cada módulo possui estado e evidência próprios.

### Backup/restore

Aprimorar `BackupService` para:

- nomenclatura `Obra-na-Mao-Backup-<timestamp>`;
- arquivo `obra-na-mao.sqlite`;
- `PRAGMA integrity_check` antes de aceitar restore;
- validação mínima de tabelas/schema esperado;
- safety backup antes do restore;
- falha segura: se restore/open falhar, reabrir a base anterior;
- manifesto do backup e da tentativa de migração.

## 3. Documentação e checklist da PR #60

Atualizar a documentação da branch de hardening e preparar texto/checklist para a PR #60 com:

### Escopo real

- topologias `local`, `lan-host`, `lan-client`;
- autenticação/claim/pareamento;
- módulos já centralizados: core, operação/RDO, planejamento, financeiro e RH conforme estado real do head;
- PDFs/contextos gerados localmente quando aplicável;
- módulos/fluxos ainda fora de escopo.

### Garantias

- Web/PWA continuam incluídos e independentes da escolha de armazenamento;
- Cloud pago futuro é adicional, nunca requisito para sincronização básica já existente;
- sem compartilhamento direto de SQLite pela rede;
- sem fallback silencioso para local quando central está configurado;
- auto-update/release permanece bloqueado até gate manual.

### Gates antes do merge

- [ ] isolamento multiempresa validado;
- [ ] revogação de dispositivo/membro validada;
- [ ] pareamento one-shot/expiração validado;
- [ ] migração com backup e retry validada;
- [ ] rollback/falha parcial validado;
- [ ] local continua funcionando sem servidor;
- [ ] lan-host e lan-client validados;
- [ ] Web/PWA sem regressão;
- [ ] Windows CI verde em head congelado;
- [ ] macOS CI verde em head congelado;
- [ ] Cloudflare CI verde em head congelado;
- [ ] instalador candidato testado em 1 servidor + 1 cliente;
- [ ] updater continua sem publicação automática;
- [ ] descrição da PR reflete o código real.

## Estratégia de implementação

Para reduzir conflito com a F12 ainda ativa:

- esta branch parte do head `7bcc7604` da PR #60;
- novos arquivos concentram tenant scope, migração e evidências;
- evitar alterações desnecessárias em `data-access-service.cjs`, `lan-data-client.cjs` e `module-storage-state-service.cjs` enquanto F12 estiver mudando;
- quando alteração nesses hotspots for inevitável, mantê-la mínima e isolada em commit próprio;
- antes de abrir PR de integração, atualizar/rebasear esta branch sobre o head estabilizado de `feat/desktop-lan-server-foundation` e resolver conflitos conscientemente.

## Testes

A implementação seguirá TDD.

### LAN server

Adicionar testes de isolamento no nível HTTP e do repositório para cada classe de entidade: core, operação, planejamento, financeiro e RH.

### Desktop

Adicionar testes de `ModuleMigrationService` cobrindo:

- preflight;
- backup obrigatório;
- falha antes de copiar;
- falha durante importação;
- retry idempotente;
- mismatch de contagem;
- ativação somente após validação;
- rollback sem perda do banco local.

### Backup

Adicionar testes de:

- nome/manifesto corretos;
- integrity check;
- restore inválido rejeitado sem substituir base atual;
- safety backup;
- recuperação quando open da base restaurada falha.

## Não objetivos desta branch

- concluir novas funcionalidades da F12;
- criar servidor remoto público;
- criar cobrança de Cloud;
- alterar PWA/Cloudflare sem necessidade de compatibilidade;
- publicar release;
- ligar auto-update;
- migrar automaticamente sem confirmação/controle explícito do usuário.

## Critério de pronto

A branch está pronta para integração quando:

1. todos os testes novos e existentes do Desktop/LAN server passam;
2. não existe caminho de entidade autenticada que leia/escreva outro tenant;
3. migração falha de modo seguro e repetível;
4. backup/restore é validado antes da troca de banco;
5. documentação/checklist corresponde ao código final;
6. nenhuma etapa de deploy/release foi executada.