# Obra na Mão Desktop 2.1.1 — Servidor próprio avançado

## Modos incluídos e adicional

- **Uso individual** (`local` / `local-single`): dados operacionais apenas neste PC.
- **PC principal** (`lan-host` / `lan-server`): dados operacionais centralizados no PC principal da empresa, acessados por computadores autorizados na mesma rede; **conectar a este PC** (`lan-client`) não é produto separado.
- **Servidor próprio avançado** (`remote`): servidor de rede remota seguro, por HTTPS ou rede privada/VPN (por exemplo WireGuard); exige o direito `advancedServer===true` na licença da empresa.

A infraestrutura é self-hosted/open source e não requer serviço de terceiros pago. A cobrança separada, quando houver, corresponde à habilitação comercial, implantação ou suporte contratados.

## Como ativar

1. Entrar na Central ArtiSys como superadministrador.
2. Abrir a empresa em **Clientes → Gerenciar → Licença da empresa**.
3. Marcar **Servidor próprio avançado** e salvar.
4. No Desktop, em **Configurações do sistema → Como sua empresa usa o Obra na Mão?**, clicar em **Atualizar licença** (ou reabrir as configurações).
5. Selecionar **Acesso remoto avançado — servidor próprio** e concluir identificação, pareamento, backup e migração.

A caixa fica desmarcada em novas empresas e nos planos comerciais comuns. Nenhum meio de pagamento/serviço externo é necessário para a funcionalidade local.

## Proteções e compatibilidade

- A Cloud, autoridade de licença, valida a permissão também em `validateOnly` antes de aceitar alterações remotas na topologia da empresa.
- O Electron recusa alteração para modo remoto sem o adicional; a UI não o apresenta a quem não está autorizado.
- Uma topologia remota já existente pode conservar o mesmo `serverId`, inclusive para reconexão, mesmo sem a nova flag (compatibilidade com instalações anteriores). Não é autorizada a troca para outra identidade.
- Revogar a permissão não elimina dados, backups, credenciais ou a topologia já estabelecida. Novas ativações remotas voltam a exigir autorização.
- Os modos local, PC principal LAN, cliente LAN e Web/PWA não dependem do adicional.
- O release automático do Desktop continua congelado em `commercial-desktop-ci.yml` (`DESKTOP_AUTO_RELEASE_ENABLED=false`). Merge em `main` não publica o instalador no feed do autoupdate.

## Sincronização com Web/PWA no servidor próprio — Desktop v2.1.7

- O banco operacional continua **canônico no Obra na Mão Server** (Windows ou Linux), sem cópia/fallback para SQLite local em modo remoto.
- A ponte de alterações suportadas do Obra360 entre o Server e Cloudflare/D1 é executada por **um Desktop coordenador autorizado por obra**. O proprietário desse vínculo é registrado de forma atômica no D1; somente esse dispositivo poderá executar os endpoints de pull/push, resumo e referências financeiras da obra remota.
- Instalar Server não inicia automaticamente essa ponte: instale/vincule o Desktop v2.1.7, configure o servidor em **Configurações do sistema**, abra **Sincronização da obra**, selecione a obra correta e habilite a sincronização.
- O Desktop coordenador precisa permanecer em execução e conectado para a atualização contínua; quando desligado, a Web/PWA continua operando na Cloudflare/D1, mas as mudanças não chegam ao banco do servidor até a reconexão e conciliação.
- A ponte usa as capacidades de entidades declaradas pelo Server; isso **não é** uma replicação indiscriminada de todo o banco. O fluxo respeita permissões, revisões, conflitos, migrações e os módulos suportados.
- Um segundo Desktop não assume a coordenação automaticamente, evitando múltiplos autores. Substituição do coordenador, restauração ou troca de serverId exigem procedimento administrativo assistido com backup e verificação de pendências.
- A infraestrutura base segue R$ 0, com Node/SQLite/HTTPS ou WireGuard self-hosted; a interface Web/PWA existente usa a autoridade Cloudflare/D1. Nenhuma dependência de servidor pago foi adicionada.
- **Não interpretar testes unitários como homologação completa**: validar em bancada Windows Server ou Linux + Desktop 2.1.7 + Chromebook/PWA, incluindo offline, conflitos e reinícios, antes do primeiro cliente.
