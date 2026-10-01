import fs from 'node:fs'
import path from 'node:path'

function normalizeDirectory(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} deve ser um diretório de runtime válido.`)
  return path.resolve(value)
}

export function resolveRuntimePaths(config, { migrationsDir } = {}) {
  const dataDir = normalizeDirectory(config?.dataDir, 'dataDir')
  const backupDir = normalizeDirectory(config?.backupDir, 'backupDir')
  const logDir = normalizeDirectory(config?.logDir, 'logDir')
  const resolvedMigrationsDir = normalizeDirectory(migrationsDir, 'migrationsDir')
  return Object.freeze({ dataDir, backupDir, logDir, databasePath: path.join(dataDir, 'obra-na-mao-lan.sqlite'), migrationsDir: resolvedMigrationsDir })
}

export function ensureRuntimePaths(paths) {
  for (const directory of [paths.dataDir, paths.backupDir, paths.logDir]) {
    try {
      fs.mkdirSync(directory, { recursive: true })
      if (!fs.statSync(directory).isDirectory()) throw new Error('path is not a directory')
    } catch (error) {
      throw new Error(`Falha ao preparar diretório de runtime: ${directory}`, { cause: error })
    }
  }
  return paths
}
