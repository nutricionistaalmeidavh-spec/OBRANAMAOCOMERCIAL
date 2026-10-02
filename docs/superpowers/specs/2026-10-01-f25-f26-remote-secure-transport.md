# F25/F26 — Remote oficial e transporte seguro

## Objetivo

Tornar `remote` uma topologia oficial do Obra na Mão sem criar outro backend. O Server Core, SQLite central, API, autenticação, permissões, pairing, concorrência, migração e sync permanecem idênticos às topologias LAN.

## F25 — contrato remoto

- Desktop persiste `operationalMode=remote` e a mesma identidade estável `serverId` de F24.
- Endpoint remoto é sempre explícito; discovery mDNS/DNS-SD de F22 não é usado.
- Reconnect testa somente o endpoint remoto salvo. Falha retorna `unreachable`; não existe troca automática para outra instância e não existe fallback local.
- Endpoint público requer HTTPS.
- HTTP é permitido apenas para endereço privado/local, destinado a VPN/rede privada.
- Timeout remoto é maior que o LAN sem alterar os clientes de domínio.

## F26 — perfis suportados

### HTTPS + reverse proxy

- Obra na Mão Server escuta apenas em loopback.
- TLS válido termina no reverse proxy.
- TCP 4732 não deve ser publicado na WAN.
- Template oficial: `packaging/remote/Caddyfile.template`.

### Rede privada / WireGuard

- Obra na Mão Server escuta no IP privado da interface VPN.
- O runtime rejeita wildcard e IP público no perfil `private-network`.
- A WAN expõe somente a porta necessária da VPN.
- Templates oficiais não contêm chaves privadas.

## Runtime

Variáveis novas:

```text
OBRA_NA_MAO_SERVER_MODE=lan|local|remote
OBRA_NA_MAO_SERVER_TRANSPORT=local-network|private-network|reverse-proxy
```

Defaults preservados:

```text
OBRA_NA_MAO_SERVER_MODE=lan
OBRA_NA_MAO_SERVER_TRANSPORT=local-network
OBRA_NA_MAO_SERVER_HOST=127.0.0.1
```

No modo `remote`:

- `local-network` é rejeitado;
- `reverse-proxy` exige loopback;
- `private-network` exige interface privada explícita;
- `0.0.0.0` e `::` são rejeitados;
- discovery LAN é desativado.

## Não objetivos

- fornecedor VPN pago;
- serviço TLS pago;
- nova API remota;
- novo banco;
- exposição HTTP pública;
- alteração de regras de permissão;
- deploy, merge ou release automático.
