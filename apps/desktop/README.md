# Fluxo DRE

Aplicativo desktop Windows, offline, para gestão financeira, obras, folha, funcionários e documentos de admissão.

## Recursos

- Painel financeiro e DRE mensal/anual.
- Contas a pagar e receber, pagamentos parciais e recorrência.
- Obras, orçamentos, etapas, locais e medições.
- Funcionários, folha por competência, vales, faltas, diárias e benefícios.
- Assistente de registro de funcionário e geração de PDFs/dossiê.
- Central de documentos com versões assinadas e não assinadas.
- Importação auditável da aba `2026` da planilha indicada no primeiro uso.
- Backup e restauração locais.

## Desenvolvimento

Requisitos: Node.js 20+ e Windows 10/11 x64.

```powershell
npm install
npm run electron:dev
```

## Build e instalador

```powershell
npm test
npm run build
npm run dist
```

O instalador NSIS é gerado em `release/`. O banco e os documentos ficam em `%APPDATA%\fluxo-dre`; dados reais não fazem parte do código nem do instalador.

## Importação inicial

Na primeira abertura, acesse **Importar 2026**, escolha a planilha, revise a prévia e confirme. Somente a aba `2026` é processada. Linhas de origem, conteúdo bruto, hash e divergências de reconciliação ficam registrados para auditoria.

## Segurança e privacidade

O renderer não possui acesso direto ao Node.js. A comunicação usa uma API restrita no preload, com isolamento de contexto, validação de entradas e caminhos limitados à pasta do aplicativo. O sistema funciona sem servidor, login ou internet.

## Documentos de admissão

O sistema gera carta de oposição sindical (quando selecionada), contrato de experiência conforme o cargo, ficha e livro de registro, ordem de serviço, vale-transporte e ficha de EPI. eSocial e certificados NR são armazenados como documentos externos.

> Revise os documentos com o responsável contábil/jurídico antes da assinatura. O aplicativo preserva as versões anteriores e nunca substitui silenciosamente um arquivo.
