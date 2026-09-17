# Loja Online na Central Artisys

## Objetivo

A Central em `https://artisys.dev/sistema#owner` administra a Loja Online como produto empresarial, no mesmo conceito do Obra na Mão: cada venda provisiona uma empresa/tenant, um administrador e uma licença.

A Central não armazena uma segunda cópia da licença. A fonte de verdade continua no Worker/D1 `artisys-lojaonline`.

## Fluxo

```text
Browser do superadmin
  -> /api/owner/loja-online/* no Worker obra-na-mao-comercial
  -> adapter server-only
  -> Service Binding LOJAONLINE_LICENSING
  -> /api/internal/artisys/loja-online/* no Worker artisys-lojaonline
  -> D1 da Loja Online
```

O browser nunca recebe `LOJAONLINE_LICENSE_SERVICE_SECRET` e nunca chama diretamente a API interna.

## Operações disponíveis

- listar lojas e status;
- provisionar loja + administrador + licença;
- consultar tenant;
- alterar plano, validade e limite máximo de usuários;
- estender a licença em 1, 3, 6 ou 12 meses;
- bloquear;
- desbloquear;
- consultar auditoria de licenciamento.

A renovação preserva tempo restante: uma extensão parte do vencimento atual quando ele ainda está no futuro; se já venceu, parte da data atual.

## Primeiro acesso

Ao provisionar um administrador novo sem senha enviada pela Central, a Loja Online gera uma senha temporária forte. Ela é devolvida somente na resposta de criação e apresentada pela Central para cópia. O valor não é incluído nos eventos de auditoria e não pode ser consultado posteriormente pela Central.

## Segurança

As rotas internas exigem o header `X-Artisys-License-Secret` com o secret `LOJAONLINE_LICENSE_SERVICE_SECRET`. Sessão web, cookie ou Bearer de cliente não substituem o segredo interno.

Em produção, usar:

```jsonc
"services": [
  {"binding":"LOJAONLINE_LICENSING","service":"artisys-lojaonline"}
]
```

O mesmo secret deve existir nos dois Workers via Cloudflare Secrets. Não commitar seu valor.

## Fallback local

Sem Service Binding, o adapter pode usar `LOJAONLINE_LICENSE_BASE_URL` para apontar para uma instância local/remota da Loja Online. O segredo continua obrigatório.

## Ordem de deploy

1. Rodar `npm run check` e `npm run qa:e2e` em `lojaonline`.
2. Configurar `LOJAONLINE_LICENSE_SERVICE_SECRET` no Worker da Loja Online.
3. Publicar `artisys-lojaonline`.
4. Rodar `npm test`, `npm run build` e `npm run ux:verify` em `OBRANAMAOCOMERCIAL/apps/web`.
5. Configurar o mesmo secret na Central.
6. Confirmar Service Binding `LOJAONLINE_LICENSING`.
7. Publicar `obra-na-mao-comercial`.
8. Fazer smoke em `https://artisys.dev/sistema#owner`.

## Smoke obrigatório

- Loja Online aparece na Visão geral;
- formulário cria tenant descartável;
- senha temporária é exibida na criação;
- tenant aparece em Clientes;
- licença aparece em Licenças;
- +6 meses altera o vencimento;
- bloqueio impede dashboard e vitrine do tenant;
- desbloqueio restaura acesso sem criar nova licença;
- auditoria contém criação, extensão, bloqueio e desbloqueio;
- controles existentes do Obra na Mão continuam operacionais;
- controles existentes da Débora Lactação continuam operacionais.
