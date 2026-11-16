# Obra na Mão Server — implantação remota segura

F25/F26 usam o mesmo Server Core, banco, API, autenticação, permissões, pairing, concorrência e sync das topologias LAN. O que muda é somente endereço, transporte, timeout e discovery.

## Configuração amigável (Windows e Linux)

O instalador inclui um assistente local do **Obra na Mão Server**. Para o cliente que já possui HTTPS e proxy configurados, **não edite manualmente server.env**:

- **Windows Server:** abrir **Configurar Obra na Mão Server** no Menu Iniciar ou selecionar **Abrir configurador** no final da instalação.
- **Linux headless:** abrir uma sessão SSH com encaminhamento local `ssh -L 4734:127.0.0.1:4734 usuario@servidor`, executar `sudo obra-na-mao-configurar` e abrir o link individual exibido no navegador do administrador.
- Na tela, informar o **endereço HTTPS já disponibilizado** e a **porta interna** (padrão: 4732). O assistente atualiza apenas os campos de rede, reinicia o serviço e preserva dados, backups e demais configurações.
- Para o primeiro vínculo, clicar em **Gerar código inicial** e informar o código no Desktop em **Configurações do sistema → Acesso remoto avançado — servidor próprio**.
- Usar **Verificar endereço** para testar a rota HTTPS existente. Se a URL não apontar para o serviço, o cliente deve solicitar à sua TI o encaminhamento para a porta interna escolhida.

O configurador só escuta em `127.0.0.1:4734`, com código de sessão temporário, e não é publicado via proxy. Não cria VPN, DNS, domínio, certificado ou regras de firewall. Esses componentes pertencem à infraestrutura entregue pelo cliente. Os perfis manuais abaixo são referência avançada.

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
