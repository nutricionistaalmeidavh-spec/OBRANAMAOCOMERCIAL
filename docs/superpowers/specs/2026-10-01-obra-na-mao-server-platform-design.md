# Obra na Mão Server Platform — F18–F33

**Data:** 2026-10-01  
**Status:** aprovado / em implementação  
**Branch:** `feat/obra-na-mao-server-platform`  
**Baseline oficial:** `main` após integração F8–F17  
**Baseline verificada:** `6069e8d603fe28d49a2063c04fd9b8fd8d3286ca`

## 1. Objetivo

Transformar o servidor central já existente em `apps/lan-server` no **Obra na Mão Server** genérico, headless e reutilizável, capaz de atender clientes distintos por configuração e implantação, sem código específico por cliente.

Everton será a primeira implantação/homologação real, não uma variante do produto.

## 2. Baseline obrigatória

F8–F17 já fazem parte da `main` e são contratos consumidos por esta plataforma:

- F8–F12: fonte central, sync único, operação, planejamento, financeiro e RH;
- F13: hardening, integridade e backup/restore central;
- F14: concorrência otimista e conflitos `409`;
- F15: permissões granulares;
- F16: administração Cloud das permissões;
- F17: migração local → central segura e idempotente.

F18+ **não reimplementa nem reconcilia essas fases**. Qualquer mudança nelas só é admissível quando necessária para compatibilidade direta com a plataforma e deve preservar seus testes/contratos.

## 3. Restrições inegociáveis

1. Evoluir `apps/lan-server`; não criar backend paralelo.
2. Manter um único `SyncCoordinator`.
3. `lan-client` nunca inicia sync central.
4. Nunca compartilhar SQLite diretamente pela rede.
5. Nunca fazer fallback silencioso para SQLite local quando servidor central estiver configurado.
6. Preservar autenticação, claim, revogação, snapshots, backup/migração, concorrência e permissões de F8–F17.
7. Núcleo obrigatório R$0/self-hosted/open source; serviço pago somente opcional.
8. `DESKTOP_AUTO_RELEASE_ENABLED=false` permanece até autorização explícita.
9. Nenhum deploy, release ou auto-update neste workstream sem autorização explícita.
10. Nenhum `if (cliente === "Everton")` ou equivalente.
11. Diferenças entre clientes são configuração/infraestrutura, não forks.
12. Modo remoto nunca significa exposição pública insegura por padrão.

## 4. Arquitetura alvo

```text
                 Obra na Mão Server Core
                           │
              ┌────────────┼────────────┐
              │            │            │
           Windows       Linux       Docker
              │            │            │
              └────────────┼────────────┘
                           │
                    API autenticada
                           │
                  Desktop Clients
                           │
                  SyncCoordinator único
                           │
                   Cloudflare/D1 ↔ PWA
```

O mesmo Server Core atende LAN ou remoto. Transporte, endereço e empacotamento variam; schema, API de negócio, permissões e sync não.

## 5. F18 — Server Core headless

Objetivo: executar `apps/lan-server` como processo independente, sem Electron/UI.

Entregas:
- configuração normalizada por ambiente;
- compatibilidade com variáveis `OBRA_NA_MAO_LAN_*` existentes;
- aliases genéricos `OBRA_NA_MAO_SERVER_*`;
- paths persistentes independentes do Electron;
- lifecycle reutilizável `start/stop`;
- graceful shutdown;
- `/health` existente preservado;
- `/ready` para storage/schema/identidade local;
- processo Node headless real e reiniciável;
- logging/redaction apropriado a terminal/systemd/Windows Service/Docker;
- regressão completa F8–F17 verde.

Não fazer em F18:
- novo repository layer;
- nova API de negócio;
- novo banco;
- novo SyncCoordinator;
- alteração funcional de permissões, concorrência, backup ou migração.

## 6. Configuração

Parâmetros genéricos previstos:

```text
OBRA_NA_MAO_SERVER_HOST
OBRA_NA_MAO_SERVER_PORT
OBRA_NA_MAO_SERVER_DATA_DIR
OBRA_NA_MAO_SERVER_BACKUP_DIR
OBRA_NA_MAO_SERVER_LOG_DIR
OBRA_NA_MAO_SERVER_INSTANCE_NAME
```

Os aliases antigos `OBRA_NA_MAO_LAN_*` continuam válidos durante a transição. Segredos não são versionados nem expostos em diagnóstico.

## 7. F19 — Windows Server

Empacotar o mesmo F18 como serviço Windows separado do Desktop:
- auto-start;
- restart após falha;
- dados fora do diretório do binário;
- firewall mínimo e explícito;
- upgrade sem apagar dados;
- Desktop local pode usar loopback.

## 8. F20 — Linux Server

Alvos iniciais: Ubuntu LTS e Debian compatível.

- `systemd`;
- usuário de serviço sem privilégios desnecessários;
- configuração em `/etc/obra-na-mao/`;
- dados em `/var/lib/obra-na-mao/`;
- logs via journald e/ou path configurado;
- `Restart=on-failure`;
- shutdown limpo por `SIGTERM`.

## 9. F21 — Docker

Imagem do mesmo Server Core, depois de Windows/Linux comprovarem o runtime headless.

Volumes persistentes mínimos:
- `/data`;
- `/backup`.

Nenhum estado crítico fora dos volumes.

## 10. F22 — Descoberta automática LAN

UX:

```text
Como este computador deve acessar o Obra na Mão?

○ Usar este computador
○ Encontrar servidor automaticamente
○ Conectar manualmente
```

Descoberta preferencial via mDNS/DNS-SD ou equivalente aberto. Descobrir nunca autoriza: autenticação/pareamento continuam obrigatórios.

## 11. F23 — Conexão manual

Aceitar IP, hostname e URL segura. Fluxo:

```text
endereço → testar → identidade/capabilities → autenticar → parear → salvar referência segura
```

Depois do primeiro pareamento, reconectar automaticamente ao servidor conhecido. Não trocar silenciosamente para outra instância descoberta.

## 12. F24 — Pareamento/reconexão

Reutilizar identidade, credenciais individuais, membros e revogação de F8–F17. Nenhuma ACL paralela no Server.

## 13. F25 — Modo remote oficial

Topologias suportadas:
- `local`;
- `lan-host`;
- `lan-client`;
- `remote`.

`remote` usa o mesmo contrato central. Só podem variar endpoint, transporte, timeout e política de descoberta.

## 14. F26 — Transporte remoto seguro

Suportar implantação self-hosted por:
- rede privada (ex.: WireGuard);
- HTTPS com TLS válido + reverse proxy.

Sem HTTP público inseguro por padrão. Sem fornecedor pago obrigatório.

## 15. F27 — Backup operacional

Consumir os mecanismos prontos de F13/F17 e adicionar:
- agenda;
- retenção;
- integridade;
- registro de sucesso/falha;
- backup pré-upgrade;
- restore testável.

## 16. F28 — Administração do servidor

CLI/endpoint/UI protegida para status operacional:
- readiness/uptime/versão;
- integridade do banco;
- último backup;
- dispositivos conectados quando disponível;
- estado do sync;
- capabilities.

Permissões de usuários continuam administradas pela autoridade Cloud de F16.

## 17. F29 — Assistente de instalação

Servidor: identificação → empresa/claim → armazenamento → rede → backup → segurança → validação.

Desktop: usar este computador / encontrar automaticamente / conectar manualmente.

## 18. F30 — Migração assistida

Consumir F17, sem reimplementá-la. UX orienta backup obrigatório e sequência `core → operation → planning → finance → rh → validação → central-active`.

## 19. F31 — QA multiplataforma

Matriz mínima:
- Windows Server + Windows Desktop / LAN;
- Linux Server + Windows Desktop / LAN;
- Docker/Linux + Windows Desktop / LAN;
- Linux + Windows Desktop / remote;
- Docker/VPS + Windows Desktop / remote.

Cobrir 1/2/5 clientes, concorrência F14, permissões F15/F16, restart, queda/reconexão, revogação, migração F17, backup/restore, Cloud/PWA e ausência de fallback local.

## 20. F32 — Everton

Primeira homologação real da plataforma genérica. Configuração específica pode envolver distro, rede, DNS/IP, WireGuard/HTTPS e rotina de backup; nunca lógica específica no código.

## 21. F33 — Release oficial

Artefatos previstos após todos os gates:
- Desktop Windows;
- Server Windows;
- Server Linux;
- imagem Docker.

Publicação continua bloqueada até autorização explícita.

## 22. Ordem de execução

```text
main F8–F17
   ↓
F18 headless
   ↓
F19 Windows + F20 Linux
   ↓
F22 descoberta + F23 conexão + F24 pareamento
   ↓
F25 remote + F26 transporte seguro
   ↓
F27 backup ops + F28 admin + F29 onboarding + F30 migração assistida
   ↓
F31 QA
   ↓
F32 Everton
   ↓
F21 Docker
   ↓
F33 release controlado
```
