import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { FieldInbox } = require('./field-inbox.cjs')

function setup() {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE obras(id INTEGER PRIMARY KEY);INSERT INTO obras(id) VALUES(7);
  CREATE TABLE locais_obra(id INTEGER PRIMARY KEY AUTOINCREMENT,obra_id INTEGER NOT NULL,nome TEXT NOT NULL,tipo TEXT,nivel INTEGER,ordem INTEGER NOT NULL DEFAULT 0,created_at TEXT,updated_at TEXT,UNIQUE(obra_id,nome));
  CREATE UNIQUE INDEX idx_nivel ON locais_obra(obra_id,nivel) WHERE nivel IS NOT NULL;
  CREATE TABLE etapas_obra(id INTEGER PRIMARY KEY,obra_id INTEGER,nome TEXT,deleted_at TEXT);INSERT INTO etapas_obra VALUES(3,7,'Alvenaria',NULL);
  CREATE TABLE obra360_andamento(obra_id INTEGER NOT NULL,nivel INTEGER NOT NULL,servico TEXT NOT NULL,status TEXT NOT NULL,checklist_json TEXT NOT NULL DEFAULT '[]',updated_at TEXT NOT NULL,origem TEXT NOT NULL DEFAULT 'campo',PRIMARY KEY(obra_id,nivel,servico));
  CREATE TABLE rdos(id INTEGER PRIMARY KEY,obra_id INTEGER,data TEXT,deleted_at TEXT);INSERT INTO rdos VALUES(40,7,'2026-11-20',NULL);
  CREATE TABLE obra360_historico(id INTEGER PRIMARY KEY AUTOINCREMENT,obra_id INTEGER NOT NULL,origem_id TEXT NOT NULL,nivel INTEGER,servico TEXT,data TEXT NOT NULL,hora TEXT,descricao TEXT NOT NULL,origem TEXT NOT NULL DEFAULT 'campo',created_at TEXT,UNIQUE(obra_id,origem_id));
  CREATE TABLE obra360_locais_seed(remote_project_id TEXT NOT NULL,work_id INTEGER NOT NULL,imported INTEGER NOT NULL DEFAULT 0,seeded_at TEXT,PRIMARY KEY(remote_project_id,work_id));`)
  return { db, inbox: new FieldInbox({ database: { db }, peopleFor: () => [] }) }
}
const scope = { remoteProjectId: 'p1', workId: 7 }

describe('pavimentos do Obra360 no Desktop', () => {
  it('importa os pavimentos existentes uma única vez', () => {
    const { db, inbox } = setup()
    expect(inbox.seedFloors(scope, { floors: [{ number: 1 }, { number: 0 }, { number: -1 }, { number: 1 }] })).toBe(3)
    expect(db.prepare('SELECT nome,nivel FROM locais_obra ORDER BY nivel').all()).toEqual([{ nome: 'Subsolo 1', nivel: -1 }, { nome: 'Térreo', nivel: 0 }, { nome: '1º pavimento', nivel: 1 }])
    db.prepare('DELETE FROM locais_obra WHERE nivel=1').run()
    expect(inbox.seedFloors(scope, { floors: [{ number: 1 }, { number: 2 }] })).toBe(0)
    expect(db.prepare('SELECT COUNT(*) n FROM locais_obra').get()).toEqual({ n: 2 })
  })
  it('não importa quando o escritório já cadastrou pavimentos', () => {
    const { db, inbox } = setup()
    db.prepare("INSERT INTO locais_obra(obra_id,nome,nivel) VALUES(7,'Térreo',0)").run()
    expect(inbox.seedFloors(scope, { floors: [{ number: 5 }] })).toBe(0)
    expect(db.prepare('SELECT COUNT(*) n FROM locais_obra').get()).toEqual({ n: 1 })
  })
  it('aplica o andamento mais recente e mantém a alteração do escritório', () => {
    const { inbox } = setup()
    const state: any = { floors: [{ number: 0, stages: [{ service: 'etapa:3', status: 'in_progress', checklist: [{ id: 'a', label: 'Prumo', checked: true }] }] }, { number: 9, stages: [{ service: 'etapa:3', status: 'completed' }] }] }
    inbox.seedFloors(scope, state)
    expect(inbox.ingestProgress(scope, state)).toBe(2)
    const office = inbox.progressSave({ workId: 7, nivel: 0, service: 'etapa:3', status: 'completed', checklist: [] })
    state.floors[0].stages[0].updatedAt = '2020-01-01T00:00:00.000Z'
    expect(inbox.ingestProgress(scope, state)).toBe(0)
    expect(inbox.progressList(7).find((p: any) => p.nivel === 0)).toMatchObject({ status: 'completed', origin: 'escritorio', updatedAt: office.updatedAt })
    state.floors[0].stages[0].updatedAt = new Date(Date.now() + 60000).toISOString()
    expect(inbox.ingestProgress(scope, state)).toBe(1)
    expect(inbox.progressList(7).find((p: any) => p.nivel === 0)).toMatchObject({ status: 'in_progress', origin: 'campo' })
    expect(() => inbox.progressSave({ workId: 7, nivel: 50, service: 'etapa:3', status: 'completed' })).toThrow(/Pavimento/)
  })
  it('guarda o histórico do celular uma vez e liga ao RDO do dia', () => {
    const { inbox } = setup()
    const state: any = { history: [{ id: 'h1', service: 'etapa:3', floor: 0, date: '2026-11-20', time: '10:30', label: 'Alvenaria Térreo: em execução' }, { id: 'h2', floor: 1, date: '2026-11-21', label: 'Outro dia' }, { id: 'escritorio:x', date: '2026-11-21', label: 'eco do escritório' }, { id: 'h3', date: 'ontem', label: 'inválido' }] }
    expect(inbox.ingestHistory(scope, state)).toBe(2)
    expect(inbox.ingestHistory(scope, state)).toBe(0)
    const day = inbox.historyList({ workId: 7, date: '2026-11-20' })
    expect(day).toEqual([expect.objectContaining({ label: 'Alvenaria Térreo: em execução', time: '10:30', rdoId: 40, origin: 'campo' })])
    expect(inbox.historyList({ workId: 7, date: '2026-11-21' })[0].rdoId).toBeNull()
  })
  it('registra no histórico a alteração feita no escritório', () => {
    const { db, inbox } = setup()
    db.prepare("INSERT INTO locais_obra(obra_id,nome,nivel) VALUES(7,'Térreo',0)").run()
    inbox.progressSave({ workId: 7, nivel: 0, service: 'etapa:3', status: 'completed', checklist: [{ id: 'a', label: 'Prumo', checked: true }] })
    expect(inbox.historyList({ workId: 7, nivel: 0 })[0]).toMatchObject({ origin: 'escritorio', label: 'Alvenaria · Térreo: concluído (checklist 1/1) — escritório' })
  })
})
