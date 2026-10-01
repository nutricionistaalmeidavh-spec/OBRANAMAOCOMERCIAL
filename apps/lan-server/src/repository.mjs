import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { applyLanMigrations } from './migrations.mjs'

const TABLE_FIELDS = {
  empresas: new Set(['razao_social', 'nome_fantasia', 'cnpj', 'telefone', 'email', 'endereco', 'observacoes', 'status']),
  clientes: new Set(['empresa_id', 'nome', 'documento', 'telefone', 'email', 'observacoes']),
  obras: new Set(['empresa_id', 'cliente_id', 'nome', 'codigo', 'endereco', 'responsavel', 'valor_contratado_centavos', 'data_inicio', 'previsao_termino', 'status', 'percentual_fisico', 'observacoes']),
  frentes_obra: new Set(['obra_id', 'nome', 'codigo', 'ordem', 'status', 'observacoes']),
  tarefas_obra: new Set(['obra_id', 'frente_id', 'rdo_ocorrencia_id', 'titulo', 'descricao', 'responsavel', 'prazo', 'prioridade', 'status', 'origem_tipo', 'origem_id', 'concluido_em']),
  rdos: new Set(['obra_id', 'frente_id', 'data', 'clima', 'status', 'atividades', 'observacoes']),
  rdo_equipe: new Set(['rdo_id', 'frente_id', 'funcionario_id', 'nome', 'funcao', 'horas', 'custo_centavos', 'observacoes']),
  rdo_equipamentos: new Set(['rdo_id', 'frente_id', 'nome', 'horas_uso', 'custo_centavos', 'observacoes']),
  rdo_ocorrencias: new Set(['rdo_id', 'frente_id', 'tipo', 'descricao', 'status', 'prioridade', 'responsavel', 'prazo']),
  rdo_anexos: new Set(['rdo_id', 'frente_id', 'documento_id', 'legenda']),
  etapas_obra: new Set(['obra_id', 'frente_id', 'nome', 'ordem', 'status']),
  cronograma_etapas: new Set(['obra_id', 'etapa_id', 'frente_id', 'nome', 'responsavel', 'previsto_inicio', 'previsto_fim', 'percentual_previsto', 'percentual_realizado', 'custo_planejado_centavos', 'custo_realizado_centavos', 'status', 'observacoes']),
  itens_orcamentarios: new Set(['obra_id', 'etapa_id', 'frente_id', 'codigo', 'descricao', 'unidade', 'quantidade', 'valor_unitario_centavos', 'tipo', 'observacoes', 'atualizado_em']),
  fornecedores: new Set(['empresa_id', 'nome', 'documento', 'telefone', 'email', 'observacoes']),
  categorias_financeiras: new Set(['nome', 'natureza', 'grupo_dre', 'ativa']),
  contas: new Set(['tipo', 'empresa_id', 'obra_id', 'frente_id', 'fornecedor_id', 'cliente_id', 'categoria_id', 'medicao_id', 'descricao', 'competencia', 'emissao', 'vencimento', 'valor_bruto_centavos', 'retencoes_centavos', 'descontos_centavos', 'valor_centavos', 'forma_pagamento', 'status', 'data_efetiva', 'recorrencia', 'parcela_atual', 'total_parcelas', 'origem_tipo', 'origem_id', 'observacoes']),
  pagamentos_conta: new Set(['conta_id', 'valor_centavos', 'data', 'forma_pagamento', 'observacoes', 'request_id']),
  cargos: new Set(['empresa_id', 'nome', 'cbo', 'salario_base_centavos', 'ativo']),
  beneficios: new Set(['empresa_id', 'nome', 'tipo', 'valor_padrao_centavos', 'ativo']),
  funcionarios: new Set([
    'empresa_id', 'obra_atual_id', 'cargo_id', 'nome', 'cpf', 'rg', 'rg_emissao', 'rg_orgao',
    'data_nascimento', 'naturalidade', 'nacionalidade', 'estado_civil', 'sexo', 'escolaridade',
    'pai', 'mae', 'ctps', 'ctps_serie', 'pis', 'cnh', 'titulo_eleitor', 'certificado_reservista',
    'telefone', 'email', 'endereco', 'cep', 'departamento', 'admissao', 'salario_centavos', 'status',
    'banco', 'agencia', 'conta_bancaria', 'pix', 'matricula', 'jornada_inicio', 'jornada_fim',
    'intervalo_inicio', 'intervalo_fim', 'experiencia_dias', 'experiencia_fim', 'vale_transporte_opcao',
    'vale_transporte_detalhes', 'observacoes'
  ]),
  funcionario_obras: new Set(['empresa_id', 'funcionario_id', 'obra_id', 'inicio', 'fim', 'observacoes']),
  cargo_beneficios: new Set(['empresa_id', 'cargo_id', 'beneficio_id', 'valor_centavos', 'quinzena', 'natureza', 'ativo']),
  funcionario_beneficios: new Set(['empresa_id', 'funcionario_id', 'beneficio_id', 'valor_centavos', 'inicio', 'fim']),
  folhas_pagamento: new Set(['empresa_id', 'competencia', 'status', 'fechada_em', 'conta_id']),
  folha_lancamentos: new Set(['empresa_id', 'folha_id', 'funcionario_id', 'tipo', 'descricao', 'natureza', 'quinzena', 'valor_centavos', 'quantidade', 'data', 'origem', 'editavel', 'status']),
  pagamentos_funcionario: new Set(['empresa_id', 'funcionario_id', 'folha_id', 'competencia', 'quinzena', 'valor_centavos', 'data', 'status', 'observacoes', 'forma_pagamento', 'confirmado_em']),
  pontos_mensais: new Set(['empresa_id', 'funcionario_id', 'competencia', 'status', 'preenchimento_automatico', 'jornada_inicio', 'intervalo_inicio', 'intervalo_fim', 'jornada_fim']),
  ponto_marcacoes: new Set(['empresa_id', 'ponto_mensal_id', 'data', 'tipo', 'entrada', 'intervalo_saida', 'intervalo_entrada', 'saida', 'observacoes']),
  epis: new Set(['empresa_id', 'nome', 'ca', 'unidade', 'ativo']),
  funcionario_epis: new Set(['empresa_id', 'funcionario_id', 'epi_id', 'data_entrega', 'quantidade', 'data_devolucao', 'quantidade_devolvida', 'observacoes'])
}

const TABLE_META = {
  empresas: { softDelete: true, updatedAt: true, order: 'updated_at DESC' },
  clientes: { softDelete: true, updatedAt: true, order: 'nome COLLATE NOCASE' },
  obras: { softDelete: true, updatedAt: true, order: 'updated_at DESC' },
  frentes_obra: { softDelete: true, updatedAt: true, order: 'ordem, nome COLLATE NOCASE' },
  tarefas_obra: { softDelete: true, updatedAt: true, order: 'updated_at DESC, id DESC' },
  rdos: { softDelete: true, updatedAt: true, order: 'data DESC, id DESC' },
  rdo_equipe: { softDelete: false, updatedAt: false, order: 'id' },
  rdo_equipamentos: { softDelete: false, updatedAt: false, order: 'id' },
  rdo_ocorrencias: { softDelete: false, updatedAt: true, order: 'updated_at DESC, id DESC' },
  rdo_anexos: { softDelete: false, updatedAt: false, order: 'id DESC' },
  etapas_obra: { softDelete: true, updatedAt: true, order: 'ordem, nome COLLATE NOCASE' },
  cronograma_etapas: { softDelete: true, updatedAt: true, order: 'previsto_fim, id' },
  itens_orcamentarios: { softDelete: true, updatedAt: true, order: 'codigo, descricao COLLATE NOCASE, id' },
  fornecedores: { softDelete: true, updatedAt: true, order: 'nome COLLATE NOCASE, id' },
  categorias_financeiras: { softDelete: false, updatedAt: false, order: 'nome COLLATE NOCASE, id' },
  contas: { softDelete: true, updatedAt: true, order: 'vencimento DESC, id DESC' },
  pagamentos_conta: { softDelete: false, updatedAt: false, order: 'data DESC, id DESC' },
  cargos: { softDelete: false, updatedAt: false, order: 'nome COLLATE NOCASE, id' },
  beneficios: { softDelete: false, updatedAt: false, order: 'nome COLLATE NOCASE, id' },
  funcionarios: { softDelete: true, updatedAt: true, order: 'nome COLLATE NOCASE, id' },
  funcionario_obras: { softDelete: false, updatedAt: false, order: 'inicio DESC, id DESC' },
  cargo_beneficios: { softDelete: false, updatedAt: false, order: 'cargo_id, beneficio_id, id' },
  funcionario_beneficios: { softDelete: false, updatedAt: false, order: 'inicio DESC, id DESC' },
  folhas_pagamento: { softDelete: false, updatedAt: true, order: 'competencia DESC, id DESC' },
  folha_lancamentos: { softDelete: false, updatedAt: true, order: 'quinzena, id' },
  pagamentos_funcionario: { softDelete: false, updatedAt: false, order: 'data DESC, id DESC' },
  pontos_mensais: { softDelete: false, updatedAt: true, order: 'competencia DESC, id DESC' },
  ponto_marcacoes: { softDelete: false, updatedAt: true, order: 'data, id' },
  epis: { softDelete: false, updatedAt: false, order: 'nome COLLATE NOCASE, id' },
  funcionario_epis: { softDelete: false, updatedAt: false, order: 'data_entrega DESC, id DESC' }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS empresas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa','inativa')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER REFERENCES empresas(id),
  nome TEXT NOT NULL,
  documento TEXT,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS obras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  cliente_id INTEGER REFERENCES clientes(id),
  nome TEXT NOT NULL,
  codigo TEXT,
  endereco TEXT,
  responsavel TEXT,
  valor_contratado_centavos INTEGER NOT NULL DEFAULT 0 CHECK(valor_contratado_centavos >= 0),
  data_inicio TEXT,
  previsao_termino TEXT,
  status TEXT NOT NULL DEFAULT 'planejada',
  percentual_fisico REAL NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
`

function normalizeError(error) {
  const message = error instanceof Error ? error.message : String(error)
  if (/FOREIGN KEY constraint failed/i.test(message)) return new Error(`Falha de referência: ${message}`)
  return error
}

export class LanRepository {
  constructor({ filename }) {
    if (!filename) throw new Error('Arquivo do banco LAN não informado.')
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true })
    this.db = new DatabaseSync(filename)
    this.db.exec('PRAGMA foreign_keys = ON;')
    this.db.exec('PRAGMA busy_timeout = 5000;')
    if (filename !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec(SCHEMA)
  }

  connection() { return this.db }
  applyMigrations(migrationsDir) { return applyLanMigrations(this.db, migrationsDir) }

  assertTable(table) {
    if (!Object.hasOwn(TABLE_FIELDS, table)) throw new Error('Entidade não disponível no servidor da empresa.')
  }

  cleanData(table, data) {
    this.assertTable(table)
    const allowed = TABLE_FIELDS[table]
    return Object.fromEntries(Object.entries(data || {}).filter(([key]) => allowed.has(key)))
  }

  list(table, filters = {}) {
    this.assertTable(table)
    const allowed = TABLE_FIELDS[table]
    const meta = TABLE_META[table]
    const where = meta.softDelete ? ['deleted_at IS NULL'] : ['1=1']
    const values = []
    for (const [key, value] of Object.entries(filters || {})) {
      if (!allowed.has(key) || value === '' || value === null || value === undefined) continue
      where.push(`${key} = ?`)
      values.push(value)
    }
    return this.db.prepare(`SELECT * FROM ${table} WHERE ${where.join(' AND ')} ORDER BY ${meta.order}`).all(...values)
  }

  get(table, id) {
    this.assertTable(table)
    return this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(id)) || null
  }

  planningReference(table, id, obraId, label) {
    if (id === null || id === undefined || id === '') return
    const row = this.db.prepare(`SELECT obra_id, deleted_at FROM ${table} WHERE id = ?`).get(Number(id))
    if (!row || row.deleted_at || Number(row.obra_id) !== Number(obraId)) throw new Error(`${label} deve pertencer à mesma obra.`)
  }

  validatePlanningOwnership(table, data, clean) {
    if (!['etapas_obra', 'cronograma_etapas', 'itens_orcamentarios'].includes(table)) return
    const current = data?.id ? this.get(table, data.id) : null
    const value = key => Object.hasOwn(clean, key) ? clean[key] : current?.[key]
    const obraId = value('obra_id')
    if (obraId === null || obraId === undefined || obraId === '') return
    this.planningReference('frentes_obra', value('frente_id'), obraId, 'Frente')
    if (table !== 'etapas_obra') this.planningReference('etapas_obra', value('etapa_id'), obraId, 'Etapa')
  }

  financeCompanyReference(table, id, companyId, label) {
    if (id === null || id === undefined || id === '') return
    const row = this.db.prepare(`SELECT empresa_id, deleted_at FROM ${table} WHERE id = ?`).get(Number(id))
    if (!row || row.deleted_at || (row.empresa_id !== null && Number(row.empresa_id) !== Number(companyId))) {
      throw new Error(`${label} deve pertencer à mesma empresa.`)
    }
  }

  validateFinanceOwnership(table, data, clean) {
    if (table !== 'contas') return
    const current = data?.id ? this.get(table, data.id) : null
    const value = key => Object.hasOwn(clean, key) ? clean[key] : current?.[key]
    const companyId = value('empresa_id')
    if (companyId === null || companyId === undefined || companyId === '') return

    const workId = value('obra_id')
    if (workId !== null && workId !== undefined && workId !== '') {
      const work = this.db.prepare('SELECT empresa_id, deleted_at FROM obras WHERE id = ?').get(Number(workId))
      if (!work || work.deleted_at || Number(work.empresa_id) !== Number(companyId)) throw new Error('Obra deve pertencer à mesma empresa.')
    }

    const frontId = value('frente_id')
    if (frontId !== null && frontId !== undefined && frontId !== '') {
      if (workId === null || workId === undefined || workId === '') throw new Error('Frente financeira exige uma obra da mesma empresa.')
      this.planningReference('frentes_obra', frontId, workId, 'Frente')
    }

    this.financeCompanyReference('fornecedores', value('fornecedor_id'), companyId, 'Fornecedor')
    this.financeCompanyReference('clientes', value('cliente_id'), companyId, 'Cliente')
  }

  rhCompanyReference(table, id, companyId, label) {
    if (id === null || id === undefined || id === '') return null
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name)
    const deletedColumn = columns.includes('deleted_at') ? ', deleted_at' : ''
    const row = this.db.prepare(`SELECT empresa_id${deletedColumn} FROM ${table} WHERE id=?`).get(Number(id))
    if (!row || row.deleted_at || Number(row.empresa_id) !== Number(companyId)) throw new Error(`${label} deve pertencer à mesma empresa.`)
    return row
  }

  validateRhOwnership(table, data, clean) {
    const rhTables = new Set([
      'cargos', 'beneficios', 'funcionarios', 'funcionario_obras', 'cargo_beneficios',
      'funcionario_beneficios', 'folhas_pagamento', 'folha_lancamentos', 'pagamentos_funcionario',
      'pontos_mensais', 'ponto_marcacoes', 'epis', 'funcionario_epis'
    ])
    if (!rhTables.has(table)) return
    const current = data?.id ? this.get(table, data.id) : null
    const value = key => Object.hasOwn(clean, key) ? clean[key] : current?.[key]
    const companyId = Number(value('empresa_id'))
    if (!Number.isSafeInteger(companyId) || companyId <= 0) throw new Error('Empresa do registro RH não informada.')
    const company = this.db.prepare('SELECT id,deleted_at FROM empresas WHERE id=?').get(companyId)
    if (!company || company.deleted_at) throw new Error('Empresa do registro RH não encontrada.')

    if (table === 'funcionarios') {
      this.rhCompanyReference('obras', value('obra_atual_id'), companyId, 'Obra atual')
      this.rhCompanyReference('cargos', value('cargo_id'), companyId, 'Cargo')
    } else if (table === 'funcionario_obras') {
      this.rhCompanyReference('funcionarios', value('funcionario_id'), companyId, 'Funcionário')
      this.rhCompanyReference('obras', value('obra_id'), companyId, 'Obra')
    } else if (table === 'cargo_beneficios') {
      this.rhCompanyReference('cargos', value('cargo_id'), companyId, 'Cargo')
      this.rhCompanyReference('beneficios', value('beneficio_id'), companyId, 'Benefício')
    } else if (table === 'funcionario_beneficios') {
      this.rhCompanyReference('funcionarios', value('funcionario_id'), companyId, 'Funcionário')
      this.rhCompanyReference('beneficios', value('beneficio_id'), companyId, 'Benefício')
    } else if (table === 'folhas_pagamento') {
      this.rhCompanyReference('contas', value('conta_id'), companyId, 'Conta')
    } else if (table === 'folha_lancamentos') {
      this.rhCompanyReference('folhas_pagamento', value('folha_id'), companyId, 'Folha')
      this.rhCompanyReference('funcionarios', value('funcionario_id'), companyId, 'Funcionário')
    } else if (table === 'pagamentos_funcionario') {
      this.rhCompanyReference('funcionarios', value('funcionario_id'), companyId, 'Funcionário')
      this.rhCompanyReference('folhas_pagamento', value('folha_id'), companyId, 'Folha')
    } else if (table === 'pontos_mensais') {
      this.rhCompanyReference('funcionarios', value('funcionario_id'), companyId, 'Funcionário')
    } else if (table === 'ponto_marcacoes') {
      this.rhCompanyReference('pontos_mensais', value('ponto_mensal_id'), companyId, 'Ponto mensal')
    } else if (table === 'funcionario_epis') {
      this.rhCompanyReference('funcionarios', value('funcionario_id'), companyId, 'Funcionário')
      this.rhCompanyReference('epis', value('epi_id'), companyId, 'EPI')
    }
  }

  save(table, data) {
    this.assertTable(table)
    const clean = this.cleanData(table, data)
    const columns = Object.keys(clean)
    if (!columns.length) throw new Error('Nenhum dado válido informado.')
    const meta = TABLE_META[table]
    this.validatePlanningOwnership(table, data, clean)
    this.validateFinanceOwnership(table, data, clean)
    this.validateRhOwnership(table, data, clean)

    try {
      if (data?.id) {
        const assignments = columns.map(column => `${column} = ?`)
        if (meta.updatedAt) assignments.push('updated_at = CURRENT_TIMESTAMP')
        const result = this.db.prepare(`UPDATE ${table} SET ${assignments.join(', ')} WHERE id = ?`).run(...columns.map(column => clean[column]), Number(data.id))
        if (Number(result.changes) === 0) return null
        return this.get(table, data.id)
      }

      const placeholders = columns.map(() => '?').join(', ')
      const result = this.db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...columns.map(column => clean[column]))
      return this.get(table, Number(result.lastInsertRowid))
    } catch (error) {
      throw normalizeError(error)
    }
  }

  remove(table, id) {
    this.assertTable(table)
    const meta = TABLE_META[table]
    try {
      if (!meta.softDelete) {
        const result = this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(Number(id))
        return Number(result.changes) > 0
      }
      const result = this.db.prepare(`UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP${meta.updatedAt ? ', updated_at = CURRENT_TIMESTAMP' : ''} WHERE id = ? AND deleted_at IS NULL`).run(Number(id))
      return Number(result.changes) > 0
    } catch (error) {
      throw normalizeError(error)
    }
  }

  close() { this.db.close() }
}
