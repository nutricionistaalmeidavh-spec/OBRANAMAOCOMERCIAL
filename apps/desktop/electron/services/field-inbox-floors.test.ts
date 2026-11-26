import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { FieldInbox } = require('./field-inbox.cjs')

function setup() {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE obras(id INTEGER PRIMARY KEY);INSERT INTO obras(id) VALUES(7);
  CREATE TABLE locais_obra(id INTEGER PRIMARY KEY AUTOINCREMENT,obra_id INTEGER NOT NULL,nome TEXT NOT NULL,tipo TEXT,nivel INTEGER,ordem INTEGER NOT NULL DEFAULT 0,created_at TEXT,updated_at TEXT,UNIQUE(obra_id,nome));
  CREATE UNIQUE INDEX idx_nivel ON locais_obra(obra_id,nivel) WHERE nivel IS NOT NULL;
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
})
