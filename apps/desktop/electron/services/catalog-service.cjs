class CatalogService {
  constructor({ db }) { this.db = db }

  list() {
    const cargos = this.db.db.prepare('SELECT * FROM cargos ORDER BY ativo DESC,nome COLLATE NOCASE').all()
    const beneficios = this.db.db.prepare('SELECT * FROM beneficios ORDER BY ativo DESC,nome COLLATE NOCASE').all()
    const links = this.db.db.prepare('SELECT * FROM cargo_beneficios ORDER BY cargo_id,id').all()
    return { cargos, beneficios, links }
  }

  saveCargo(data) {
    const clean = { nome: String(data.nome || '').trim(), cbo: data.cbo || null, salario: Math.max(0, Number(data.salario_base_centavos) || 0), ativo: data.ativo === 0 ? 0 : 1 }
    if (!clean.nome) throw new Error('Informe o nome do cargo.')
    if (data.id) {
      this.db.db.prepare('UPDATE cargos SET nome=?,cbo=?,salario_base_centavos=?,ativo=? WHERE id=?').run(clean.nome, clean.cbo, clean.salario, clean.ativo, Number(data.id))
      return this.db.db.prepare('SELECT * FROM cargos WHERE id=?').get(Number(data.id))
    }
    const result = this.db.db.prepare('INSERT INTO cargos(nome,cbo,salario_base_centavos,ativo) VALUES (?,?,?,?)').run(clean.nome, clean.cbo, clean.salario, clean.ativo)
    return this.db.db.prepare('SELECT * FROM cargos WHERE id=?').get(result.lastInsertRowid)
  }

  saveBenefit(data) {
    const clean = { nome: String(data.nome || '').trim(), tipo: data.tipo || 'outro', valor: Math.max(0, Number(data.valor_padrao_centavos) || 0), ativo: data.ativo === 0 ? 0 : 1 }
    if (!clean.nome) throw new Error('Informe o nome do benefício.')
    if (data.id) {
      this.db.db.prepare('UPDATE beneficios SET nome=?,tipo=?,valor_padrao_centavos=?,ativo=? WHERE id=?').run(clean.nome, clean.tipo, clean.valor, clean.ativo, Number(data.id))
      return this.db.db.prepare('SELECT * FROM beneficios WHERE id=?').get(Number(data.id))
    }
    const result = this.db.db.prepare('INSERT INTO beneficios(nome,tipo,valor_padrao_centavos,ativo) VALUES (?,?,?,?)').run(clean.nome, clean.tipo, clean.valor, clean.ativo)
    return this.db.db.prepare('SELECT * FROM beneficios WHERE id=?').get(result.lastInsertRowid)
  }

  saveLink(data) {
    const values = [Number(data.cargo_id), Number(data.beneficio_id), Math.max(0, Number(data.valor_centavos) || 0), Number(data.quinzena) === 2 ? 2 : 1, data.natureza === 'desconto' ? 'desconto' : 'credito', data.ativo === 0 ? 0 : 1]
    this.db.db.prepare(`INSERT INTO cargo_beneficios(cargo_id,beneficio_id,valor_centavos,quinzena,natureza,ativo) VALUES (?,?,?,?,?,?) ON CONFLICT(cargo_id,beneficio_id) DO UPDATE SET valor_centavos=excluded.valor_centavos,quinzena=excluded.quinzena,natureza=excluded.natureza,ativo=excluded.ativo`).run(...values)
    return true
  }

  deactivate(type, id) {
    if (type === 'cargo') this.db.db.prepare('UPDATE cargos SET ativo=0 WHERE id=?').run(Number(id))
    else if (type === 'beneficio') this.db.db.prepare('UPDATE beneficios SET ativo=0 WHERE id=?').run(Number(id))
    else throw new Error('Tipo de cadastro inválido.')
    return true
  }
}

module.exports = { CatalogService }
