# Fluxo DRE — orientação para agentes

## Princípio de contexto econômico

- Antes de alterar código, consulte `docs/PROJECT_MAP.md`.
- Não remapeie o repositório inteiro em tarefas rotineiras. Inspecione somente os arquivos citados pelo usuário, seus imports diretos e os testes relacionados.
- Amplie a inspeção apenas quando o mapa estiver ausente/desatualizado, a mudança cruzar renderer, IPC e banco, ou os testes indicarem impacto fora do escopo.
- Atualize `docs/PROJECT_MAP.md` somente quando houver mudança estrutural, novo módulo, rota, serviço, canal IPC, migration ou comando.
- Ignore normalmente `node_modules/`, `dist/`, `release/`, `tmp/`, `.qa-payroll-data/`, arquivos `*.bak`, `*.time-bak`, `*.part*`, `*.tsbuildinfo` e JS/DTS gerados a partir das configurações TypeScript.

## Convenções essenciais

- Aplicativo desktop Windows, offline, em React + TypeScript + Vite + Electron + SQLite.
- O renderer não acessa Node.js diretamente. Toda operação privilegiada deve passar pela API `window.fluxoDre`, exposta por `electron/preload.cjs`, e por um handler em `electron/main.cjs`.
- Preserve `contextIsolation` e a validação/restrição de caminhos e entradas.
- Alterações de schema devem ser migrations SQL numeradas em `database/migrations/`; não edite bancos de usuário.
- Valores monetários persistidos usam centavos inteiros. Competências usam `YYYY-MM` e datas, em geral, `YYYY-MM-DD`.
- Reutilize os componentes de `src/components/ui.tsx` e os formatadores de `src/utils/format.ts`.
- Preserve dados e versões de documentos; não substitua ou remova arquivos silenciosamente.

## Verificação

- Mudança localizada: rode o teste relacionado, quando existir.
- Antes de concluir uma alteração de código: `npm run lint` e `npm test`.
- Para mudanças de empacotamento ou integração entre camadas: rode também `npm run build`.
- Não rode `npm run dist` salvo quando o instalador for solicitado.

