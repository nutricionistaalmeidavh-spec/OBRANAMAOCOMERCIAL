# Obra na Mão Server Platform — Implementation Plan

> **Para execução:** seguir TDD tarefa por tarefa e verificar o branch completo antes de considerar uma fase concluída.

**Data:** 2026-10-01  
**Branch:** `feat/obra-na-mao-server-platform`  
**Spec:** `docs/superpowers/specs/2026-10-01-obra-na-mao-server-platform-design.md`  
**Baseline oficial:** `main` com F8–F17 integradas  
**Baseline verificada:** `6069e8d603fe28d49a2063c04fd9b8fd8d3286ca`

## Objetivo

Transformar `apps/lan-server` no Server Core headless e genérico do Obra na Mão, preservando integralmente os contratos de F8–F17 e evoluindo depois para Windows Service, Linux, Docker, descoberta LAN e modo remoto seguro.

## Regras globais

- `main` é a única baseline das fases anteriores.
- Não carregar branches F13–F17/F14–F16 como base paralela.
- Não reimplementar F8–F17.
- Não criar backend ou `SyncCoordinator` paralelos.
- Não alterar comportamento de concorrência/permissões/migração/backup sem necessidade direta da plataforma.
- Não fazer fallback silencioso para SQLite local.
- Núcleo R$0/self-hosted/open source.
- `DESKTOP_AUTO_RELEASE_ENABLED=false`.
- Sem merge em `main`, deploy, release ou auto-update sem autorização explícita.
- Nenhum código específico para Everton.

---

# WAVE 1 — F18 Server Core headless

## F18.1 — Runtime config

**Arquivos**
- `apps/lan-server/src/runtime-config.mjs`
- `apps/lan-server/tests/runtime-config.test.mjs`
- `apps/lan-server/src/index.mjs`

**Contrato**
- defaults compatíveis com instalação atual;
- `OBRA_NA_MAO_SERVER_*` com fallback para `OBRA_NA_MAO_LAN_*`;
- porta inválida falha antes do socket;
- diagnóstico por allowlist, sem segredos.

**Gate**
`node --test apps/lan-server/tests/runtime-config.test.mjs`

## F18.2 — Runtime paths

**Arquivos**
- `apps/lan-server/src/runtime-paths.mjs`
- `apps/lan-server/tests/runtime-paths.test.mjs`

**Contrato**
- data/backup/logs explícitos e determinísticos;
- DB continua no mesmo path compatível;
- sem Electron;
- criação idempotente;
- path inválido falha explicitamente.

**Gate**
`node --test apps/lan-server/tests/runtime-paths.test.mjs`

## F18.3 — Lifecycle embeddable

**Arquivos**
- `apps/lan-server/src/server-runtime.mjs`
- `apps/lan-server/tests/runtime-lifecycle.test.mjs`
- `apps/lan-server/src/index.mjs`

**Contrato**
- `createRuntime()` não inicia sozinho;
- `start()` e `stop()` idempotentes;
- cleanup em falha de bootstrap/listen;
- signal handlers somente no entrypoint standalone;
- nenhuma alteração em endpoints de negócio.

**Gate**
`node --test apps/lan-server/tests/runtime-lifecycle.test.mjs`

## F18.4 — Readiness

**Arquivos**
- `apps/lan-server/src/health-service.mjs`
- `apps/lan-server/src/readiness-route.mjs`
- `apps/lan-server/tests/health-service.test.mjs`
- `apps/lan-server/tests/readiness-route.test.mjs`
- `apps/lan-server/src/index.mjs`

**Contrato**
- `/health` existente permanece inalterado;
- `/ready` = DB acessível + integridade + schema + identidade local válida;
- Cloud offline temporária não torna servidor indisponível;
- 200 ready / 503 not_ready;
- sem filesystem/secrets/snapshots no payload.

## F18.5 — Processo headless real

**Criar**
- `apps/lan-server/tests/headless-process.test.mjs`

**Modificar somente se necessário**
- `apps/lan-server/package.json`
- entrypoint do `apps/lan-server`.

**Teste**
1. criar `dataDir` temporário;
2. spawnar Node sem Electron;
3. aguardar `/ready`;
4. salvar/observar identidade estável;
5. SIGTERM;
6. confirmar exit limpo;
7. reiniciar com mesmo `dataDir`;
8. confirmar mesma identidade/banco.

## F18.6 — Logging/redaction

**Criar se necessário**
- `apps/lan-server/src/runtime-logger.mjs`
- `apps/lan-server/tests/runtime-logging.test.mjs`

**Contrato**
- logs úteis para terminal/systemd/Windows Service/Docker;
- nunca registrar bearer token, setup/pairing code, password, secret ou conteúdo de snapshot;
- erro de startup mantém causa operacional sem vazar segredo.

## F18.7 — Gate final

Executar no mesmo SHA:
- suíte completa `apps/lan-server`;
- Desktop tests/lint;
- Windows CI;
- macOS CI;
- Cloudflare/Web CI;
- verificar release skipped e production jobs não executados.

**F18 pronta quando**
- processo funciona sem Electron/UI;
- restart preserva DB/identidade;
- shutdown é limpo;
- config/paths/readiness/logging estão explícitos;
- F8–F17 continuam verdes;
- diff contra `main` contém somente Server Platform/documentação correspondente.

---

# WAVE 2 — F19/F20

## F19 Windows Server
- empacotar F18 como serviço Windows;
- auto-start/restart;
- diretórios persistentes;
- firewall mínimo opt-in;
- upgrade/uninstall não destrutivo;
- smoke install → ready → restart → uninstall.

## F20 Linux Server
- Ubuntu LTS/Debian;
- systemd;
- usuário de serviço;
- `/etc/obra-na-mao` + `/var/lib/obra-na-mao`;
- `Restart=on-failure`;
- smoke de instalação/restart/persistência.

---

# WAVE 3 — F22/F23/F24

## F22 Descoberta LAN
- serviço isolado mDNS/DNS-SD ou equivalente aberto;
- anunciar apenas metadados não sensíveis;
- discovery nunca autoriza.

## F23 Conexão manual
- IP/hostname/HTTPS;
- testar endpoint/identidade/capabilities antes de salvar;
- persistir serverInstanceId + endpoint seguro;
- não trocar silenciosamente de instância.

## F24 Pareamento/reconexão
- reutilizar claim/device/member/revocation de F8–F17;
- reconectar sem re-pair quando credencial válida;
- revogação aplica imediatamente.

---

# WAVE 4 — F25/F26

## F25 Remote
- tornar `remote` topologia suportada oficialmente;
- mesma API/schema/auth/permissões/sync;
- apenas transporte/endereço/timeout variam.

## F26 Transporte seguro
- WireGuard self-hosted e/ou HTTPS + reverse proxy;
- TLS válido;
- firewall mínimo;
- nada público inseguro por padrão;
- sem fornecedor pago obrigatório.

---

# WAVE 5 — F27/F28/F29/F30

## F27 Backup operacional
Consumir F13/F17 para agenda, retenção, integridade, pré-upgrade e restore testável.

## F28 Administração
Status/version/readiness/backup/devices/sync/capabilities; permissões continuam Cloud/F16.

## F29 Assistente
Servidor: identificação → claim → storage → rede → backup → segurança → validação.  
Desktop: local / encontrar automaticamente / conectar manualmente.

## F30 Migração assistida
UX sobre F17; não criar outro motor de migração.

---

# WAVE 6 — F31/F32/F21/F33

## F31 QA multiplataforma
Windows/Linux/Docker × LAN/remote, 1/2/5 clientes, F14, F15/F16, F17, backup/restore, reconnect e Cloud/PWA.

## F32 Everton
Primeira implantação/homologação real; qualquer correção volta ao produto genérico.

## F21 Docker
Criar imagem depois de F18/F20 comprovados; volumes persistentes `/data` e `/backup`.

## F33 Release
Produzir artefatos oficiais somente depois dos gates e mediante autorização explícita.
