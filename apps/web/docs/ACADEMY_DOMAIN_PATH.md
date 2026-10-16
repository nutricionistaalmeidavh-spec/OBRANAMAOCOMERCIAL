# Publicação da ArtiSys Academy em artisys.dev/academy

## Destino e escopo
- URL canônica desejada: `https://artisys.dev/academy` (caminho sob o domínio principal, **não** subdomínio).
- Aplicação proprietária da Academy: `nutricionistaalmeidavh-spec/cyber-study-hub`, Worker `cyber-study-hub`.
- A rota `/academy` e a lista de espera `#lista-de-espera` já existem na aplicação Academy.
- A Central `/links` inclui o atalho como link secundário, preservando os cinco cards principais.
- Obra na Mão segue sem mudança de hostname, autenticação, APIs ou URLs do autoupdate.

## Bloqueio de publicação
**Não mesclar o atalho na main enquanto o caminho não responder pela Academy em produção.**
O domínio `artisys.dev` atualmente é atendido pelo Worker da operação comercial. Somente adicionar `/academy` à Central não transfere o tráfego de outro Worker.

## Requisitos de roteamento
1. Preparar a Academy para ser servida sob base `/academy/` (bundle JS/CSS, PWA, arquivos públicos e links de navegação). Evitar scripts que carreguem `/assets/*` na raiz compartilhada.
2. Isolar endpoints da Academy sob `/academy/api/*`, sem capturar `/api/*` usados por Obra na Mão. Traduzir as URLs ao encaminhar ao Worker Academy e preservar o `Origin` público para verificação anti-CSRF.
3. Encaminhar `/academy` e `/academy/*` ao Worker `cyber-study-hub` por Service Binding ou regra de roteamento explícita Cloudflare com maior especificidade. Fazer fallback para os assets da própria Academy.
4. Validar sessão e cookies sem colisão (`hub_session`), login/admin, submissão de lista de espera, idempotência, assets privados e rotas de matrícula. Manter o endpoint legado `workers.dev` ativo para integrações e webhook assinado.
5. Fazer smoke end-to-end em `https://artisys.dev/academy` e `/academy#lista-de-espera`, desktop/mobile, além de `https://artisys.dev/links`, `/sistema.html#portal`, `/api/bootstrap` e OAuth. Só publicar o card depois dos testes.
6. Implementação obrigatória sem novos serviços pagos. O site principal, domínio e os dois Workers existentes continuam como infraestrutura-base.

A simples inclusão de `routes = ["artisys.dev/academy*"]` no Wrangler da Academy **não basta**, pois o frontend atual usa caminhos de assets e API a partir da raiz.
