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

## QA compartilhado P0

A Central e a Loja Online consomem o mesmo runtime `@artisys/qa` mantido em `utilidades/modules/artisys-qa`. Na Central, os comandos são:

```sh
npm run qa:quick
npm run qa:full
npm run qa:release
npm run qa:cross-system
```

`qa:release` mantém os gates nativos `npm test`, `npm run build` e `npm run ux:verify` antes do profile compartilhado. Os artefatos ficam em `qa-artifacts/` com screenshots, vídeo, trace, telemetria e relatórios JSON/HTML conforme o runtime compartilhado.

### Cross-system

Sem secret, `npm run qa:cross-system` é read-only: confirma que `artisys.dev/sistema` e o Worker da Loja Online respondem.

Para executar o ciclo mutável completo, fornecer o secret apenas na variável de ambiente da sessão:

```text
ARTISYS_CENTRAL_BASE_URL=https://artisys.dev
ARTISYS_LOJAONLINE_BASE_URL=https://artisys-lojaonline.nutricionistaalmeidavh.workers.dev
LOJAONLINE_LICENSE_SERVICE_SECRET=<secret existente nos dois Workers>
```

Com o secret presente, o runner:

1. cria um tenant descartável identificado pelo prefixo `QA-CROSS-`;
2. confirma licença ativa;
3. estende seis meses;
4. bloqueia;
5. confirma estado bloqueado;
6. desbloqueia;
7. confirma restauração;
8. consulta a auditoria.

O relatório é salvo em `qa-artifacts/cross-system/<timestamp>/report.json`. O valor do secret e a senha temporária devolvida na criação não são gravados no relatório.

Como ainda não existe endpoint administrativo seguro de exclusão de tenant, o runner não inventa deleção: tenants `QA-CROSS-*` ficam identificados para limpeza administrativa posterior.

## QA P1

O hardening P1 adiciona três camadas sobre o P0:

1. `npm run qa:p1:security` executa as políticas P1 existentes, o adapter de licenciamento, contratos do owner e o runner cross-system em teste isolado;
2. `npm run qa:p1:matrix` executa o smoke local da Central em desktop, tablet e mobile usando o runtime compartilhado;
3. `npm run qa:cross-system`, quando recebe `LOJAONLINE_LICENSE_SERVICE_SECRET`, também valida secret inválido, login do tenant criado com a senha temporária apenas em memória, catálogo público ativo, bloqueio 403 e restauração após desbloqueio.

O relatório cross-system não serializa o secret, a senha temporária nem a sessão do tenant. O modo sem secret continua read-only.

Comandos:

```sh
npm run qa:p1
npm run qa:cross-system
npm run qa:release
```

## QA P2 — release gate

`npm run qa:p2` prepara o runtime compartilhado 2.6.0 e executa testes nativos, build, `ux:verify`, segurança P1, sweep P1, matriz desktop/tablet/mobile e cross-system em modo read-only. O resultado é consolidado em `qa-delivery-artifacts/artisys-central-owner-<run>/` com `QA-SUMMARY.json/txt`, HTML, cobertura, endpoints, erros e findings. `npm run qa:release` aponta para esse gate.

O cross-system mutável continua separado e exige `LOJAONLINE_LICENSE_SERVICE_SECRET` explícito; o release P2 remove esse secret do ambiente para garantir que a etapa cross-system do release seja somente leitura.
