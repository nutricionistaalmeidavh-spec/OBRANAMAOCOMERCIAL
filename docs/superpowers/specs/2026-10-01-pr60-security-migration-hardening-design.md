# PR #60 — Segurança, migração e hardening operacional

Data: 2026-10-01
Branch: `hardening/pr60-security-migration-docs`
Base inicial: `feat/desktop-lan-server-foundation` @ `7bcc760466ad45a6555c434f2258f37416ff863b`

## Objetivo

Adicionar, em paralelo à evolução funcional da PR #60, três camadas de fechamento arquitetural antes de qualquer merge/release:

1. isolamento/autorização por servidor reivindicado, dispositivo e usuário, mais integridade de relacionamentos entre entidades;
2. migração segura de dados locais para a fonte central, com backup, validação e rollback, incluindo os cadastros-base necessários aos demais módulos;
3. documentação/checklist objetivo da PR #60, refletindo o código real e os gates de release.

A implementação deve preservar os modos `local`, `lan-host` e `lan-client`, sem alterar silenciosamente o fluxo existente Desktop ↔ Cloudflare/D1 ↔ PWA e sem fallback implícito para dados locais quando a fonte central estiver configurada.

## Estado atual observado

### Segurança

A autenticação LAN já valida token de dispositivo, status do dispositivo, membro ativo, canal Desktop e módulos autorizados. O servidor é reivindicado uma única vez por uma empresa Cloud e mantém `companyId` no estado de identidade local.

Durante a revisão do código foi identificado um detalhe importante que corrige a hipótese inicial deste desenho: `companyId` da autoridade Cloud é textual (por exemplo `company-a`), enquanto `empresas.id` no banco operacional LAN é um inteiro autoincremental. Portanto, **não é correto comparar diretamente `context.companyId` com `empresa_id` das tabelas operacionais**.

A fronteira de tenant da arquitetura atual é o **servidor LAN reivindicado**: cada instância é vinculada a uma única empresa Cloud, aceita somente tokens de dispositivos criados nessa própria instância e rejeita novo claim depois de vinculada. As tabelas `empresas`, `obras`, `funcionarios` etc. são dados de domínio internos desse tenant.

O hardening deve, portanto, garantir duas coisas distintas:

- **isolamento de tenant/identidade**: nenhum token/snapshot/claim de outra empresa Cloud pode reutilizar a instância já reivindicada;
- **integridade de domínio**: IDs relacionados (`empresa_id`, `obra_id`, `folha_id`, `funcionario_id`, etc.) não podem formar relacionamentos incoerentes dentro do banco central.

Uma futura instância LAN multi-tenant exigiria uma chave de tenant persistida por linha ou uma camada de mapeamento explícita; isso fica fora do escopo desta PR.

### Migração

`ModuleStorageStateService` já possui os estados `local`, `central-ready`, `central-active` e `migration-required` para operação, planejamento, financeiro e RH, e marca módulos com dados locais como `migration-required` quando o modo operacional deixa de ser local.

A revisão também identificou um bloqueador anterior aos quatro módulos: `DataAccessService` hoje roteia `empresas`, `clientes` e `obras` diretamente para o servidor assim que o transporte LAN fica pronto, sem um estado de migração para esses cadastros. Uma instalação existente pode, portanto, trocar para servidor e deixar de enxergar os cadastros-base locais antes de migrá-los.

O fechamento deve adicionar um quinto estado lógico, **`core` (cadastros-base)**, cobrindo `empresas`, `clientes` e `obras`. Core deve seguir os mesmos gates `local` → `migration-required`/`central-ready` → `central-active` e deve ser migrado antes de qualquer módulo dependente.

Ainda falta um orquestrador de migração que faça a transição de forma segura e verificável.

O `BackupService` atual cria/restaura SQLite, mas:

- ainda usa nomenclatura legada `Fluxo-DRE-Backup` / `fluxo-dre.sqlite` dentro do Obra na Mão Comercial;
- não valida integridade/schema do arquivo restaurado antes da troca;
- não mantém manifesto da migração;
- não vincula backup a módulo, versão de schema ou tentativa de migração;
- não oferece recuperação automática quando uma migração central falha.

## Abordagem escolhida

### 1. Isolamento do servidor e integridade de domínio

#### Regras de tenant

- O servidor LAN continua **single-tenant** nesta arquitetura.
- O `companyId` Cloud permanece preso ao `lan_server_identity` depois do claim.
- Um segundo claim para outra empresa deve falhar sem alterar identidade, snapshot, devices ou dados operacionais.
- `writeSnapshot/replaceSnapshot` continuam rejeitando snapshot cujo `companyId` difere da empresa já vinculada.
- Tokens de dispositivos são locais à instância e nunca funcionam em outra instância/tenant.
- Revogação de dispositivo, membro removido/inativo e perda do canal Desktop devem interromper acesso imediatamente.
- Papel Admin concede poderes administrativos **somente dentro da instância já reivindicada**; não permite trocar tenant.
- Nenhum endpoint público deve devolver `serverToken`, hashes de token, setup hash ou outros segredos persistidos.

#### Regras de integridade de domínio

- `empresa_id`, `obra_id`, `frente_id`, `etapa_id`, `funcionario_id`, `folha_id`, `ponto_mensal_id`, `conta_id` e demais FKs relevantes devem ser validados antes de gravação quando a regra de negócio exige pertencimento comum.
- O cliente não pode criar referência cruzada incoerente apenas informando IDs válidos.
- `PUT` não pode mover silenciosamente um registro para outra empresa/obra quando isso quebrar os relacionamentos existentes.
- Financeiro, Planejamento e RH devem aplicar as mesmas validações tanto pelas rotas genéricas quanto pelos endpoints especializados.
- `GET/PUT/DELETE` por ID inexistente continua respondendo `404`; falhas de relacionamento retornam erro de validação sem expor segredos.

#### Testes obrigatórios

- servidor A rejeita token criado no servidor B;
- servidor já reivindicado rejeita segundo claim para empresa diferente e preserva o estado anterior;
- snapshot de empresa diferente é rejeitado de forma transacional;
- dispositivo revogado falha imediatamente;
- membro removido/inativo falha;
- membro sem canal Desktop falha;
- código de pareamento é one-shot e expirado não funciona;
- host do servidor não concede Admin automaticamente;
- referências cruzadas inválidas entre empresa/obra/funcionário/folha/ponto/financeiro são rejeitadas;
- alteração via `PUT` não pode quebrar pertencimento relacional previamente válido.

## 2. Migração local → central com backup e rollback

Criar um `ModuleMigrationService` no Desktop. Ele será a única camada autorizada a promover `core`, `operation`, `planning`, `finance` ou `rh` de `migration-required` para `central-active` quando houver dados locais existentes.

### Gate de core

- `ModuleStorageStateService` passa a reconhecer `core` e contar `empresas`, `clientes` e `obras` locais.
- `DataAccessService` deixa de rotear core diretamente para remoto apenas porque o transporte LAN está pronto.
- Se houver cadastros-base locais, core fica `migration-required` e continua lendo/escrevendo localmente até migração explícita.
- Se não houver cadastros-base locais e o servidor anunciar capability `core`, core pode ir de `central-ready` para `central-active`.
- `operation`, `planning`, `finance` e `rh` não podem ser promovidos por migração enquanto core não estiver `central-active`.

### Fluxo por módulo

1. **Preflight**
   - confirmar modo `lan-host` ou `lan-client`;
   - confirmar capability central do módulo;
   - confirmar credencial LAN válida;
   - confirmar dependências anteriores (`core` antes dos demais; demais dependências específicas quando aplicável);
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
   - enviar ao servidor usando `migrationId` + chave estável por registro (`sourceTable` + `sourceId`);
   - reexecutar uma migração interrompida não pode duplicar registros;
   - registrar progresso por etapa/tabela no servidor.

5. **Validação**
   - comparar contagens esperadas vs. gravadas;
   - validar relações críticas e amostras pela chave de origem;
   - executar leitura de sanidade pelo cliente LAN.

6. **Commit lógico**
   - somente depois da validação completa marcar o módulo `central-active`;
   - registrar conclusão da migração e preservar backup.

7. **Falha / rollback**
   - manter módulo como `migration-required`;
   - não ativar roteamento central parcial;
   - preservar banco local original intacto;
   - permitir retry seguro;
   - servidor identifica as gravações da tentativa pelo `migrationId` e remove apenas o lote daquela tentativa quando rollback explícito for necessário.

### Ordem de migração

1. core (`empresas`, `clientes`, `obras`);
2. operação/RDO;
3. planejamento;
4. financeiro;
5. RH.

A migração não deve ser monolítica. Cada módulo possui estado e evidência próprios.

### Backup/restore

Aprimorar `BackupService` para:

- nomenclatura `Obra-na-Mao-Backup-<timestamp>`;
- arquivo `obra-na-mao.sqlite`;
- manifesto JSON ao lado do banco;
- `PRAGMA integrity_check` antes de aceitar restore;
- validação mínima de tabelas/schema esperado;
- safety backup antes do restore;
- falha segura: se restore/open falhar, restaurar/reabrir a base anterior;
- manifesto da tentativa de migração referenciando o backup criado.

## 3. Controle explícito no Desktop

A migração não ocorre automaticamente ao trocar para `lan-host`/`lan-client`.

- `StorageServerSettings` mostra estado de cinco blocos: cadastros-base/core, operação, planejamento, financeiro e RH.
- Quando um bloco estiver `migration-required`, a UI apresenta ação explícita de migração.
- Módulos dependentes ficam visualmente bloqueados enquanto core não estiver `central-active`.
- Antes de iniciar, a UI informa que será criado backup e que a base local não será apagada durante a cópia.
- O usuário acompanha resultado por módulo; erro mantém `migration-required`.
- A UI não oferece “forçar central-active”.

## 4. Documentação e checklist da PR #60

Atualizar a documentação da branch de hardening e preparar texto/checklist para a PR #60 com:

### Escopo real

- topologias `local`, `lan-host`, `lan-client`;
- autenticação/claim/pareamento;
- servidor LAN single-tenant por claim Cloud;
- cadastros-base/core com gate de migração;
- módulos já centralizados: operação/RDO, planejamento, financeiro e RH conforme estado real do head;
- PDFs/contextos gerados localmente quando aplicável;
- módulos/fluxos ainda fora de escopo.

### Garantias

- Web/PWA continuam incluídos e independentes da escolha de armazenamento;
- Cloud pago futuro é adicional, nunca requisito para sincronização básica já existente;
- sem compartilhamento direto de SQLite pela rede;
- sem fallback silencioso para local quando central está configurado;
- auto-update/release permanece bloqueado até gate manual.

### Gates antes do merge

- [ ] isolamento entre instâncias/claims validado;
- [ ] integridade de relacionamentos de domínio validada;
- [ ] revogação de dispositivo/membro validada;
- [ ] pareamento one-shot/expiração validado;
- [ ] core existente não desaparece ao configurar servidor;
- [ ] migração core concluída antes dos módulos dependentes;
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

- esta branch partiu do head `7bcc7604` da PR #60;
- novos arquivos concentram protocolo de migração e testes de hardening;
- alterações em `data-access-service.cjs`, `lan-data-client.cjs` e `module-storage-state-service.cjs` são inevitáveis para fechar o gate de core, mas devem ser mínimas e isoladas em commits próprios;
- antes de abrir PR de integração, atualizar/rebasear esta branch sobre o head estabilizado de `feat/desktop-lan-server-foundation` e resolver conflitos conscientemente.

## Testes

A implementação seguirá TDD.

### LAN server

Adicionar testes para:

- isolamento de claim/token entre instâncias;
- integridade relacional no repositório;
- protocolo de migração idempotente e rollback por `migrationId`;
- endpoints especializados de Financeiro/RH/Planejamento preservando as mesmas regras.

### Desktop

Adicionar testes de estado/roteamento cobrindo core local, `migration-required`, `central-ready` e `central-active`.

Adicionar testes de `ModuleMigrationService` cobrindo:

- preflight e dependência de core;
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
- transformar uma instância LAN em servidor multi-tenant;
- criar servidor remoto público;
- criar cobrança de Cloud;
- alterar PWA/Cloudflare sem necessidade de compatibilidade;
- publicar release;
- ligar auto-update;
- migrar automaticamente sem confirmação/controle explícito do usuário.

## Critério de pronto

A branch está pronta para integração quando:

1. todos os testes novos e existentes do Desktop/LAN server passam;
2. identidade/claim/tokens não atravessam instâncias ou empresas Cloud;
3. relações de domínio inválidas são rejeitadas antes de persistir;
4. core existente não desaparece nem muda para remoto antes da migração;
5. migração falha de modo seguro e repetível;
6. backup/restore é validado antes da troca de banco;
7. UI exige ação explícita para migrar e nunca força `central-active`;
8. documentação/checklist corresponde ao código final;
9. nenhuma etapa de deploy/release foi executada.