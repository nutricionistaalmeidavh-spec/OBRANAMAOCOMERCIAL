import os from 'node:os'
import path from 'node:path'
import net from 'node:net'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 4732
const DEFAULT_INSTANCE_NAME = 'Obra na Mão Server'
const DEFAULT_CLOUD_BASE_URL = 'https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev'
const SERVER_MODES = new Set(['local','lan','remote'])
const SERVER_TRANSPORTS = new Set(['local-network','private-network','reverse-proxy'])

function firstNonBlank(...values) {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim()
  return undefined
}

function parsePort(value) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('OBRA_NA_MAO_SERVER_PORT deve ser uma porta TCP válida entre 1 e 65535.')
  return port
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback
  return String(value).trim().toLowerCase() === 'true'
}

function parsePositiveNumber(value, fallback, label) {
  const raw = value === undefined || value === null || String(value).trim() === '' ? fallback : Number(value)
  if (!Number.isFinite(raw) || raw <= 0) throw new Error(`${label} deve ser maior que zero.`)
  return raw
}

function parsePositiveInteger(value, fallback, label) {
  const raw = value === undefined || value === null || String(value).trim() === '' ? fallback : Number(value)
  if (!Number.isInteger(raw) || raw < 1) throw new Error(`${label} deve ser um inteiro maior ou igual a 1.`)
  return raw
}

function normalizeBaseUrl(value) { return value.trim().replace(/\/$/, '') }

function parseChoice(value, allowed, fallback, label) {
  const normalized = String(value || fallback).trim().toLowerCase()
  if (!allowed.has(normalized)) throw new Error(`${label} inválido: ${normalized}.`)
  return normalized
}

function isLoopbackHost(host) {
  const value = String(host || '').trim().toLowerCase()
  return value === '127.0.0.1' || value === '::1' || value === 'localhost'
}

function isPrivateIpv4(host) {
  const parts = String(host).split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a,b] = parts
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

function isPrivateIpv6(host) {
  const value = String(host || '').trim().toLowerCase()
  return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb')
}

function isPrivateNetworkHost(host) {
  const value = String(host || '').trim().toLowerCase()
  const family = net.isIP(value)
  if (family === 4) return isPrivateIpv4(value)
  if (family === 6) return isPrivateIpv6(value)
  return value === 'localhost' || value.endsWith('.local')
}

function validateExposure({ mode, transport, host }) {
  if (mode !== 'remote') return
  if (transport === 'local-network') throw new Error('Modo remote exige transporte seguro: private-network ou reverse-proxy.')
  if (host === '0.0.0.0' || host === '::') throw new Error('Modo remote não pode escutar em interface pública/wildcard sem transporte seguro.')
  if (transport === 'reverse-proxy' && !isLoopbackHost(host)) {
    throw new Error('Transporte reverse-proxy exige listener loopback (127.0.0.1/::1).')
  }
  if (transport === 'private-network' && !isPrivateNetworkHost(host)) {
    throw new Error('Transporte private-network exige endereço explícito de interface privada/VPN.')
  }
}

export function loadRuntimeConfig({ env = process.env, homeDir = os.homedir() } = {}) {
  const mode = parseChoice(env.OBRA_NA_MAO_SERVER_MODE, SERVER_MODES, 'lan', 'OBRA_NA_MAO_SERVER_MODE')
  const transport = parseChoice(env.OBRA_NA_MAO_SERVER_TRANSPORT, SERVER_TRANSPORTS, 'local-network', 'OBRA_NA_MAO_SERVER_TRANSPORT')
  const host = firstNonBlank(env.OBRA_NA_MAO_SERVER_HOST, env.OBRA_NA_MAO_LAN_HOST) || DEFAULT_HOST
  const rawPort = firstNonBlank(env.OBRA_NA_MAO_SERVER_PORT, env.OBRA_NA_MAO_LAN_PORT) || String(DEFAULT_PORT)
  const rawDataDir = firstNonBlank(env.OBRA_NA_MAO_SERVER_DATA_DIR, env.OBRA_NA_MAO_LAN_DATA_DIR) || path.join(homeDir, '.obra-na-mao-lan')
  const dataDir = path.resolve(rawDataDir)
  const backupDir = path.resolve(firstNonBlank(env.OBRA_NA_MAO_SERVER_BACKUP_DIR, env.OBRA_NA_MAO_LAN_BACKUP_DIR) || path.join(dataDir, 'backups'))
  const logDir = path.resolve(firstNonBlank(env.OBRA_NA_MAO_SERVER_LOG_DIR) || path.join(dataDir, 'logs'))
  const instanceName = firstNonBlank(env.OBRA_NA_MAO_SERVER_INSTANCE_NAME) || DEFAULT_INSTANCE_NAME
  const cloudBaseUrl = normalizeBaseUrl(firstNonBlank(env.OBRA_NA_MAO_PLATFORM_URL, env.FLUXO_DRE_PLATFORM_URL) || DEFAULT_CLOUD_BASE_URL)
  const showSetupCode = parseBoolean(env.OBRA_NA_MAO_SERVER_SHOW_SETUP_CODE)
  const backupEnabled = parseBoolean(env.OBRA_NA_MAO_SERVER_BACKUP_ENABLED, true)
  const backupIntervalHours = parsePositiveNumber(env.OBRA_NA_MAO_SERVER_BACKUP_INTERVAL_HOURS, 24, 'OBRA_NA_MAO_SERVER_BACKUP_INTERVAL_HOURS')
  const backupRetentionCount = parsePositiveInteger(env.OBRA_NA_MAO_SERVER_BACKUP_RETENTION, 7, 'OBRA_NA_MAO_SERVER_BACKUP_RETENTION')
  validateExposure({ mode, transport, host })
  return Object.freeze({
    mode, transport, host, port: parsePort(rawPort), dataDir, backupDir, logDir, instanceName, cloudBaseUrl, showSetupCode,
    backupEnabled, backupIntervalHours, backupRetentionCount
  })
}

export function runtimeConfigForDiagnostics(config) {
  return Object.freeze({ mode: config.mode, transport: config.transport, host: config.host, port: config.port, dataDir: config.dataDir, backupDir: config.backupDir, logDir: config.logDir, instanceName: config.instanceName, backupEnabled:config.backupEnabled, backupIntervalHours:config.backupIntervalHours, backupRetentionCount:config.backupRetentionCount })
}
