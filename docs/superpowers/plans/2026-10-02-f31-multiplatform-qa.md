# F31 — QA multiplataforma

Data: 2026-10-02  
Branch: `qa/f31-multiplatform`

## Objetivo

Validar a Server Platform integrada depois de F22–F30 sem publicar release, auto-update ou deploy de produção.

## Matriz automatizada

### Sistemas
- Windows Server: coberto pelo `server-platform-ci.yml`.
- Linux Server: coberto pelo `server-platform-ci.yml`.
- Desktop Windows: coberto pelo CI comercial e pelos gates F31.
- Contratos Desktop em Linux: cobertos pelo gate F31.
- Docker: **bloqueado até F21**, conforme ordem oficial do roadmap.

### Topologias
- LAN/local-network.
- Remote HTTPS.
- Remote private-network/VPN.
- Reconexão LAN por identidade estável.
- Remote sem discovery LAN.

### Escala
- 1 cliente.
- 2 clientes.
- 5 clientes.

### Contratos funcionais
- banco central compartilhado;
- concorrência/revision conflict;
- permissões F15/F16 e refresh sem re-pair;
- revogação e ciclo de credencial;
- reconnect após mudança de IP;
- proibição de trocar silenciosamente de `serverId`;
- migração `core -> operation -> planning -> finance -> rh`;
- backup gerenciado, restore-test e retenção;
- remote seguro;
- separação storage/online/sync;
- nenhum fallback silencioso para SQLite local em modo servidor.

## Gates físicos que não podem ser substituídos por CI

Estes itens pertencem à homologação real F31/F32 e exigem máquinas/rede reais:

1. descoberta LAN entre dois computadores físicos;
2. firewall/roteador reais;
3. queda e retorno de Wi-Fi/Ethernet;
4. troca real de IP do servidor;
5. instalação Windows Server + Desktop em PCs distintos;
6. WireGuard/HTTPS usando a rede real;
7. restore operacional de uma cópia representativa;
8. observação de uso simultâneo real.

## Proteções

- `DESKTOP_AUTO_RELEASE_ENABLED=false`;
- sem deploy de produção;
- sem GitHub Release;
- sem auto-update;
- branch separada;
- Docker não é simulado nem declarado aprovado antes de F21.
