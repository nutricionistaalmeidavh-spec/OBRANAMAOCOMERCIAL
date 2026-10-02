# F19/F20 — Obra na Mão Server Packaging Design

**Data:** 2026-10-01  
**Branch:** `feat/server-windows-linux-packaging`  
**Base:** `0af4a79c04d27221e5d361c4563b94a4767a7b1d` (`feat/obra-na-mao-server-platform`, F18 validada)  
**Escopo:** F19 Windows Server + F20 Linux Server  

## 1. Objetivo

Transformar o Server Core headless da F18 em um produto instalável e operável como serviço de sistema em Windows e Linux, sem criar outro backend, sem duplicar lógica de negócio e sem código específico por cliente.

O mesmo `apps/lan-server/src/index.mjs` continua sendo o runtime do produto. F19/F20 adicionam somente empacotamento, serviço do SO, configuração, lifecycle operacional, upgrade e uninstall seguros.

## 2. Restrições não negociáveis

- F18 permanece a fonte única do runtime headless.
- F8–F17 permanecem intactas.
- Não criar segundo `SyncCoordinator`, segunda API, segunda base SQLite ou ACL local paralela.
- Não adicionar dependência paga obrigatória.
- Runtime deve funcionar sem Electron e sem Node previamente instalado pelo cliente.
- Dados, backup, logs e configuração ficam fora do diretório de binários.
- Upgrade nunca apaga DB/config/backup.
- Uninstall preserva dados/config por padrão.
- Purge destrutivo só pode existir como ação explícita e separada.
- Firewall nunca é aberto silenciosamente.
- Setup code continua oculto em logs por padrão.
- `DESKTOP_AUTO_RELEASE_ENABLED=false` permanece.
- Nenhum merge, deploy, release ou auto-update sem autorização explícita.
- Nenhum `if (cliente === 'Everton')` ou equivalente.

## 3. Alternativas consideradas

### A. Exigir Node instalado no cliente

**Vantagem:** pacote pequeno.  
**Problema:** cria dependência operacional externa, diferenças de versão e suporte adicional.  
**Decisão:** rejeitado.

### B. Criar executável único com empacotador Node

**Vantagem:** distribuição aparentemente simples.  
**Problema:** `node:sqlite`, migrations, assets e compatibilidade de runtime tornam o empacotamento mais opaco; dificulta diagnóstico e atualização incremental.  
**Decisão:** não usar nesta fase.

### C. Bundle self-contained com Node oficial + Server Core + wrapper do SO

**Vantagens:** runtime reproduzível, zero requisito prévio no cliente, mantém o código F18 inalterado e permite Windows/Linux compartilharem o mesmo layout.  
**Decisão:** **abordagem escolhida**.

## 4. Layout comum do pacote

O build gera uma árvore intermediária comum:

```text
server-package/
  app/
    src/
    migrations/
    package.json
  runtime/
    node[.exe]
  metadata/
    build.json
  platform/
    ... arquivos específicos do SO ...
```

`build.json` deve registrar apenas metadados não sensíveis:

- versão do produto;
- commit SHA;
- versão Node;
- plataforma/arquitetura;
- timestamp de build.

Nenhuma credencial, token, setup code ou snapshot entra no artefato.

## 5. Configuração compartilhada

F19/F20 usam as mesmas variáveis já criadas na F18:

- `OBRA_NA_MAO_SERVER_HOST`
- `OBRA_NA_MAO_SERVER_PORT`
- `OBRA_NA_MAO_SERVER_DATA_DIR`
- `OBRA_NA_MAO_SERVER_BACKUP_DIR`
- `OBRA_NA_MAO_SERVER_LOG_DIR`
- `OBRA_NA_MAO_SERVER_INSTANCE_NAME`
- `OBRA_NA_MAO_PLATFORM_URL`
- `OBRA_NA_MAO_SERVER_SHOW_SETUP_CODE`

Não criar nomes paralelos por sistema operacional.

## 6. F19 — Windows Server

### 6.1 Runtime

Pacote x64 inicialmente, contendo:

- Node da versão fixada pelo repositório;
- Server Core F18;
- migrations;
- wrapper Windows Service open-source e versionado/pinado;
- configuração do serviço;
- instalador Inno Setup.

O cliente não precisa instalar Node, npm, Electron ou Git.

### 6.2 Windows Service

Nome interno sugerido:

`ObraNaMaoServer`

Display name:

`Obra na Mão Server`

Propriedades:

- startup automático;
- restart automático em falha;
- graceful stop encaminhando término ao processo Node;
- working directory somente leitura para binários;
- stdout/stderr direcionados a logs operacionais com rotação do wrapper quando aplicável;
- usuário de serviço de baixo privilégio, com escrita somente nos diretórios necessários.

O wrapper não contém lógica de negócio.

### 6.3 Paths Windows

Binários:

```text
%ProgramFiles%\ArtiSys\Obra na Mão Server\
```

Estado persistente:

```text
%ProgramData%\ArtiSys\Obra na Mão Server\
  config\
  data\
  backups\
  logs\
```

Configuração inicial deve apontar F18 para esses paths.

### 6.4 Instalador

O instalador deve:

1. detectar arquitetura suportada;
2. parar serviço existente em upgrade;
3. instalar/substituir apenas binários;
4. criar configuração somente se ainda não existir;
5. preservar `ProgramData` integralmente em upgrade;
6. registrar serviço;
7. iniciar serviço;
8. aguardar `/ready` local;
9. falhar explicitamente se o serviço não ficar ready;
10. oferecer abertura de firewall **opt-in**.

### 6.5 Firewall Windows

Se o usuário marcar acesso LAN:

- regra inbound TCP somente para a porta configurada;
- escopo padrão `LocalSubnet`;
- regra identificável e removível pelo produto;
- nenhuma regra pública/Any por padrão.

Se não marcar, o servidor continua acessível apenas conforme regras existentes do SO.

### 6.6 Upgrade

Upgrade deve preservar:

- DB;
- identidade do servidor;
- device credentials persistidos na base;
- snapshots;
- backups;
- configuração;
- logs existentes.

Fluxo:

```text
stop service
→ safety check
→ replace binaries
→ preserve config/data
→ start service
→ wait /ready
→ if startup fails, report failure without deleting persisted state
```

Rollback binário automatizado pode ser adicionado depois; não é requisito para F19 se os dados nunca forem modificados pelo instalador.

### 6.7 Uninstall

Por padrão:

- parar/remover serviço;
- remover binários;
- remover regra de firewall criada pelo produto;
- **preservar `%ProgramData%`**.

Purge deve exigir ferramenta/flag separada e confirmação explícita; não deve ser default do uninstall.

## 7. F20 — Linux Server

### 7.1 Distribuições suportadas

Primeiro alvo oficial:

- Ubuntu LTS;
- Debian stable;
- arquitetura amd64.

ARM64 e NAS ficam para validação posterior/Docker F21.

### 7.2 Runtime

Bundle self-contained:

```text
/opt/obra-na-mao/server/
  app/
  runtime/node
  metadata/
```

Não exigir Node global.

### 7.3 Paths Linux

Config:

```text
/etc/obra-na-mao/server.env
```

Dados:

```text
/var/lib/obra-na-mao/
```

Backups:

```text
/var/lib/obra-na-mao/backups/
```

Logs de aplicação persistentes, quando usados:

```text
/var/log/obra-na-mao/
```

Logs de serviço também ficam disponíveis no journald.

### 7.4 Usuário do serviço

Criar usuário de sistema sem shell/login:

`obra-na-mao`

Permissões:

- leitura do runtime `/opt`;
- leitura da configuração;
- escrita apenas em data/backups/logs;
- sem sudo;
- sem home funcional.

### 7.5 systemd

Unit sugerida:

`obra-na-mao-server.service`

Contrato:

- `EnvironmentFile=/etc/obra-na-mao/server.env`;
- `ExecStart` usando o Node empacotado;
- `Restart=on-failure`;
- `RestartSec` explícito;
- graceful SIGTERM;
- `NoNewPrivileges=true`;
- hardening compatível com escrita somente nos paths persistentes;
- network outbound permitido para Cloud authority/sync;
- não depender de interface gráfica.

### 7.6 Instalação

Script idempotente executado como root/sudo:

1. validar distro/arquitetura;
2. criar usuário/grupo se necessário;
3. parar serviço se já instalado;
4. copiar binários para `/opt`;
5. criar `/etc/obra-na-mao/server.env` somente se ausente;
6. criar paths persistentes com ownership correto;
7. instalar/atualizar unit systemd;
8. `daemon-reload`;
9. enable/start;
10. aguardar `/ready` local;
11. falhar claramente em erro.

### 7.7 Upgrade

Mesmo princípio do Windows:

- substituir somente `/opt/obra-na-mao/server`;
- preservar `/etc/obra-na-mao`;
- preservar `/var/lib/obra-na-mao`;
- preservar backups;
- reiniciar e validar `/ready`.

### 7.8 Uninstall

Default:

- disable/stop;
- remover unit;
- remover runtime `/opt`;
- preservar config/data/backups.

Purge de dados somente com flag explícita separada.

### 7.9 Firewall Linux

F20 não altera firewall automaticamente.

A instalação deve apenas informar a porta escutada. Regras `ufw`/`nftables` ficam opt-in/documentadas até F26, quando o transporte seguro remoto será definido.

## 8. Build scripts

Criar scripts versionados no repo para gerar os artefatos de forma reproduzível.

Estrutura proposta:

```text
apps/lan-server/packaging/
  common/
    build-package.mjs
    package-manifest.mjs
  windows/
    build.ps1
    service.xml
    installer.iss
  linux/
    build.sh
    install.sh
    uninstall.sh
    obra-na-mao-server.service
```

O build deve obter a versão Node da `.nvmrc` e fixar/checksumar dependências baixadas durante build.

Downloads de build não podem introduzir dependência online em runtime.

## 9. Testes — TDD

### 9.1 Testes comuns

- layout gerado contém somente arquivos allowlisted;
- `build.json` possui SHA/version/platform sem segredo;
- runtime empacotado aponta para o mesmo `src/index.mjs` F18;
- nenhum pacote contém path absoluto da máquina de CI;
- config default usa paths corretos do SO.

### 9.2 Windows

Smoke no CI Windows:

```text
build package
→ install silencioso em diretório de teste/VM runner
→ service running
→ GET /ready = 200
→ capturar serverId
→ restart service
→ GET /ready = 200
→ serverId igual
→ criar sentinel persistente
→ executar upgrade/reinstall
→ sentinel + DB preservados
→ uninstall
→ serviço removido
→ persisted state preservado
```

Validar também:

- firewall só é criado no modo opt-in;
- uninstall remove apenas regra criada pelo produto;
- release não é publicado.

### 9.3 Linux

Smoke no CI Ubuntu:

```text
build tarball
→ verificar unit com systemd-analyze
→ instalar
→ systemctl active
→ GET /ready = 200
→ capturar serverId
→ restart
→ identidade preservada
→ upgrade/reinstall
→ DB/config preservados
→ uninstall
→ runtime removido
→ data/config preservados
```

Se o runner não permitir lifecycle real de systemd, `systemd-analyze verify` continua obrigatório e o lifecycle é exercitado em container/VM apropriado; F20 não é considerada concluída sem pelo menos um ambiente real com systemd.

## 10. CI

Adicionar workflow dedicado, sem release:

`.github/workflows/server-platform-ci.yml`

Matriz mínima:

- Windows Server/Windows latest;
- Ubuntu latest.

Etapas:

1. checkout;
2. setup das ferramentas de build;
3. LAN server tests;
4. packaging tests;
5. build do artefato;
6. smoke de instalação;
7. upload do artefato **somente como CI artifact**;
8. nenhum GitHub Release.

O workflow Desktop existente continua rodando quando paths compartilhados exigirem.

## 11. Segurança

- Wrapper/installer nunca imprime setup code por padrão.
- Config não deve conter bearer/device/server token.
- Tokens continuam somente no DB/fluxos F8–F17.
- Diretórios persistentes recebem ACL/permissions mínimas.
- Windows firewall opt-in `LocalSubnet`.
- Linux não abre firewall automaticamente.
- Serviço não roda como administrador/root após instalação.
- Artefatos de build devem ter hashes/checksums.
- Dependências externas do build devem ser pinadas e verificadas.

## 12. Compatibilidade

F19/F20 não mudam:

- API LAN;
- schema SQLite;
- migrations F17;
- F13 backup/restore;
- F14 revision/concurrency;
- F15 permissions;
- F16 Cloud authority/admin;
- Desktop local/lan-host/lan-client;
- Web/PWA/Cloudflare.

A diferença entre Windows e Linux deve ser somente operacional:

```text
mesmo Server Core
+ mesmo DB
+ mesma API
+ mesma auth
+ mesma sync
+ launcher/serviço/configuração do SO diferentes
```

## 13. Critérios de aceite F19

F19 está pronta quando:

- instalação Windows não exige Node instalado;
- serviço inicia automaticamente;
- recovery em falha está configurado;
- `/ready` passa após install e restart;
- DB/serverId persistem em restart e upgrade;
- uninstall preserva dados;
- firewall só abre mediante opt-in;
- CI Windows verde no mesmo SHA;
- nenhuma release é publicada.

## 14. Critérios de aceite F20

F20 está pronta quando:

- instalação Ubuntu/Debian amd64 não exige Node instalado;
- serviço roda como usuário `obra-na-mao`;
- systemd enable/start/restart funciona;
- `/ready` passa após install e restart;
- DB/serverId persistem em restart e upgrade;
- uninstall preserva dados/config;
- unit passa hardening/verify;
- CI Linux verde no mesmo SHA;
- nenhuma release é publicada.

## 15. Fora de escopo

- descoberta LAN (F22);
- UI de conexão manual (F23);
- pareamento UX/reconnect (F24);
- servidor remoto público (F25);
- WireGuard/TLS/reverse proxy (F26);
- scheduler de backup (F27);
- painel operacional (F28);
- assistente gráfico (F29);
- migração assistida UX (F30);
- Docker (F21, depois de Linux comprovado);
- implantação Everton (F32);
- publicação de release (F33).

## 16. Sequência de implementação após aprovação desta spec

1. F19 packaging tests primeiro;
2. F19 bundle self-contained;
3. F19 Windows Service;
4. F19 Inno installer + upgrade/uninstall safety;
5. F19 CI/smoke;
6. F20 packaging tests;
7. F20 bundle Linux;
8. F20 systemd/install/uninstall;
9. F20 CI/smoke;
10. gate integrado F18+F19+F20 no mesmo SHA.
