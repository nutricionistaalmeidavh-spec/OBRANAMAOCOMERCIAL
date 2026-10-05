# Obra na Mão Server — contrato de ownership de dados v1

Este documento congela o contrato arquitetural usado para concluir a paridade entre o modo SQLite local e o modo Obra na Mão Server.

## Princípios

1. **Fonte operacional exclusiva.** Uma instalação usa o SQLite local **ou** o Obra na Mão Server como fonte operacional ativa. Um módulo centralizado nunca pode salvar silenciosamente no SQLite local como fallback.
2. **PWA independente do modo Desktop.** A PWA continua funcionando via Cloudflare/D1 tanto no modo Desktop único quanto no modo multi-PC com LAN Server.
3. **Cloudflare não é substituído pelo Server.** Identidade, tenant/projeto/membros, permissões, devices/claims, licenças/entitlements e a bridge/sincronização da PWA continuam no Cloudflare.
4. **Ativação central só depois de sanidade.** O estado `central-active` só pode ser aplicado após backup, importação idempotente, validação, commit e leitura pós-commit confirmando contagens e destinos.
5. **Sem owner duplo.** Cada entidade compartilhada pertence a um único domínio canônico.

O arquivo de máquina correspondente é `packages/contracts/lan-data-contract.json`.

## Ownership alvo

| Domínio | Entidades |
|---|---|
| Core | empresas, clientes, obras |
| Operação | locais_obra, frentes_obra, subfrentes_obra, checklist_frente_itens, tarefas_obra, rdos e filhos |
| Planejamento | fontes_documentais, etapas_obra, cronograma_etapas, itens_orcamentarios, medições e anexos |
| Financeiro | fornecedores, categorias, contas, pagamentos, compras, estoque, contratos e anexos |
| RH | cargos, benefícios, EPIs, funcionários, vínculos, folha, ponto, cargo_epi_kits |
| Documentos | arquivos, documentos, documentos_editaveis, modelos_documento_rh |

## Dados intencionalmente locais ao Desktop

`configuracoes`, `importacoes`, `importacao_linhas`, `perfis_importacao` e `pastas_vinculadas` não são dados de negócio compartilhados do LAN Server v1.

## Contrato da Fase 1 — migração RH

A Fase 1 mantém o conjunto já suportado pelo servidor central:

- cargos;
- beneficios;
- epis;
- funcionarios;
- funcionario_obras;
- cargo_beneficios;
- funcionario_beneficios;
- folhas_pagamento;
- folha_lancamentos;
- pagamentos_funcionario;
- pontos_mensais;
- ponto_marcacoes;
- funcionario_epis.

Todas essas entidades precisam chegar ao servidor com `empresa_id` canônico.

### Regra de inferência para bases legadas

1. Se o registro já possui `empresa_id`, ele é preservado somente se não contradiz vínculos canônicos.
2. Sem `empresa_id`, a empresa é inferida por relações existentes: funcionário, folha, ponto, cargo, benefício, EPI ou obra.
3. Se existir exatamente uma empresa local, ela pode ser usada como fallback determinístico.
4. Em base multiempresa, zero candidatos ou mais de um candidato **bloqueiam a migração** com tabela e ID do registro; o sistema nunca escolhe uma empresa arbitrariamente.
5. A normalização ocorre apenas no payload de migração. O banco local legado não é reescrito.

## Gates da Fase 1

- backup antes da primeira escrita remota;
- hash da origem inclui os dados RH já normalizados;
- retry reutiliza o mesmo `migrationId` quando a origem não mudou;
- mudança da origem exige rollback explícito;
- contagem origem = mappings = destinos;
- nenhum mapping aponta para destino ausente;
- `central-active` somente após commit + sanidade;
- rollback remove apenas destinos criados pela tentativa;
- base multiempresa ambígua falha antes da primeira escrita remota do módulo RH.
