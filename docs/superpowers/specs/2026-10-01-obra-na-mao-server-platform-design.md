# Obra na Mão Server Platform — F18–F33

**Data:** 2026-10-01  
**Status:** desenho arquitetural para revisão  
**Branch:** `feat/obra-na-mao-server-platform`  
**Base inicial:** `34181a2b911d95eefbabf78fbe67d78e84321210` (`hardening/pr60-security-migration-docs`)  
**Integração obrigatória antes do gate final:** F8–F17 completos e reconciliados  

## 1. Objetivo

Transformar o servidor central já existente em `apps/lan-server` em um produto genérico, headless e reutilizável, chamado conceitualmente **Obra na Mão Server**, capaz de atender clientes diferentes sem desenvolvimento específico por cliente.

O caso Everton será a primeira implantação/homologação real, não uma variante especial do código.

O produto final deverá permitir:

- servidor no mesmo PC do Desktop;
- servidor Windows dedicado;
- servidor Linux dedicado;
- servidor Docker/NAS/VPS;
- descoberta automática em LAN;
- conexão manual por IP/hostname/URL;
- modo remoto seguro;
- migração assistida do banco local para o servidor;
- backup/restore operacional;
- reconexão automática do Desktop ao servidor previamente pareado.

## 2. Restrições inegociáveis

1. Não criar um segundo backend de negócio.
2. Não criar um segundo `SyncCoordinator`.
3. Não duplicar regras de autenticação, permissão, concorrência, backup ou migração já cobertas por F13–F17.
4. `apps/lan-server` é o ponto de partida do Server Core.
5. Desktop, Web/PWA e Cloudflare/D1 continuam compatíveis.
6. Sem fallback silencioso para SQLite local quando servidor central estiver configurado.
7. Núcleo obrigatório sem serviço pago: self-hosted/open source/R$0 como base.
8. Serviços pagos podem existir somente como opção explícita do cliente.
9. `DESKTOP_AUTO_RELEASE_ENABLED=false` permanece até autorização explícita posterior.
10. Nenhum deploy, release ou atualização automática faz parte deste workstream sem autorização explícita.
11. Nenhuma lógica `if (cliente === "Everton")` ou equivalente.
12. Diferenças entre clientes devem ser configuração/implantação, não forks do produto.

## 3. Estado arquitetural de partida

O monorepo já possui:

```text
apps/
├── desktop
├── lan-server
└── web
```

A evolução proposta é:

```text
Obra na Mão
│
├── Desktop Client
│   └── apps/desktop
│
├── Server Core
│   └── apps/lan-server
│
└── Web/PWA
    └── apps/web
```

O nome `lan-server` pode ser mantido internamente durante a migração para reduzir churn. Renomear diretórios não é requisito de F18.

## 4. Abordagens consideradas

### A. Extrair um Server Core do `apps/lan-server` existente — escolhida

Vantagens:

- reaproveita API, banco, autorização e contratos já testados;
- reduz risco de divergência entre servidor LAN e servidor remoto;
- preserva F8–F17;
- permite empacotar o mesmo núcleo em Windows, Linux e Docker;
- evita segunda arquitetura de sync.

Desvantagem:

- exige desacoplar qualquer dependência residual do Electron/host Desktop.

### B. Criar um novo `apps/server`

Vantagem: estrutura nominalmente limpa.

Desvantagens:

- alto risco de copiar lógica;
- possibilidade de dois backends evoluírem de forma diferente;
- maior custo de teste e manutenção.

Não escolhida.

### C. Manter o servidor somente embutido no Desktop

Vantagem: menos packaging no curto prazo.

Desvantagens:

- não atende Linux headless;
- não atende VPS/NAS corretamente;
- exige usuário logado/GUI em cenários desnecessários;
- mantém acoplamento de produto que dificulta expansão comercial.

Não escolhida.

## 5. Arquitetura alvo

```text
                       Obra na Mão Server Core
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
             Windows           Linux           Docker
                │                │                │
                └────────────────┼────────────────┘
                                 │
                         API autenticada
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                 Desktop A    Desktop B    Desktop C
                                 │
                                 ▼
                         SyncCoordinator único
                                 │
                                 ▼
                         Cloudflare / D1 ↔ PWA
```

O Server Core não deve depender de saber se está em LAN ou remoto para executar a lógica de negócio. Transporte/endereço são preocupações de configuração e segurança.

## 6. F18 — Server Core headless

### Objetivo

Fazer `apps/lan-server` iniciar e operar como processo independente sem Electron.

### Requisitos

- entrypoint CLI/headless;
- configuração por arquivo e/ou variáveis de ambiente;
- `DATA_PATH` configurável;
- `BACKUP_PATH` configurável;
- bind address configurável;
- porta configurável;
- logs próprios;
- health endpoint;
- readiness endpoint;
- graceful shutdown;
- sinalização clara de banco bloqueado/corrompido;
- mesma lógica de migrations LAN;
- mesma identidade de servidor;
- mesmas capabilities;
- mesmas políticas F13–F17 após reconciliação.

### Não fazer

- fork do repository layer;
- banco diferente para Linux;
- API alternativa;
- sync adicional.

## 7. Configuração do Server

Modelo conceitual:

```text
OBRA_SERVER_DATA_PATH=/var/lib/obra-na-mao
OBRA_SERVER_BACKUP_PATH=/var/lib/obra-na-mao/backups
OBRA_SERVER_HOST=0.0.0.0
OBRA_SERVER_PORT=8787
OBRA_SERVER_LOG_LEVEL=info
```

Segredos não devem ficar em arquivo versionado.

Identidade da empresa e do servidor continua vindo do fluxo de claim/pareamento já existente.

## 8. F19 — Windows Server

Distribuição conceitual:

```text
ObraNaMao-Server-Setup.exe
```

Instalação deve:

- instalar runtime necessário;
- registrar serviço Windows;
- iniciar automaticamente;
- reiniciar após falha;
- criar diretórios de dados/backup com permissões adequadas;
- criar somente regras de firewall estritamente necessárias;
- não publicar release automaticamente.

O mesmo PC pode executar `ObraNaMao.exe`, que acessa o servidor via loopback.

## 9. F20 — Linux Server

Alvos iniciais:

- Ubuntu LTS;
- Debian estável compatível.

Layout conceitual:

```text
/opt/obra-na-mao/
/var/lib/obra-na-mao/
/var/log/obra-na-mao/
```

Serviço:

```text
systemd
└── obra-na-mao-server.service
```

Deve suportar:

- start/stop/restart;
- restart on failure;
- boot automático;
- usuário de serviço sem privilégios desnecessários;
- shutdown limpo;
- logs consultáveis;
- diretório de dados persistente.

## 10. F21 — Docker

Criar imagem somente depois de o runtime headless estar comprovado fora do Electron.

Volumes mínimos:

```text
/data
/backup
```

O container não deve guardar estado crítico fora dos volumes persistentes.

Suporte esperado:

- Docker Engine;
- Docker Compose;
- NAS/host que execute containers compatíveis.

## 11. F22 — Descoberta automática LAN

Primeiro uso do Desktop:

```text
Como este computador deve acessar o Obra na Mão?

○ Usar este computador
○ Encontrar servidor automaticamente
○ Conectar manualmente
```

`Encontrar servidor automaticamente` deve:

1. procurar instâncias na mesma rede;
2. mostrar nome amigável, empresa quando autorizado, endereço e estado;
3. permitir selecionar uma instância;
4. seguir para autenticação/pareamento;
5. nunca conceder acesso somente por descoberta.

Tecnologia preferencial: mDNS/DNS-SD ou mecanismo local equivalente, com fallback manual obrigatório.

## 12. F23 — Conexão manual

Aceitar pelo menos:

```text
192.168.1.50
obra-server.local
https://server.empresa.com.br
```

Fluxo:

```text
endereço
  ↓
testar conexão
  ↓
verificar identidade/capabilities
  ↓
autenticar
  ↓
parear
  ↓
salvar referência segura
```

Depois do primeiro pareamento, o Desktop tenta o servidor conhecido automaticamente.

## 13. Persistência da conexão no Desktop

Armazenar de forma segura:

- `serverInstanceId`;
- endereço preferido;
- última rota funcional;
- material de autenticação já definido pelas fases anteriores;
- capabilities observadas.

Não salvar senha bruta.

Não trocar silenciosamente de servidor somente porque outra instância respondeu na LAN.

## 14. F24 — Pareamento simplificado

Descobrir um servidor não equivale a autorizar o Desktop.

Fluxo:

```text
Desktop encontra Server
        ↓
     Conectar
        ↓
login/autenticação
        ↓
pareamento do dispositivo
        ↓
política do membro
        ↓
conectado
```

Revogação continua disponível e deve invalidar acesso sem reinstalação.

## 15. F25 — Modo remote oficial

Topologias suportadas passam a ser formalmente:

```text
local
lan-host
lan-client
remote
```

`remote` usa o mesmo contrato do servidor central.

Diferenças permitidas:

- endpoint;
- transporte;
- latência/timeouts;
- política de descoberta;
- TLS/rede privada.

Diferenças proibidas:

- schema de banco diferente;
- API de negócio diferente;
- SyncCoordinator diferente;
- permissões diferentes.

## 16. F26 — Transporte remoto seguro

Duas formas suportadas:

### Rede privada

Exemplo: WireGuard self-hosted.

Vantagem: servidor não precisa expor API de negócio diretamente à Internet pública.

### HTTPS

```text
Desktop → TLS → reverse proxy → Obra na Mão Server
```

Requisitos:

- TLS válido;
- sem HTTP público não autenticado;
- rate limiting quando aplicável;
- firewall mínimo;
- admin endpoints protegidos;
- logs sem tokens/segredos;
- rotação/revogação das credenciais existentes.

WireGuard/reverse proxy são opções de implantação; o Server Core não deve depender de fornecedor pago.

## 17. F27 — Backup operacional

F13/F17 fornecem os mecanismos de segurança de backup/migração.

Esta fase adiciona operação de produção:

- agenda configurável;
- retenção;
- checagem de integridade;
- registro de sucesso/falha;
- backup pré-upgrade;
- restore testável;
- política sem apagar o último backup válido.

Valores default devem ser conservadores e configuráveis.

## 18. F28 — Administração do servidor

Primeira versão pode ser CLI/endpoint administrativo protegido; UI rica não é requisito para iniciar.

Informações mínimas:

- online/readiness;
- versão;
- uptime;
- caminho do banco;
- integridade do banco;
- último backup;
- clientes/dispositivos conectados quando disponível;
- estado do sync;
- capabilities.

Ações administrativas nunca devem permitir editar permissões Cloud diretamente no LAN Server.

## 19. F29 — Assistente de instalação

Servidor:

```text
1. Identificação
2. Empresa/claim
3. Armazenamento
4. Rede
5. Backup
6. Segurança
7. Validação
```

Desktop:

```text
○ Usar este computador
○ Encontrar servidor automaticamente
○ Conectar manualmente
```

A UI deve esconder complexidade de rede de usuários comuns sem remover o fallback manual.

## 20. F30 — Migração assistida

Consumir F17; não reimplementar F17.

Fluxo de UX:

```text
Dados locais encontrados
        ↓
backup obrigatório
        ↓
core
        ↓
operação
        ↓
planejamento
        ↓
financeiro
        ↓
RH
        ↓
validação
        ↓
central-active
```

Falha mantém original local íntegro e estado explícito de migração.

## 21. F31 — QA multiplataforma

Matriz mínima:

| Server | Desktop | Rede |
|---|---|---|
| Windows | Windows | LAN |
| Linux | Windows | LAN |
| Docker/Linux | Windows | LAN |
| Linux | Windows | remote |
| Docker/VPS | Windows | remote |

Cenários mínimos:

- 1/2/5 clientes;
- conflito concorrente F14;
- autorização F15/F16;
- restart do servidor;
- restart do Desktop;
- queda/retorno da rede;
- endereço alterado;
- dispositivo revogado;
- migração de instalação existente;
- backup/restore;
- sync Cloud/PWA;
- nenhum fallback local silencioso.

## 22. F32 — Everton como homologação

Everton será tratado como primeira implantação de referência.

Configuração específica pode incluir:

- distro Linux;
- paths;
- DNS/IP;
- WireGuard/HTTPS;
- rotina de backup;
- número de Desktops.

Não pode incluir código específico do cliente.

Qualquer defeito encontrado deve ser corrigido no Server Platform genérico.

## 23. F33 — Release oficial

Artefatos possíveis depois dos gates:

```text
ObraNaMao-Desktop-Windows.exe
ObraNaMao-Server-Windows.exe
ObraNaMao-Server-Linux
obra-na-mao-server:<versão>
```

Release automática continua desabilitada até autorização explícita.

## 24. Estratégia de implementação em ondas

### Onda A — independência do runtime

- F18 Server Core headless;
- health/readiness;
- configuração;
- testes de processo independente.

### Onda B — empacotamento local

- F19 Windows Service;
- F20 systemd;
- testes de reboot/restart.

### Onda C — experiência Desktop

- F22 descoberta;
- F23 conexão manual;
- F24 pareamento/reconexão.

### Onda D — remoto

- F25 modo remote;
- F26 transporte seguro;
- timeouts/retry explícitos.

### Onda E — operação

- F27 backup agendado;
- F28 administração;
- F29 onboarding;
- F30 migração assistida.

### Onda F — distribuição

- F31 matriz QA;
- F32 homologação Everton;
- F21 Docker depois do runtime Linux comprovado;
- F33 release.

## 25. Integração com as três branches anteriores

Esta branch nasce do hardening atual para preservar segurança/migração.

Antes de declarar F18+ prontos:

1. F8–F12 precisam estar presentes;
2. F13/F17 precisam estar estabilizados;
3. F14–F16 precisam ser integrados;
4. conflitos em `server.mjs`, repository/data access e identidade devem ser resolvidos semanticamente;
5. nenhum `ours/theirs` cego;
6. todos os testes precisam rodar no SHA reconciliado.

A implementação deve privilegiar novos entrypoints/adapters e reduzir mudanças em hotspots enquanto F14–F17 estiverem em movimento.

## 26. Testes e gates

Antes de qualquer release:

- testes `apps/lan-server` verdes;
- testes Desktop verdes;
- testes Web/PWA relevantes verdes;
- Cloudflare CI verde no mesmo candidato quando aplicável;
- servidor inicia sem Electron;
- servidor reinicia após falha;
- Desktop reconecta ao servidor conhecido;
- descoberta não concede autorização;
- conexão manual funciona;
- stale write continua 409 após F14;
- permissões continuam 403 conforme F15/F16;
- migração F17 funciona para server headless;
- backup e restore funcionam no runtime headless;
- nenhum segundo sync;
- publish/release permanece bloqueado.

## 27. Critério de pronto do Server Platform

A plataforma só pode ser considerada pronta quando:

1. o mesmo Server Core roda em Windows e Linux sem Electron;
2. Docker reutiliza o mesmo core sem fork;
3. Desktop encontra servidor automaticamente em LAN;
4. Desktop também conecta manualmente;
5. vínculo é persistido e reconecta automaticamente;
6. servidor remoto usa o mesmo contrato de negócio;
7. segurança/remoto não depende de serviço pago obrigatório;
8. F8–F17 continuam funcionando no SHA integrado;
9. Everton é implantado sem código específico;
10. uma segunda empresa pode ser instalada apenas por configuração/implantação;
11. QA multiplataforma está verde;
12. release segue controlada e explícita.

## 28. Não objetivos

- Kubernetes;
- cluster multi-node;
- banco distribuído;
- alta disponibilidade automática;
- CRDT/event sourcing;
- fila de escrita offline em cada Desktop;
- multi-tenant LAN Server compartilhando o mesmo processo entre empresas;
- dependência obrigatória de cloud paga;
- refazer F13–F17;
- renomear o monorepo ou reorganizar tudo somente por estética.
