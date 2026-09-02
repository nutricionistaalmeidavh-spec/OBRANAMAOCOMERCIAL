CREATE TABLE IF NOT EXISTS cargo_beneficios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cargo_id INTEGER NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  beneficio_id INTEGER NOT NULL REFERENCES beneficios(id),
  valor_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_centavos >= 0),
  quinzena INTEGER NOT NULL DEFAULT 1 CHECK(quinzena IN (1,2)),
  natureza TEXT NOT NULL DEFAULT 'credito' CHECK(natureza IN ('credito','desconto')),
  ativo INTEGER NOT NULL DEFAULT 1,
  UNIQUE(cargo_id, beneficio_id)
);

ALTER TABLE folha_lancamentos ADD COLUMN origem TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE folha_lancamentos ADD COLUMN editavel INTEGER NOT NULL DEFAULT 1;
ALTER TABLE folha_lancamentos ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente';
ALTER TABLE folha_lancamentos ADD COLUMN updated_at TEXT;

ALTER TABLE pagamentos_funcionario ADD COLUMN forma_pagamento TEXT;
ALTER TABLE pagamentos_funcionario ADD COLUMN confirmado_em TEXT;

CREATE INDEX IF NOT EXISTS idx_cargo_beneficios_cargo ON cargo_beneficios(cargo_id, ativo);
CREATE INDEX IF NOT EXISTS idx_folha_funcionario_status ON folha_lancamentos(folha_id, funcionario_id, status);
CREATE INDEX IF NOT EXISTS idx_pag_func_comp_quinzena ON pagamentos_funcionario(funcionario_id, competencia, quinzena);

INSERT OR IGNORE INTO cargo_beneficios(cargo_id,beneficio_id,valor_centavos,quinzena,natureza)
SELECT c.id,b.id,b.valor_padrao_centavos,1,'credito'
FROM cargos c CROSS JOIN beneficios b
WHERE b.nome IN ('Vale-alimentação','Café');
