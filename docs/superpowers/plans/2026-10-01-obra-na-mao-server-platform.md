# Obra na Mão Server Platform — Implementation Plan

**Data:** 2026-10-01  
**Status:** plano para revisão — nenhum código de produto desta plataforma deve ser implementado antes da aprovação deste arquivo  
**Branch:** `feat/obra-na-mao-server-platform`  
**Spec aprovada:** `docs/superpowers/specs/2026-10-01-obra-na-mao-server-platform-design.md`  
**Head de planejamento:** `8d241ad91bb1fe6f0a7d6a7249824accbd00613c`  
**Base de hardening herdada:** `34181a2b911d95eefbabf78fbe67d78e84321210`  
**Linha F14–F16 a reconciliar:** `feat/lan-f13-f17-hardening-concurrency-permissions-migration`

## 1. Objetivo

Transformar o `apps/lan-server` existente no **Obra na Mão Server** genérico, headless e reutilizável, sem criar um segundo backend e sem implementar código específico para o Everton.

O mesmo Server Core deverá sustentar, por empacotamento e configuração:

- servidor Windows dedicado;
- servidor Linux com `systemd`;
- instalação remota/self-hosted;
- Docker/NAS/VPS;
- descoberta automática LAN;
- conexão manual local/remota;
- primeira homologação real no ambiente do Everton.

O Desktop continua sendo cliente. A lógica de negócio, banco, segurança, migração, autorização, concorrência e sync devem continuar pertencendo aos contratos já construídos em F8–F17.

## 2. Restrições inegociáveis

1. Evoluir `apps/lan-server`; não criar outro backend paralelo.
2. Manter **um único `SyncCoordinator`**. Não criar segundo pipeline Desktop ↔ Cloud/PWA.
3. `lan-client` nunca inicia sync central.
4. Não compartilhar SQLite diretamente pela rede.
5. Não fazer fallback silencioso para SQLite local quando uma fonte central é esperada.
6. Preservar identidade, claim de empresa, dispositivos revogáveis e snapshots Cloud.
7. Preservar F13/F17: backup seguro, integridade, rollback/retry e migração `core` antes dos módulos dependentes.
8. Preservar F14: revisão otimista e conflito `409`, sem `last-write-wins` silencioso.
9. Preservar F15/F16: permissões granulares e Cloud como autoridade administrativa.
10. `DESKTOP_AUTO_RELEASE_ENABLED=false` permanece inalterado.
11. Nenhum merge em `main`, deploy de produção, GitHub Release ou atualização automática durante este plano.
12. Núcleo R$0/self-hosted/open source; serviço pago nunca pode ser dependência obrigatória silenciosa.
13. Nenhum `if (cliente === "Everton")` ou equivalente.
14. O modo remoto nunca deve significar “abrir uma porta pública insegura por padrão”.

## 3. Política de execução

Cada tarefa de implementação seguirá **TDD**:

1. escrever/ajustar teste que falhe pelo comportamento ausente;
2. executar teste focal e confirmar RED pelo motivo esperado;
3. implementar o mínimo para GREEN;
4. refatorar sem alterar comportamento;
5. rerodar teste focal;
6. rerodar o conjunto de regressão definido para a tarefa;
7. commit pequeno e coerente.

Mudanças em hotspots compartilhados (`server.mjs`, repository/auth/snapshot/migration) não serão resolvidas com `ours/theirs` cego.

As fases posteriores podem ganhar subplanos focados quando chegarem à execução, mas este arquivo define a ordem, os contratos, gates e critérios de aceite que não podem mudar silenciosamente.

---

# WAVE 1 — F18: Server Core headless

## Tarefa F18.1 — Contrato de configuração do runtime

**Criar:**
- `apps/lan-server/src/runtime-config.mjs`
- `apps/lan-server/tests/runtime-config.test.mjs`

**Modificar:**
- `apps/lan-server/src/index.mjs`

### Testes RED

Cobrir:

- defaults explícitos de host, porta e diretórios;
- override por variáveis de ambiente;
- precedência documentada caso argumentos CLI sejam suportados;
- porta inválida falha antes de abrir socket;
- diretório inválido/inacessível falha explicitamente;
- configuração exposta para diagnóstico não contém token, senha, secret, pairing code ou snapshot sensível;
- configuração é normalizada em um único objeto antes do bootstrap.

### Implementação mínima

Criar `loadRuntimeConfig()` retornando configuração normalizada e imutável, incluindo no mínimo:

- `host`;
- `port`;
- `dataDir`;
- `backupDir`;
- `logDir`;
- `instanceName`;
- flags operacionais estritamente necessárias.

Não mover regras de negócio para este módulo.

### Gate

`node --test apps/lan-server/tests/runtime-config.test.mjs`

---

## Tarefa F18.2 — Paths independentes de Electron

**Criar:**
- `apps/lan-server/src/runtime-paths.mjs`
- `apps/lan-server/tests/runtime-paths.test.mjs`

**Modificar somente se necessário:**
- bootstrap atual do banco/servidor para receber paths injetados.

### Testes RED

- banco, backup e logs usam diretórios distintos e determinísticos;
- criação de diretórios é idempotente;
- o Server Core não depende de `electron.app`, `app.getPath()` ou renderer;
- restart com a mesma configuração resolve o mesmo banco e a mesma identidade;
- path inválido não cai silenciosamente para outro diretório.

### Implementação mínima

Criar resolução centralizada de paths. O restante do servidor recebe caminhos já resolvidos por injeção/configuração.

### Gate

`node --test apps/lan-server/tests/runtime-paths.test.mjs`

---

## Tarefa F18.3 — Lifecycle explícito e embeddable

**Criar:**
- `apps/lan-server/src/server-runtime.mjs`
- `apps/lan-server/tests/runtime-lifecycle.test.mjs`

**Modificar:**
- `apps/lan-server/src/index.mjs`

### Testes RED

- `createRuntime()` não inicia socket sozinho;
- `start()` inicia uma única vez;
- segundo `start()` não duplica listener/DB;
- `stop()` encerra listener e banco com segurança;
- segundo `stop()` é seguro;
- erro de bootstrap encerra de forma explícita e não deixa processo parcialmente pronto;
- runtime embeddable não registra signal handlers globais automaticamente;
- entrypoint standalone trata `SIGINT` e `SIGTERM` e chama shutdown gracioso.

### Implementação mínima

Separar:

```text
index.mjs            -> entrypoint/process lifecycle
server-runtime.mjs   -> lifecycle reutilizável
server.mjs           -> API HTTP existente
repository/db        -> persistência existente
```

A extração não deve alterar endpoints de negócio.

### Gate

`node --test apps/lan-server/tests/runtime-lifecycle.test.mjs`

---

## Tarefa F18.4 — Liveness e readiness

**Criar preferencialmente:**
- `apps/lan-server/src/health-service.mjs`
- `apps/lan-server/tests/health-service.test.mjs`
- `apps/lan-server/tests/health-api.test.mjs`

**Modificar:**
- `apps/lan-server/src/server.mjs`

### Contratos

`/health` responde somente que o processo/runtime está vivo e pode expor informações não sensíveis como versão/instance id sanitizado.

`/ready` só retorna pronto quando:

- banco abriu;
- migrations/schema necessários estão íntegros;
- runtime obrigatório está inicializado;
- identidade/estado local obrigatório não está corrompido.

**Internet/Cloud temporariamente offline não torna o servidor automaticamente “not ready”**, porque a arquitetura aprovada suporta operação LAN com último snapshot válido.

### Testes RED

- `/health` funciona sem vazar segredos;
- `/ready` falha enquanto DB/bootstrap não estiver pronto;
- `/ready` passa após bootstrap íntegro;
- Cloud offline temporário não derruba readiness local válida;
- corrupção/erro obrigatório do DB impede readiness;
- payload nunca inclui credenciais, tokens, pairing code ou conteúdo de snapshots.

### Gate

`node --test apps/lan-server/tests/health-service.test.mjs apps/lan-server/tests/health-api.test.mjs`

---

## Tarefa F18.5 — Processo headless real

**Modificar:**
- `apps/lan-server/package.json`
- `apps/lan-server/src/index.mjs`

**Criar:**
- `apps/lan-server/tests/headless-process.test.mjs`

**Somente se o empacotamento exigir:**
- `apps/lan-server/bin/obra-na-mao-server.mjs`

### Teste RED de processo

O teste deve:

1. criar diretório temporário;
2. iniciar o servidor como processo Node sem Electron;
3. aguardar `/ready`;
4. verificar identidade estável;
5. encerrar com `SIGTERM`;
6. confirmar exit limpo;
7. reiniciar usando o mesmo `dataDir`;
8. confirmar mesma identidade e dados preservados.

### Gate

`node --test apps/lan-server/tests/headless-process.test.mjs`

---

## Tarefa F18.6 — Logging e diagnóstico com redaction

**Preflight:** reutilizar logger existente se houver; só criar outro se não houver um contrato reutilizável.

**Criar se necessário:**
- `apps/lan-server/src/runtime-logger.mjs`
- `apps/lan-server/tests/runtime-logging.test.mjs`

### Testes RED

- startup registra versão e estado operacional útil;
- paths/config exibidos são sanitizados;
- token, Authorization, pairing code, senha, secret e conteúdo de snapshot nunca aparecem;
- falha de startup registra causa operacional sem despejar segredo;
- formato funciona tanto em terminal quanto em supervisor (`systemd`/Windows service/Docker).

### Gate

`node --test apps/lan-server/tests/runtime-logging.test.mjs`

---

## Tarefa F18.7 — Gate completo F18

Executar:

```bash
npm --prefix apps/lan-server test
```

Além disso:

- executar testes Desktop relacionados a LAN/data source existentes na branch reconciliável;
- executar `npm test` da raiz quando suportado pelo estado corrente;
- confirmar `DESKTOP_AUTO_RELEASE_ENABLED=false`;
- confirmar que nenhum workflow publicou release/deploy.

### Critério de pronto F18

- Server inicia sem Electron/UI;
- shutdown gracioso;
- paths/config explícitos;
- identidade persiste em restart;
- health/readiness confiáveis;
- API de negócio existente continua verde;
- nenhum novo SyncCoordinator;
- nenhuma alteração de topologia de sync;
- nenhuma dependência paga obrigatória.

---

# GATE R — Reconciliação obrigatória F8–F17

Este gate ocorre **depois de F18 estar verde isoladamente e antes de integrar funcionalidades que dependem dos contratos finais de concorrência/permissões**.

## R.1 — Atualizar heads reais

Reconsultar no GitHub:

- `feat/desktop-lan-server-foundation`;
- `hardening/pr60-security-migration-docs`;
- `feat/lan-f13-f17-hardening-concurrency-permissions-migration`;
- `feat/obra-na-mao-server-platform`.

Não usar SHAs deste plano como se ainda fossem atuais.

## R.2 — Reconciliar conscientemente

Trazer para a plataforma as implementações finais F14–F16 sem apagar o hardening F13/F17 nem F18.

Hotspots esperados:

- `apps/lan-server/src/server.mjs`;
- repository/domain integrity;
- auth/snapshot/cache;
- migrations LAN;
- Desktop server/data-source settings.

Preservar simultaneamente:

- segurança e migração F13/F17;
- `revision`/409 F14;
- granular permissions F15;
- administração/snapshot F16;
- runtime headless F18.

## R.3 — Gate pós-reconciliação

- LAN server completo verde;
- Desktop LAN suites verdes;
- Web/PWA/Cloud tests verdes;
- testes F14 multi-client verdes;
- testes F15 autorização verdes;
- testes F16 snapshot/refresh verdes;
- nenhum deploy/release.

Registrar o **SHA reconciliado congelado** usado como baseline das ondas seguintes.

---

# WAVE 2 — F19/F20: empacotamento de servidor dedicado

## F19 — Windows Server

### Objetivo

Distribuir o mesmo F18 como serviço Windows separado do Desktop, por exemplo `ObraNaMao-Server-Setup.exe`.

### Tarefas

1. Fazer preflight do empacotamento atual Electron/Node e escolher abordagem R$0/open source para serviço Windows.
2. Criar wrapper/supervisor de serviço sem lógica de negócio.
3. Definir diretórios persistentes fora do diretório do executável/upgrade.
4. Instalar auto-start e restart após falha.
5. Criar/desfazer regra de firewall somente para a porta configurada e somente quando o usuário habilitar acesso de rede.
6. Preservar banco/config/instance id em upgrade/uninstall não destrutivo.
7. Adicionar CI Windows de instalação → start → `/ready` → stop → restart → uninstall.

### Critério de pronto

- serviço sobe sem usuário logado;
- reinicia após reboot/falha;
- Desktop local pode usar `localhost`;
- outros Desktops podem usar a LAN quando permitido;
- dados sobrevivem a upgrade do binário.

---

## F20 — Linux Server

### Alvos iniciais

- Ubuntu LTS;
- Debian compatível.

### Arquivos esperados

Criar sob uma árvore de packaging, por exemplo:

- `packaging/linux/obra-na-mao-server.service`
- `packaging/linux/install.sh`
- `packaging/linux/uninstall.sh`
- testes/smokes correspondentes em `apps/lan-server/tests/` ou CI.

### Contrato recomendado

- usuário de serviço dedicado;
- configuração em `/etc/obra-na-mao/`;
- dados em `/var/lib/obra-na-mao/`;
- logs em journald e/ou diretório configurado;
- `Restart=on-failure`;
- shutdown gracioso via `SIGTERM`;
- nenhum requisito de desktop session.

### Gate

Linux CI deve validar install idempotente, start, readiness, restart, persistência e uninstall sem apagar dados por padrão.

---

# WAVE 3 — F22/F23/F24: descoberta, conexão e pareamento

## F22 — Descoberta automática LAN

### UX aprovada

```text
Como este computador deve acessar o Obra na Mão?

○ Usar este computador
○ Encontrar servidor automaticamente
○ Conectar manualmente
```

### Implementação

1. Preflight do componente Desktop atual de configuração do servidor e cliente LAN.
2. Introduzir discovery service isolado (mDNS/DNS-SD ou equivalente aberto), sem colocar discovery dentro da lógica de negócio.
3. Anunciar somente metadados não sensíveis:
   - produto;
   - versão/protocol capability;
   - instance id seguro;
   - nome amigável configurado;
   - endpoint local.
4. Desktop lista servidores encontrados e permite selecionar/conectar.
5. Discovery é LAN-only e nunca vira mecanismo de publicação na Internet.

### Testes

- encontra instância compatível;
- ignora anúncio malformado/incompatível;
- não vaza segredo no anúncio;
- múltiplos servidores aparecem separadamente;
- sair/reentrar na rede atualiza a lista.

---

## F23 — Conexão manual

### Entradas aceitas

- IP local;
- hostname;
- `.local`;
- URL HTTPS remota quando o modo remoto estiver habilitado.

### Fluxo

`informar → testar conexão → validar server identity/capabilities → parear/autenticar → persistir endpoint seguro → reconectar automaticamente`.

### Regras

- nunca confiar apenas no endereço textual; validar identidade/capability do servidor;
- troca inesperada de `ServerInstanceId` deve ser tratada como evento explícito;
- não fazer fallback silencioso para local se o servidor salvo estiver indisponível.

---

## F24 — Pareamento simplificado

Reutilizar F13/F15/F16, não criar ACL paralela.

### Cobertura

- código/token de pareamento one-shot e com expiração;
- credencial individual por dispositivo;
- dispositivo revogado bloqueia imediatamente;
- usuário ainda precisa obedecer membro/channel/modules/permissions;
- host do servidor não recebe Admin automaticamente;
- re-pareamento só quando realmente necessário.

---

# WAVE 4 — F25/F26: remote oficial e transporte seguro

## F25 — Modo `remote` suportado

Promover `remote` de topologia modelada para cenário suportado sem mudar o modelo de dados.

### Regras

- mesmo Server Core;
- mesma API;
- mesma identidade;
- mesmas permissões;
- mesma concorrência;
- mesmo banco central;
- mesmo pipeline Cloud/PWA;
- diferença é transporte/configuração, não business logic.

### Testes

- latência/reconnect não duplica escrita;
- stale revision continua 409;
- revogação continua válida;
- indisponibilidade remota não ativa banco local silenciosamente.

---

## F26 — Transporte remoto seguro

Suportar duas modalidades documentadas:

1. **rede privada/VPN** (ex.: WireGuard self-hosted);
2. **HTTPS com reverse proxy** (ex.: Caddy/nginx self-hosted).

Nenhuma solução paga é obrigatória.

### Requisitos

- TLS obrigatório para endpoint público;
- bind público nunca habilitado silenciosamente;
- documentação de firewall;
- limites/rate limiting em pairing/auth quando expostos remotamente;
- confiança em proxy somente quando configurada;
- nenhum segredo em URL/log;
- exemplos de configuração não podem desabilitar validação TLS para “facilitar”.

---

# WAVE 5 — F27/F28: operação e administração

## F27 — Backup operacional automático

**Reutilizar o motor F13. Não criar segundo engine de backup.**

Adicionar somente camada operacional:

- scheduler configurável;
- retenção;
- backup pré-upgrade;
- backup pré-migração já referenciado por F17;
- `integrity_check`/manifest existentes;
- status do último backup;
- falha visível em diagnóstico.

Política padrão deve ser conservadora e configurável; nenhuma cópia em serviço pago obrigatória.

---

## F28 — Administração operacional do Server

Criar superfície mínima e autenticada para:

- versão;
- server instance id;
- readiness;
- estado do banco;
- clientes conectados;
- último backup;
- estado do sync;
- idade do snapshot de autorização;
- diagnóstico/logs redigidos;
- `backup now`.

Não criar editor local de permissões de negócio. F16/Cloud continua autoridade.

Ação de restart deve ser delegada ao supervisor (`systemd`/Windows service/Docker), não simulada por lógica de negócio dentro do processo.

---

# WAVE 6 — F29/F30: setup e migração assistida

## F29 — Assistente de instalação/configuração

Server:

1. identificação;
2. empresa/claim;
3. armazenamento;
4. rede;
5. backup;
6. segurança;
7. resumo/finalização.

Desktop:

- Usar este computador;
- Encontrar servidor automaticamente;
- Conectar manualmente.

Não esconder detalhes críticos de segurança atrás de defaults perigosos.

---

## F30 — Migração assistida

**Reutilizar integralmente o `ModuleMigrationService`/F17.**

A UI apenas orquestra e apresenta:

`backup → core → operation → planning → finance → rh → validação → central-active`.

### Testes

- dependentes bloqueados até `core` ativo;
- falha preserva local/migration-required;
- retry é idempotente;
- nenhum dado local é deletado silenciosamente;
- status de cada módulo é exibido corretamente.

---

# WAVE 7 — F31: QA multiplataforma

## Matriz mínima

| Server | Desktop | Transporte |
|---|---|---|
| Windows | Windows | LAN |
| Linux | Windows | LAN |
| Linux | Windows | remoto seguro |
| Windows | Windows | remoto seguro quando suportado |

Após F21, adicionar Docker/Linux à matriz.

## Cenários obrigatórios

- 1 cliente;
- 2 clientes concorrentes;
- 5+ clientes para smoke de conexão;
- edição stale → 409;
- permissões `view/create/edit/delete/approve`;
- revogação de device;
- restart do Server;
- queda e retorno da rede;
- reboot do host;
- backup + restore;
- migração de instalação existente;
- falha/retry de migração;
- Cloud temporariamente offline;
- retorno do sync Cloud/PWA;
- nenhum segundo SyncCoordinator;
- nenhum fallback local silencioso.

Todos os gates finais devem usar o **mesmo SHA candidato**.

---

# WAVE 8 — F32: Everton como primeira homologação real

Everton é implantação, não fork.

### Checklist

1. instalar pacote Linux genérico;
2. configurar supervisor e storage;
3. configurar transporte remoto seguro;
4. claim da empresa;
5. executar backup inicial;
6. migrar dados existentes via F17/F30;
7. conectar pelo menos dois Desktops reais;
8. validar concorrência/permissões;
9. simular restart e indisponibilidade;
10. validar backup/restore;
11. validar Cloud/PWA;
12. registrar qualquer correção no produto genérico.

Nenhum ajuste entra com nome/ID/domínio hard-coded do Everton.

---

# WAVE 9 — F21: Docker

Docker entra **depois da primeira homologação Linux**, para evitar adicionar formato de distribuição antes de provar a independência do Server Core.

### Criar

- `Dockerfile` dedicado ao Server;
- `docker-compose.example.yml`;
- healthcheck baseado em `/health`/`/ready`;
- documentação de volumes/configuração.

### Regras

- processo não-root quando tecnicamente possível;
- `/data` e `/backup` persistentes;
- nenhuma lógica de negócio específica de container;
- restart preserva identidade/dados;
- secrets por arquivo/env segura, nunca bakeados na imagem.

### Gate

build → start → ready → create/read data → restart container → data/instance id preservados → backup smoke.

---

# WAVE 10 — F33: release oficial da plataforma Server

Artefatos previstos:

- Desktop Windows existente;
- Server Windows;
- Server Linux;
- imagem Docker após F21.

## Release gate

Antes de qualquer publicação:

1. congelar SHA candidato;
2. CI Windows verde no mesmo SHA;
3. CI Linux verde no mesmo SHA;
4. LAN suite verde;
5. Desktop suite verde;
6. Web/PWA/Cloud regressions verdes;
7. QA físico/real da instalação candidato concluído;
8. documentação de instalação/backup/restore/recovery atualizada;
9. `DESKTOP_AUTO_RELEASE_ENABLED=false` confirmado;
10. `Publish GitHub release` continua skipped até autorização explícita.

**Este plano não autoriza release.**

---

# 4. Definition of Done global

A plataforma Server só pode ser considerada concluída quando:

1. `apps/lan-server` executa headless fora do Electron;
2. o mesmo Server Core roda em Windows, Linux e Docker sem forks de business logic;
3. Desktop pode usar local, descobrir automaticamente LAN ou conectar manualmente;
4. endpoint salvo reconecta automaticamente sem esconder troca de identidade;
5. pareamento e revogação continuam seguros;
6. remoto funciona por transporte seguro sem exposição insegura automática;
7. F13/F17 continuam responsáveis por backup/migração e não são duplicados;
8. F14 continua impedindo sobrescrita stale;
9. F15/F16 continuam sendo a única política granular/autoridade administrativa;
10. Cloud/PWA continuam pelo pipeline de sync existente;
11. QA cobre Windows/Linux/remoto e, depois, Docker;
12. Everton é apenas primeira homologação;
13. nenhum serviço pago é obrigatório para o core;
14. nenhum merge/deploy/release ocorreu sem autorização explícita.

# 5. Próximo passo após aprovação deste plano

Começar **somente pela WAVE 1 / F18.1**, usando TDD. Não iniciar F19+ em paralelo antes de F18 estar verde e revisado.

Após F18, executar o **GATE R** de reconciliação antes de avançar nas integrações dependentes de F14–F16.
