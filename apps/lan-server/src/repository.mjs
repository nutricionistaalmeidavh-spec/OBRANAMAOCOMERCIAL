import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const TABLE_FIELDS = {
  empresas: new Set(['razao_social', 'nome_fantasia', 'cnpj', 'telefone', 'email', 'endereco', 'observacoes', 'status']),
  clientes: new Set(['empresa_id', 'nome', 'documento', 'telefone', 'email', 'observacoes']),
  obras: new Set(['empresa_id', 'cliente_id', 'nome', 'codigo', 'endereco', 'responsavel', 'valor_contratado_centavos', 'data_inicio', 'previsao_termino', 'status', 'percentual_fisico', 'observacoes'])
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
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    return new Error(`Falha de referência: ${message}`)
  }
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

  connection() {
    return this.db
  }

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
    const where = ['deleted_at IS NULL']
    const values = []
    for (const [key, value] of Object.entries(filters || {})) {
      if (!allowed.has(key) || value === '' || value === null || value === undefined) continue
      where.push(`${key} = ?`)
      values.push(value)
    }
    const order = table === 'empresas' ? 'updated_at DESC' : table === 'obras' ? 'updated_at DESC' : 'nome COLLATE NOCASE'
    return this.db.prepare(`SELECT * FROM ${table} WHERE ${where.join(' AND ')} ORDER BY ${order}`).all(...values)
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

    try {
      if (data?.id) {
        const assignments = columns.map((column) => `${column} = ?`)
        assignments.push('updated_at = CURRENT_TIMESTAMP')
        const result = this.db.prepare(`UPDATE ${table} SET ${assignments.join(', ')} WHERE id = ?`).run(...columns.map((column) => clean[column]), Number(data.id))
        if (Number(result.changes) === 0) return null
        return this.get(table, data.id)
      }

      const placeholders = columns.map(() => '?').join(', ')
      const result = this.db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...columns.map((column) => clean[column]))
      return this.get(table, Number(result.lastInsertRowid))
    } catch (error) {
      throw normalizeError(error)
    }
  }

  remove(table, id) {
    this.assertTable(table)
    const result = this.db.prepare(`UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`).run(Number(id))
    return Number(result.changes) > 0
  }

  close() {
    this.db.close()
  }
}
