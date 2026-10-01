import os from 'node:os'
import path from 'node:path'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 4732
const DEFAULT_INSTANCE_NAME = 'Obra na Mão Server'
const DEFAULT_CLOUD_BASE_URL = 'https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev'

function firstNonBlank(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function normalizeDirectory(value) {
  return path.resolve(value)
}

function parsePort(value) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('OBRA_NA_MAO_SERVER_PORT deve ser uma porta TCP válida entre 1 e 65535.')
  }
  return port
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/$/, '')
}

export function loadRuntimeConfig({ env = process.env, homeDir = os.homedir() } = {}) {
  const host = firstNonBlank(env.OBRA_NA_MAO_SERVER_HOST, env.OBRA_NA_MAO_LAN_HOST) || DEFAULT_HOST
  const rawPort = firstNonBlank(env.OBRA_NA_MAO_SERVER_PORT, env.OBRA_NA_MAO_LAN_PORT) || String(DEFAULT_PORT)
  const rawDataDir = firstNonBlank(env.OBRA_NA_MAO_SERVER_DATA_DIR, env.OBRA_NA_MAO_LAN_DATA_DIR) || path.join(homeDir, '.obra-na-mao-lan')
  const dataDir = normalizeDirectory(rawDataDir)
  const backupDir = normalizeDirectory(firstNonBlank(env.OBRA_NA_MAO_SERVER_BACKUP_DIR) || path.join(dataDir, 'backups'))
  const logDir = normalizeDirectory(firstNonBlank(env.OBRA_NA_MAO_SERVER_LOG_DIR) || path.join(dataDir, 'logs'))
  const instanceName = firstNonBlank(env.OBRA_NA_MAO_SERVER_INSTANCE_NAME) || DEFAULT_INSTANCE_NAME
  const cloudBaseUrl = normalizeBaseUrl(
    firstNonBlank(env.OBRA_NA_MAO_PLATFORM_URL, env.FLUXO_DRE_PLATFORM_URL) || DEFAULT_CLOUD_BASE_URL
  )

  return Object.freeze({
    host,
    port: parsePort(rawPort),
    dataDir,
    backupDir,
    logDir,
    instanceName,
    cloudBaseUrl
  })
}

export function runtimeConfigForDiagnostics(config) {
  return Object.freeze({
    host: config.host,
    port: config.port,
    dataDir: config.dataDir,
    backupDir: config.backupDir,
    logDir: config.logDir,
    instanceName: config.instanceName
  })
}
