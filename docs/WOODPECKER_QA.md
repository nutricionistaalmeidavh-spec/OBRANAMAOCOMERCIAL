# Woodpecker QA — Obra na Mão Comercial

O repositório usa dois Agents Windows locais da ArtiSys com responsabilidades separadas.

## 1. Agent normal — Web, catálogo e contratos

Workflow: `.woodpecker/obra-comercial-qa.yaml`

Eventos:

- `push`;
- `pull_request`;
- execução `manual`.

Labels:

```yaml
platform: windows/amd64
backend: local
pilot: pdv-artisys
```

O runner `scripts/woodpecker-qa.ps1` executa:

1. Node/Git/NPM;
2. contrato de separação dos workflows;
3. contrato do catálogo público;
4. dependências web;
5. typecheck dos contratos compartilhados;
6. testes web;
7. contrato UX;
8. contrato SEO;
9. verificação de assets;
10. build web.

O Agent normal não executa testes/build Desktop privilegiados.

## 2. Agent elevado — Desktop completo

Workflow: `.woodpecker/obra-comercial-desktop-elevated.yaml`

Eventos:

- `manual` em qualquer branch confiável;
- `push` apenas em `main`.

Pull requests não entram no caminho elevado.

Labels obrigatórios:

```yaml
platform: windows/amd64
backend: local
privilege: elevated
owner: artisys
```

O runner `scripts/woodpecker-desktop-elevated.ps1` executa:

1. validação do token administrativo real do Windows;
2. allowlist/identidade via `artisys-windows-ci` do repo `utilidades`;
3. Node/Git/NPM;
4. `npm ci` Desktop;
5. preparação serial do Electron;
6. prova real de criação de symbolic link;
7. suíte Desktop completa (`npm run test:desktop`);
8. build Desktop (`npm run build:desktop`).

Não há filtro de testes de symlink no caminho elevado.

## Allowlist compartilhada

O módulo `modules/artisys-windows-ci` no repo `utilidades` mantém a allowlist em código e não permite que um pipeline de produto amplie a lista por variável de ambiente.

Allowlist inicial:

- `nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL`;
- `nutricionistaalmeidavh-spec/PDV-ARTISYS`;
- `nutricionistaalmeidavh-spec/OficinaAgricola`;
- `nutricionistaalmeidavh-spec/SistemaLavoura`;
- `nutricionistaalmeidavh-spec/frota-e-manutencao`;
- `nutricionistaalmeidavh-spec/pecuaria`;
- `nutricionistaalmeidavh-spec/maquinasagricolas`.

## Evidências

Agent normal:

- `qa-artifacts/woodpecker/obra-comercial-qa.log`;
- `obra-comercial-qa-report.json`;
- `obra-comercial-failure.json` em falha.

Agent elevado:

- `qa-artifacts/woodpecker/obra-comercial-desktop-elevated.log`;
- `obra-comercial-desktop-elevated-report.json`;
- `obra-comercial-desktop-elevated-failure.json` em falha.

O `artisys-ci-reporter` publica status separados:

- `ci/woodpecker/obra-comercial-qa`;
- `ci/woodpecker/obra-comercial-desktop-elevated`.

## Segurança

Nenhum dos dois workflows executa:

- `wrangler deploy`;
- migration D1;
- publicação de GitHub Release;
- criação/publicação de instalador;
- alteração de produção.

Deploy/release continuam explícitos e separados.

## Ativação do Agent elevado

A infraestrutura fica em `PDV-ARTISYS`, branch `feat/woodpecker-elevated-agent`. O registro de uma tarefa com `RunLevel Highest` precisa ser executado uma vez em PowerShell como Administrador no host Windows.

Após a ativação, o Agent elevado usa workspace próprio e uma cópia isolada do `utilidades`; o Agent normal continua funcionando sem alteração.
