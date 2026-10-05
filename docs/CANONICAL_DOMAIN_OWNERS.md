# Canonical domain owners — Obra na Mão Comercial

## P0 ownership contract

| Domain concept | Canonical owner | Effective source | Downstream consumer |
|---|---|---|---|
| Cargo / função | Pessoas & RH → Cargos e remuneração | `cargos` | funcionário, ponto, documentos e folha |
| Salário-base do cargo | Pessoas & RH → Cargos e remuneração | `cargos.salario_base_centavos` | folha quando não existe salário individual |
| Tipo de benefício | Pessoas & RH → Cargos e remuneração | `beneficios` | catálogo para vínculos |
| Valor efetivo do benefício por cargo | Pessoas & RH → Cargos e remuneração | `cargo_beneficios.valor_centavos` | folha e recibos |
| Valor padrão para novos vínculos | Pessoas & RH → Cargos e remuneração | `beneficios.valor_padrao_centavos` | somente preenchimento inicial |
| Exceção individual | Funcionário / remuneração individual | `funcionarios.salario_centavos` e `funcionario_beneficios` | folha, com precedência sobre o cargo |
| Cálculo e confirmação | Pessoas & RH → Folha e pagamentos | `folhas_pagamento`, `folha_lancamentos`, `pagamentos_funcionario` | financeiro e documentos |
| Servidor, sync, backup, pasta, layout e atualização | Configurações do sistema | serviços de infraestrutura | operação do aplicativo |

## Invariantes

1. Configurações não é owner de política de RH.
2. Folha e pagamentos consome a política de remuneração; não é o cadastro mestre.
3. O valor efetivo exibido para um benefício é o vínculo do cargo. `valor_padrao_centavos` é apenas um valor opcional para preencher novos vínculos.
4. Salvar cargo + salário-base + benefícios é uma operação canônica única: `catalogo.saveCompensationPolicy`.
5. A operação acima é transacional tanto no SQLite local quanto no servidor LAN: qualquer falha reverte todo o conjunto.
6. Paths, aliases, grupos de navegação e breadcrumbs pertencem a `apps/desktop/src/routes/registry.ts`.
7. As rotas antigas `/funcionarios`, `/registro-funcionario`, `/folha` e `/ponto` são somente aliases de compatibilidade para o namespace `/rh/*`.

## Rotas canônicas de RH

- `/rh`
- `/rh/funcionarios`
- `/rh/admissoes`
- `/rh/remuneracao`
- `/rh/folha`
- `/rh/ponto`
- `/rh/modelos`

## Verificação P0

- unit: rollback e sucesso da política local;
- unit: fonte RH central usa uma única operação, sem loop de saves;
- LAN: rollback, revisão otimista e autorização do endpoint de remuneração;
- renderer: RH hub, aliases e ownership de Configurações;
- CI de PR: lint, testes Desktop, testes LAN, build e instalador.
