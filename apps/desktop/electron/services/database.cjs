const fs = require('node:fs')
const path = require('node:path')
const Database = require('better-sqlite3')

const TABLES = new Set([
  'empresas','clientes','fornecedores','obras','etapas_obra','locais_obra','itens_orcamentarios',
  'medicoes','medicao_itens','categorias_financeiras','contas','pagamentos_conta','cargos',
  'funcionarios','funcionario_obras','beneficios','funcionario_beneficios','folhas_pagamento',
  'folha_lancamentos','pagamentos_funcionario','epis','funcionario_epis','documentos','arquivos',
  'pastas_vinculadas','fontes_documentais','importacoes','importacao_linhas','configuracoes','pontos_mensais','ponto_marcacoes','medicao_mapa_itens',
  'cronograma_etapas','rdos','rdo_equipe','rdo_equipamentos','rdo_ocorrencias','perfis_importacao',
  'solicitacoes_compra','cotacoes_compra','pedidos_compra','recebimentos_materiais','pedido_compra_itens','movimentacoes_estoque','contratos_obra','contrato_aditivos','contrato_anexos','pedido_compra_anexos','rdo_anexos','medicao_anexos','documentos_editaveis','modelos_documento_rh','frentes_obra','subfrentes_obra','checklist_frente_itens','tarefas_obra'
])

class DatabaseService {
  constructor({ dataDir, migrationsDir }) {
    this.dataDir = dataDir
    this.dbPath = path.join(dataDir, 'fluxo-dre.sqlite')
    this.migrationsDir = migrationsDir
    this.db = null
    this.columns = new Map()
  }

  open() {
    fs.mkdirSync(this.dataDir, { recursive: true })
    const existed = fs.existsSync(this.dbPath)
    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('busy_timeout = 5000')
    try {
      this.migrate(existed)
      return { path: this.dbPath }
    } catch (error) {
      this.close()
      throw error
    }
  }

  migrate(existed) {
    const files = fs.readdirSync(this.migrationsDir).filter((file) => /^\d+.*\.sql$/.test(file)).sort()
    let current = 0
    try { current = this.db.pragma('user_version', { simple: true }) || 0 } catch {}
    const pending = files.filter((file) => Number(file.match(/^\d+/)[0]) > current)
    if (!pending.length) return
    if (existed && fs.statSync(this.dbPath).size > 0) {
      const backupDir = path.join(this.dataDir, 'backups', 'pre-migration')
      fs.mkdirSync(backupDir, { recursive: true })
      this.db.backup(path.join(backupDir, `fluxo-dre-${Date.now()}.sqlite`))
    }
    for (const file of pending) {
      const version = Number(file.match(/^\d+/)[0])
      const sql = fs.readFileSync(path.join(this.migrationsDir, file), 'utf8')
      this.db.transaction(() => {
        this.db.exec(sql)
        this.db.prepare('INSERT OR IGNORE INTO migrations(id,name) VALUES (?,?)').run(version, file)
        this.db.pragma(`user_version = ${version}`)
      })()
    }
  }

  close() {
    if (this.db) this.db.close()
    this.db = null
  }

  assertTable(table) {
    if (!TABLES.has(table)) throw new Error('Entidade não permitida.')
  }

  getColumns(table) {
    this.assertTable(table)
    if (!this.columns.has(table)) {
      this.columns.set(table, new Set(this.db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)))
    }
    return this.columns.get(table)
  }

  cleanData(table, data) {
    const columns = this.getColumns(table)
    return Object.fromEntries(Object.entries(data || {}).filter(([key]) => columns.has(key) && !['id','created_at','updated_at','deleted_at'].includes(key)))
  }

  list(table, filters = {}) {
    this.assertTable(table)
    const columns = this.getColumns(table)
    const where = []
    const params = {}
    if (columns.has('deleted_at')) where.push('deleted_at IS NULL')
    for (const [key, value] of Object.entries(filters || {})) {
      if (!columns.has(key) || value === '' || value === null || value === undefined) continue
      where.push(`${key} = @${key}`)
      params[key] = value
    }
    const order = columns.has('updated_at') ? 'updated_at DESC' : columns.has('nome') ? 'nome COLLATE NOCASE' : 'id DESC'
    return this.db.prepare(`SELECT * FROM ${table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${order}`).all(params)
  }

  get(table, id) {
    this.assertTable(table)
    return this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(id)) || null
  }

  save(table, data) {
    this.assertTable(table)
    const clean = this.cleanData(table, data)
    const columns = Object.keys(clean)
    if (!columns.length) throw new Error('Nenhum dado válido informado.')
    if (data.id) {
      const assignments = columns.map((key) => `${key} = @${key}`)
      if (this.getColumns(table).has('updated_at')) assignments.push('updated_at = CURRENT_TIMESTAMP')
      this.db.prepare(`UPDATE ${table} SET ${assignments.join(', ')} WHERE id = @id`).run({ ...clean, id: Number(data.id) })
      this.audit(table, Number(data.id), 'atualizar', clean)
      return this.get(table, data.id)
    }
    const placeholders = columns.map((key) => `@${key}`)
    const result = this.db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders.join(',')})`).run(clean)
    this.audit(table, Number(result.lastInsertRowid), 'criar', clean)
    return this.get(table, result.lastInsertRowid)
  }

  remove(table, id) {
    this.assertTable(table)
    if (this.getColumns(table).has('deleted_at')) {
      this.db.prepare(`UPDATE ${table} SET deleted_at=CURRENT_TIMESTAMP WHERE id=?`).run(Number(id))
    } else {
      this.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(Number(id))
    }
    this.audit(table, Number(id), 'excluir', {})
    return true
  }

  audit(entidade, entidadeId, acao, dados) {
    this.db.prepare('INSERT INTO auditoria(entidade,entidade_id,acao,dados) VALUES (?,?,?,?)')
      .run(entidade, entidadeId, acao, JSON.stringify(dados || {}))
  }

  dashboard(filters = {}) {
    const competencia = filters.competencia || new Date().toISOString().slice(0, 7)
    const companyClause = filters.empresa_id ? ' AND empresa_id=@empresa_id' : ''
    const params = { competencia, empresa_id: filters.empresa_id ? Number(filters.empresa_id) : undefined }
    const sums = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='receber' AND status!='cancelado' THEN valor_centavos ELSE 0 END),0) receitas,
        COALESCE(SUM(CASE WHEN tipo='pagar' AND status!='cancelado' THEN valor_centavos ELSE 0 END),0) despesas,
        COALESCE(SUM(CASE WHEN tipo='pagar' AND status IN ('pendente','vencido','parcialmente_pago') THEN valor_centavos ELSE 0 END),0) pagar,
        COALESCE(SUM(CASE WHEN tipo='receber' AND status IN ('pendente','vencido','parcialmente_pago') THEN valor_centavos ELSE 0 END),0) receber,
        COALESCE(SUM(CASE WHEN status='vencido' THEN valor_centavos ELSE 0 END),0) vencidos
      FROM contas WHERE deleted_at IS NULL AND competencia=@competencia ${companyClause}
    `).get(params)
    const obras = this.db.prepare(`SELECT COUNT(*) quantidade, COALESCE(SUM(valor_contratado_centavos),0) total FROM obras WHERE deleted_at IS NULL AND status NOT IN ('concluida','cancelada')${filters.empresa_id ? ' AND empresa_id=@empresa_id' : ''}`).get(params)
    const budget = this.db.prepare(`SELECT COALESCE(SUM(i.quantidade*i.valor_unitario_centavos),0) total FROM itens_orcamentarios i JOIN obras o ON o.id=i.obra_id WHERE i.deleted_at IS NULL${filters.empresa_id ? ' AND o.empresa_id=@empresa_id' : ''}`).get(params)
    const measured = this.db.prepare(`SELECT COALESCE(SUM(m.valor_liquido_centavos),0) total FROM medicoes m JOIN obras o ON o.id=m.obra_id WHERE m.deleted_at IS NULL AND m.status!='cancelada'${filters.empresa_id ? ' AND o.empresa_id=@empresa_id' : ''}`).get(params)
    const trend = this.db.prepare(`
      SELECT competencia,
        SUM(CASE WHEN tipo='receber' AND status!='cancelado' THEN valor_centavos ELSE 0 END) receitas,
        SUM(CASE WHEN tipo='pagar' AND status!='cancelado' THEN valor_centavos ELSE 0 END) despesas
      FROM contas WHERE deleted_at IS NULL AND substr(competencia,1,4)=substr(@competencia,1,4) ${companyClause}
      GROUP BY competencia ORDER BY competencia
    `).all(params)
    const obrasAtencao = this.db.prepare(`
      SELECT o.id,o.nome,o.status,o.previsao_termino,o.percentual_fisico,o.valor_contratado_centavos,
        COALESCE(SUM(i.quantidade*i.valor_unitario_centavos),0) orcado_centavos
      FROM obras o
      LEFT JOIN itens_orcamentarios i ON i.obra_id=o.id AND i.deleted_at IS NULL
      WHERE o.deleted_at IS NULL AND o.status NOT IN ('concluida','cancelada')${filters.empresa_id ? ' AND o.empresa_id=@empresa_id' : ''}
      GROUP BY o.id
      ORDER BY CASE WHEN o.previsao_termino IS NOT NULL AND o.previsao_termino < date('now') THEN 0 ELSE 1 END, o.previsao_termino ASC
      LIMIT 6
    `).all(params).map((obra) => {
      const motivos = []
      if (obra.previsao_termino && obra.previsao_termino < new Date().toISOString().slice(0, 10)) motivos.push('prazo vencido')
      if (obra.orcado_centavos > obra.valor_contratado_centavos && obra.valor_contratado_centavos > 0) motivos.push('orcamento acima do contrato')
      if (!motivos.length && Number(obra.percentual_fisico) < 100) motivos.push('acompanhar progresso')
      return { ...obra, motivo: motivos.join(' | '), nivel: motivos.some((motivo) => /vencido|acima/.test(motivo)) ? 'critico' : 'atencao' }
    })
    return { ...sums, resultado: sums.receitas - sums.despesas, contratos_ativos: obras.quantidade, total_contratado: obras.total, total_orcado: Math.round(budget.total), total_medido: measured.total, saldo_medir: Math.max(0, obras.total - measured.total), trend, obras_atencao: obrasAtencao }
  }

  workOverview(obraId) {
    const obra = this.db.prepare(`SELECT o.*, c.nome cliente_nome FROM obras o LEFT JOIN clientes c ON c.id=o.cliente_id WHERE o.id=? AND o.deleted_at IS NULL`).get(Number(obraId))
    if (!obra) throw new Error('Obra não encontrada.')
    const financeiro = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='pagar' AND status!='cancelado' THEN valor_centavos ELSE 0 END),0) despesas,
        COALESCE(SUM(CASE WHEN tipo='receber' AND status!='cancelado' THEN valor_centavos ELSE 0 END),0) receitas,
        COALESCE(SUM(CASE WHEN tipo='pagar' AND status IN ('pendente','vencido','parcialmente_pago') THEN valor_centavos ELSE 0 END),0) a_pagar,
        COALESCE(SUM(CASE WHEN tipo='receber' AND status IN ('pendente','vencido','parcialmente_pago') THEN valor_centavos ELSE 0 END),0) a_receber
      FROM contas WHERE obra_id=? AND deleted_at IS NULL
    `).get(obra.id)
    const orcado = this.db.prepare(`SELECT COALESCE(SUM(quantidade*valor_unitario_centavos),0) total FROM itens_orcamentarios WHERE obra_id=? AND deleted_at IS NULL`).get(obra.id).total
    const medido = this.db.prepare(`SELECT COALESCE(SUM(valor_liquido_centavos),0) total FROM medicoes WHERE obra_id=? AND deleted_at IS NULL AND status!='cancelada'`).get(obra.id).total
    const cronograma = this.db.prepare(`SELECT * FROM cronograma_etapas WHERE obra_id=? AND deleted_at IS NULL ORDER BY previsto_inicio, id`).all(obra.id)
    const rdos = this.db.prepare(`SELECT * FROM rdos WHERE obra_id=? AND deleted_at IS NULL ORDER BY data DESC LIMIT 5`).all(obra.id)
    const pendencias = this.db.prepare(`
      SELECT t.*, f.nome frente_nome
      FROM tarefas_obra t LEFT JOIN frentes_obra f ON f.id=t.frente_id
      WHERE t.obra_id=? AND t.deleted_at IS NULL AND t.status NOT IN ('concluida','cancelada')
      ORDER BY CASE WHEN t.prazo IS NOT NULL AND t.prazo < date('now') THEN 0 ELSE 1 END, t.prazo, t.updated_at DESC
      LIMIT 10
    `).all(obra.id)
    const frentes = this.db.prepare(`
      SELECT f.*, COALESCE(SUM(i.quantidade*i.valor_unitario_centavos),0) orcado_centavos,
        COALESCE((SELECT SUM(c.valor_centavos) FROM contas c WHERE c.obra_id=f.obra_id AND c.frente_id=f.id AND c.tipo='pagar' AND c.deleted_at IS NULL AND c.status!='cancelado'),0) comprometido_centavos,
        COALESCE((SELECT SUM(co.valor_centavos) FROM contratos_obra co WHERE co.obra_id=f.obra_id AND co.frente_id=f.id AND co.deleted_at IS NULL AND co.status NOT IN ('cancelado','encerrado')),0) contratado_centavos,
        COALESCE((SELECT SUM(c.valor_centavos) FROM contas c WHERE c.obra_id=f.obra_id AND c.frente_id=f.id AND c.tipo='pagar' AND c.deleted_at IS NULL AND c.status IN ('pago','parcialmente_pago')),0) pago_centavos,
        COALESCE((SELECT SUM(m.valor_liquido_centavos) FROM medicoes m WHERE m.obra_id=f.obra_id AND m.frente_id=f.id AND m.deleted_at IS NULL AND m.status!='cancelada'),0) medido_centavos,
        COALESCE((SELECT SUM(c.valor_centavos) FROM contas c WHERE c.obra_id=f.obra_id AND c.frente_id=f.id AND c.tipo='receber' AND c.deleted_at IS NULL AND c.status='recebido'),0) recebido_centavos,
        COALESCE((SELECT COUNT(*) FROM tarefas_obra t WHERE t.obra_id=f.obra_id AND t.frente_id=f.id AND t.deleted_at IS NULL AND t.status NOT IN ('concluida','cancelada')),0) pendencias_abertas
      FROM frentes_obra f LEFT JOIN itens_orcamentarios i ON i.frente_id=f.id AND i.deleted_at IS NULL
      WHERE f.obra_id=? AND f.deleted_at IS NULL GROUP BY f.id ORDER BY f.ordem, f.nome
    `).all(obra.id)
    const equipe = this.db.prepare(`SELECT COUNT(DISTINCT funcionario_id) total FROM funcionario_obras WHERE obra_id=? AND (fim IS NULL OR fim >= date('now'))`).get(obra.id).total
    const documentos = this.db.prepare(`SELECT * FROM documentos WHERE obra_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 8`).all(obra.id)
    const contratos = this.db.prepare(`SELECT * FROM contratos_obra WHERE obra_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 8`).all(obra.id)
    const compras = this.db.prepare(`SELECT * FROM pedidos_compra WHERE obra_id=? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 8`).all(obra.id)
    return { obra, financeiro, orcado_centavos: Math.round(orcado), medido_centavos: medido, cronograma, rdos, pendencias, frentes, equipe_total: equipe, documentos, contratos, compras }
  }

  dre({ competencia, ano, empresa_id, obra_id } = {}) {
    const clauses = ['c.deleted_at IS NULL', "c.status!='cancelado'"]
    const params = {}
    if (competencia) { clauses.push('c.competencia=@competencia'); params.competencia = competencia }
    else { clauses.push('substr(c.competencia,1,4)=@ano'); params.ano = String(ano || new Date().getFullYear()) }
    if (empresa_id) { clauses.push('c.empresa_id=@empresa_id'); params.empresa_id = Number(empresa_id) }
    if (obra_id) { clauses.push('c.obra_id=@obra_id'); params.obra_id = Number(obra_id) }
    const rows = this.db.prepare(`
      SELECT c.competencia,c.tipo,COALESCE(cf.grupo_dre,'operacional') grupo,COALESCE(cf.nome,'Sem categoria') categoria,SUM(c.valor_centavos) valor
      FROM contas c LEFT JOIN categorias_financeiras cf ON cf.id=c.categoria_id
      WHERE ${clauses.join(' AND ')} GROUP BY c.competencia,c.tipo,grupo,categoria ORDER BY c.competencia,c.tipo,categoria
    `).all(params)
    return rows
  }

  accountPayment(contaId, payment) {
    return this.db.transaction(() => {
      const conta = this.get('contas', contaId)
      if (!conta) throw new Error('Conta não encontrada.')
      const valor = Number(payment.valor_centavos)
      if (!Number.isInteger(valor) || valor <= 0) throw new Error('Valor de pagamento inválido.')
      this.db.prepare('INSERT INTO pagamentos_conta(conta_id,valor_centavos,data,forma_pagamento,observacoes) VALUES (?,?,?,?,?)')
        .run(conta.id, valor, payment.data, payment.forma_pagamento || null, payment.observacoes || null)
      const paid = this.db.prepare('SELECT COALESCE(SUM(valor_centavos),0) total FROM pagamentos_conta WHERE conta_id=?').get(conta.id).total
      const status = paid >= conta.valor_centavos ? (conta.tipo === 'pagar' ? 'pago' : 'recebido') : 'parcialmente_pago'
      this.db.prepare('UPDATE contas SET status=?,data_efetiva=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, payment.data, conta.id)
      return { ...this.get('contas', conta.id), pago_centavos: paid }
    })()
  }

  saveMeasurement(payload) {
    return this.db.transaction(() => {
      const items = payload.itens || []
      for (const item of items) {
        const budget = this.get('itens_orcamentarios', item.item_orcamentario_id)
        const previous = this.db.prepare(`SELECT COALESCE(SUM(mi.quantidade_periodo),0) total FROM medicao_itens mi JOIN medicoes m ON m.id=mi.medicao_id WHERE mi.item_orcamentario_id=? AND m.deleted_at IS NULL AND m.status!='cancelada'`).get(item.item_orcamentario_id).total
        if (previous + Number(item.quantidade_periodo) > budget.quantidade && !item.justificativa_excesso) throw new Error(`Medição excede o orçamento do item ${budget.descricao}. Informe uma justificativa.`)
      }
      const medicao = this.save('medicoes', payload)
      if (payload.id) this.db.prepare('DELETE FROM medicao_itens WHERE medicao_id=?').run(medicao.id)
      const insert = this.db.prepare('INSERT INTO medicao_itens(medicao_id,item_orcamentario_id,etapa_id,descricao,unidade,quantidade_total,quantidade_periodo,quantidade_acumulada,valor_periodo_centavos,justificativa_excesso) VALUES (?,?,?,?,?,?,?,?,?,?)')
      for (const item of items) {
        const budget = item.item_orcamentario_id ? this.get('itens_orcamentarios', item.item_orcamentario_id) : null
        const previous = item.item_orcamentario_id ? this.db.prepare(`SELECT COALESCE(SUM(mi.quantidade_periodo),0) total FROM medicao_itens mi JOIN medicoes m ON m.id=mi.medicao_id WHERE mi.item_orcamentario_id=? AND mi.medicao_id!=? AND m.deleted_at IS NULL AND m.status!='cancelada'`).get(item.item_orcamentario_id, medicao.id).total : 0
        insert.run(medicao.id, item.item_orcamentario_id || null, item.etapa_id || budget?.etapa_id || null, item.descricao || budget?.descricao || 'Item medido', item.unidade || budget?.unidade || 'un', Number(item.quantidade_total || budget?.quantidade || 0), Number(item.quantidade_periodo || 0), Number(previous) + Number(item.quantidade_periodo || 0), Number(item.valor_periodo_centavos || 0), item.justificativa_excesso || null)
      }
      if (payload.conta?.empresa_id && Number(payload.valor_liquido_centavos) > 0 && ['faturada','recebida'].includes(payload.status)) {
        const existing = this.db.prepare("SELECT id FROM contas WHERE origem_tipo='medicao' AND origem_id=? AND deleted_at IS NULL").get(medicao.id)
        const account = {
          ...payload.conta, tipo: 'receber', obra_id: medicao.obra_id, frente_id: medicao.frente_id || null, medicao_id: medicao.id,
          descricao: payload.conta.descricao || `Medicao ${medicao.numero}`, valor_bruto_centavos: Number(payload.valor_bruto_centavos || payload.valor_liquido_centavos),
          retencoes_centavos: Number(payload.retencoes_centavos || 0), descontos_centavos: Number(payload.descontos_centavos || 0),
          valor_centavos: Number(payload.valor_liquido_centavos), origem_tipo: 'medicao', origem_id: medicao.id,
          status: payload.status === 'recebida' ? 'recebido' : 'pendente'
        }
        this.save('contas', existing ? { ...account, id: existing.id } : account)
      }
      this.audit('medicoes', medicao.id, 'salvar_medicao_com_itens', { obra_id: medicao.obra_id, frente_id: medicao.frente_id || null, itens: items.length, status: medicao.status })
      return medicao
    })()
  }
}

module.exports = { DatabaseService, TABLES }
