# Contrato de dados — Visão geral da folha (v1)

## Objetivo

Definir uma única origem canônica para cada célula da futura aba **Visão geral** em `Controle de pagamento`.
A interface não mantém uma planilha paralela: ela apenas projeta os dados já persistidos em Folha, Benefícios e Contas.

O contrato puro está em `packages/domain-core/index.cjs` e é identificado por `contract_version: 1`.

## Regra de autoridade

1. **Valores por funcionário e competência** vêm de `folha_lancamentos`.
2. `funcionarios.salario_centavos`, `cargos.salario_base_centavos`, `cargo_beneficios` e `funcionario_beneficios` são fontes de configuração usadas para preparar a folha, mas **não são lidas diretamente pela Visão geral**.
3. Depois de materializado na folha da competência, o valor exibido é o lançamento dessa folha.
4. **Despesas da empresa** vêm de `contas` com `tipo='pagar'`.
5. Contas da categoria **Folha de pagamento** e contas explicitamente originadas da própria folha são excluídas da seção de despesas empresariais para evitar duplicar salário.
6. INSS, FGTS e demais encargos da grade são valores já existentes em lançamentos. Este contrato **não calcula alíquotas tributárias nem regras legais**.

## Colunas canônicas

| Grupo | Coluna | Chave do contrato | Origem |
| --- | --- | --- | --- |
| Remuneração | Salário | `remuneracao.salario` | `folha_lancamentos` tipo `salario` / descrição Salário |
| Remuneração | Vale / adiantamento | `remuneracao.vale_adiantamento` | tipos canônicos `vale_salario`, `vale_adiantamento` ou `adiantamento` |
| Remuneração | Diárias | `remuneracao.diarias` | tipo/descrição Diária |
| Remuneração | Empreitas | `remuneracao.empreitas` | tipo/descrição Empreita |
| Remuneração | Outros | `remuneracao.outros` | créditos não classificados em outra coluna |
| Benefícios | Alimentação | `beneficios.alimentacao` | lançamento `beneficio_<id>` ligado a benefício de alimentação/refeição/café |
| Benefícios | Transporte | `beneficios.transporte` | lançamento `beneficio_<id>` ligado a benefício de transporte |
| Benefícios | Outros | `beneficios.outros` | demais benefícios |
| Descontos | Faltas | `descontos.faltas` | tipo/descrição Falta |
| Descontos | Outros descontos | `descontos.outros` | lançamento com `natureza='desconto'` que não seja Falta |
| Encargos | INSS | `encargos.inss` | tipo/descrição INSS |
| Encargos | FGTS | `encargos.fgts` | tipo/descrição FGTS |
| Encargos | Outros | `encargos.outros` | encargos explicitamente identificados, por exemplo SECONCI |

### Precedência de classificação

A classificação não deve transformar um desconto importado em crédito apenas pelo texto.

Exemplo: um lançamento legado chamado “Vale antigo” com `natureza='desconto'` continua em **Outros descontos**.
Somente os tipos canônicos de adiantamento entram em **Vale / adiantamento**.

## Fórmulas da linha do funcionário

```
remuneracao_total = salário + vale/adiantamento + diárias + empreitas + outros
beneficios_total   = alimentação + transporte + outros
descontos_total    = faltas + outros descontos
encargos_total     = INSS + FGTS + outros encargos

total_funcionario = max(0, remuneracao_total + beneficios_total - descontos_total)
custo_empresa     = total_funcionario + encargos_total
```

Essas fórmulas são de consolidação da grade. Não substituem cálculos trabalhistas, fiscais ou contábeis externos.

## Despesas da empresa

A função `payrollOverviewCompanyExpenseRows` recebe contas já pertencentes ao escopo da competência e mantém somente:

- `tipo='pagar'`;
- não excluídas logicamente;
- não pertencentes à categoria `Folha de pagamento`;
- não marcadas explicitamente como originadas da própria folha.

Cada conta continua sendo uma linha individual, mantendo descrição e categoria.
O campo `group` serve apenas para apresentação/filtro:

- `impostos`: Simples/DAS/DARF/impostos/tributos;
- `contabilidade`;
- `fixas`: demais contas recorrentes;
- `outras`.

## Totais da competência

`buildPayrollOverview` retorna:

- `totals.by_column_centavos`: soma vertical de cada coluna;
- `totals.total_funcionarios_centavos`: soma dos totais dos funcionários;
- `totals.custo_funcionarios_centavos`: soma de `custo_empresa_centavos` dos funcionários;
- `totals.despesas_empresa_centavos`: soma das contas empresariais;
- `totals.custo_competencia_centavos`: custo dos funcionários + despesas empresariais.

## Rastreabilidade

Cada célula guarda `sources` com referências aos `folha_lancamentos` que formaram o valor:

```json
{
  "kind": "folha_lancamento",
  "id": 10,
  "origem": "importacao",
  "importacao_linha_id": 50
}
```

Cada despesa empresarial guarda referência à conta:

```json
{
  "kind": "conta",
  "id": 22,
  "origem": "importacao_2026",
  "origem_id": 4
}
```

Isso permite que a futura célula clicável mostre “de onde veio este número?” sem duplicar dados.

## Importação futura

O importador de planilhas deve alimentar as tabelas canônicas:

- funcionário/configuração -> cadastros existentes;
- valores mensais -> `folha_lancamentos`;
- despesas da empresa -> `contas`;
- vínculo com linha importada -> `importacao_linha_id` / origem.

A Visão geral nunca deve salvar um valor diretamente em uma célula própria.

## Fora do escopo da Fase 0

Ainda não fazem parte desta fase:

- nova aba visual;
- endpoint IPC `folha.overview`;
- filtros de empresa/obra na tela;
- clique para drill-down;
- importador especializado para a matriz;
- exportação Excel.

Esses itens passam a consumir este contrato, sem redefinir regras de cálculo.
