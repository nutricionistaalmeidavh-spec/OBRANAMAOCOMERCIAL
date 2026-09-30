import fs from 'node:fs'
import path from 'node:path'

function migrationFiles(migrationsDir) {
  if (!migrationsDir || !fs.existsSync(migrationsDir)) throw new Error('Diretório de migrations LAN não encontrado.')
  const migrations = fs.readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql'))
    .map(name => {
      const match = name.match(/^(\d+)_.*\.sql$/)
      if (!match) throw new Error(`Migration LAN com nome inválido: ${name}`)
      return { version: Number(match[1]), name, filename: path.join(migrationsDir, name) }
    })
    .sort((a, b) => a.version - b.version)

  const versions = new Set()
  for (const migration of migrations) {
    if (!Number.isSafeInteger(migration.version) || migration.version < 1) throw new Error(`Versão de migration LAN inválida: ${migration.name}`)
    if (versions.has(migration.version)) throw new Error(`Versão de migration LAN duplicada: ${migration.version}`)
    versions.add(migration.version)
  }
  return migrations
}

export function applyLanMigrations(db, migrationsDir) {
  if (!db?.exec || !db?.prepare) throw new Error('Banco LAN inválido para migrations.')
  const migrations = migrationFiles(migrationsDir)
  let current = Number(db.prepare('PRAGMA user_version').get()?.user_version || 0)
  const applied = []

  for (const migration of migrations) {
    if (migration.version <= current) continue
    const sql = fs.readFileSync(migration.filename, 'utf8')
    db.exec('BEGIN IMMEDIATE;')
    try {
      db.exec(sql)
      db.exec(`PRAGMA user_version = ${migration.version};`)
      db.exec('COMMIT;')
      current = migration.version
      applied.push(migration.version)
    } catch (error) {
      try { db.exec('ROLLBACK;') } catch {}
      throw new Error(`Falha ao aplicar migration LAN ${migration.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { version: current, applied }
}
