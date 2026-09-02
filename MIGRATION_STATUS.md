# Status da migração comercial

Fonte canônica utilizada:
`nutricionistaalmeidavh-spec/ObranaM-o-Universidade-DreFluxo`

Commit reconciliado de referência:
`7e500dafbfdec1eeb9a0e9a1f4a34520786be917`

## Concluído

- Fase 0: snapshot privado da MH preservado.
- Fase 1: repositório comercial independente criado.
- Runtime web v93 reconciliado convertido para Cloudflare.
- Dependências `@appdeploy/client` e `@appdeploy/sdk` removidas do runtime comercial.
- Google OAuth próprio preparado.
- D1 preparado como banco online.
- R2 preparado para arquivos.
- Gemini preparado por secret.
- Owner/superadmin removido do código e convertido para variável de ambiente.
- MH, B2U, funcionários e dados operacionais privados removidos dos defaults comerciais.
- Desktop atual copiado para a linha comercial.
- AppId, produto e diretório local do Desktop separados da instalação privada.
- Endpoint online do Desktop configurável.
- CI Cloudflare separado do CI Desktop.
- ZIP não é necessário para deploy; Git é a fonte do produto.

## Assets educacionais

O manifesto das imagens está no Git. O pacote grande `question-assets-549.zip` não foi duplicado automaticamente na migração comercial. Antes de liberar integralmente a Universidade em produção, publique esse asset no host estático/R2 conforme a estratégia documentada em `apps/web/CLOUDFLARE_DEPLOY.md`.
