# Woodpecker QA — Obra na Mão Comercial

O repositório usa o Agent Windows local já existente da ArtiSys para validar mudanças automaticamente antes de merge/deploy.

## Workflow

Arquivo: `.woodpecker/obra-comercial-qa.yaml`

Eventos:

- `push`;
- `pull_request`;
- execução `manual`.

O Agent atual mantém o label histórico `pilot=pdv-artisys`; o workflow deste repositório reutiliza esse mesmo label para não exigir alteração/restart da infraestrutura local.

## Gates

O runner `scripts/woodpecker-qa.ps1` executa, em ordem:

1. Node 22.12+ e <23;
2. Git/NPM disponíveis;
3. contrato do catálogo público (`verify-public-catalog.mjs`);
4. `npm ci` da aplicação web;
5. `npm ci` do Desktop;
6. typecheck dos contratos compartilhados;
7. testes web;
8. contrato UX;
9. contrato SEO;
10. verificação dos assets da Universidade;
11. build web;
12. testes Desktop;
13. build Desktop.

O Agent Windows persistente roda com privilégios limitados. Quando o host não permite criar symbolic links (`EPERM`/`EACCES`), o runner registra explicitamente essa limitação e omite apenas os dois casos de teste cujo próprio setup depende da criação de symlink. Todos os demais testes Desktop continuam obrigatórios.

## Evidências

Durante a execução são gerados em `qa-artifacts/woodpecker/`:

- `obra-comercial-qa.log`;
- `obra-comercial-qa-report.json`;
- `obra-comercial-failure.json` quando houver falha.

`qa-artifacts/` já é ignorado pelo Git.

O módulo compartilhado `artisys-ci-reporter`, em `C:\VICTOR\Artisys\AgroFrota\utilidades`, publica o resultado no GitHub usando o contexto:

`ci/woodpecker/obra-comercial-qa`

Falhas recebem diagnóstico com step e trecho final do log; sucesso publica status sem comentário por padrão.

## Segurança

Este workflow é exclusivamente de validação. Ele **não** executa:

- `wrangler deploy`;
- migrations D1 locais ou remotas;
- publicação de releases;
- criação de instalador;
- alterações de banco;
- alterações em produção.

Deploy continua sendo uma ação separada e explícita.

## Execução manual no PC

A partir da raiz do repositório:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\woodpecker-qa.ps1
```

No Woodpecker, o workflow também pode ser disparado manualmente pela interface de `ci.artisys.dev`.
