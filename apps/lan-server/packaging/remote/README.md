# Obra na Mão Server — implantação remota segura

F25/F26 usam o mesmo Server Core, banco, API, autenticação, permissões, pairing, concorrência e sync das topologias LAN. O que muda é somente endereço, transporte, timeout e discovery.

## Perfil A — HTTPS + reverse proxy

Use quando o Desktop acessará um nome público, por exemplo `https://servidor.empresa.com`.

1. mantenha o Obra na Mão Server em `127.0.0.1:4732`;
2. use `server.env.reverse-proxy.example`;
3. termine TLS válido no reverse proxy;
4. exponha externamente somente HTTPS (normalmente TCP 443);
5. não exponha TCP 4732 diretamente à Internet.

O `Caddyfile.template` fornece uma opção self-hosted com emissão/renovação TLS automática quando DNS e rede permitem.

## Perfil B — rede privada / WireGuard

Use quando os computadores participarão de uma rede privada VPN.

1. configure o WireGuard fora do repositório e gere as chaves localmente;
2. use um endereço VPN dedicado, como `10.66.0.1`;
3. use `server.env.wireguard.example`;
4. exponha na WAN apenas a porta UDP do WireGuard necessária;
5. o Desktop conecta ao endereço privado, por exemplo `http://10.66.0.1:4732`.

O Obra na Mão bloqueia `remote + HTTP` em endereço público. HTTP remoto só é aceito para endereço privado/local, destinado ao túnel/VPN.

## Firewall mínimo

- HTTPS: permitir o tráfego estritamente necessário ao reverse proxy; manter 4732 inacessível pela WAN.
- WireGuard: permitir somente a porta UDP configurada do WireGuard pela WAN; o serviço 4732 fica acessível somente pela interface privada/VPN.
- O instalador Linux não altera firewall automaticamente.
- Nenhum provedor pago é obrigatório.
