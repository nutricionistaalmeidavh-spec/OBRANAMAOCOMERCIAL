import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { loadRuntimeConfig, runtimeConfigForDiagnostics } from '../src/runtime-config.mjs'

const HOME = path.resolve('/tmp/obra-na-mao-home')

test('runtime config keeps safe backwards-compatible defaults', () => {
  const config = loadRuntimeConfig({ env: {}, homeDir: HOME })
  assert.equal(config.mode, 'lan')
  assert.equal(config.transport, 'local-network')
  assert.equal(config.host, '127.0.0.1')
  assert.equal(config.port, 4732)
  assert.equal(config.dataDir, path.join(HOME, '.obra-na-mao-lan'))
  assert.equal(config.backupDir, path.join(HOME, '.obra-na-mao-lan', 'backups'))
  assert.equal(config.logDir, path.join(HOME, '.obra-na-mao-lan', 'logs'))
  assert.equal(config.instanceName, 'Obra na Mão Server')
  assert.equal(config.cloudBaseUrl, 'https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev')
  assert.equal(config.showSetupCode, false)
  assert.equal(Object.isFrozen(config), true)
})

test('generic SERVER variables configure the headless runtime', () => {
  const config = loadRuntimeConfig({ env: { OBRA_NA_MAO_SERVER_HOST: ' 0.0.0.0 ', OBRA_NA_MAO_SERVER_PORT: '5843', OBRA_NA_MAO_SERVER_DATA_DIR: '/srv/obra/data', OBRA_NA_MAO_SERVER_BACKUP_DIR: '/srv/obra/backup', OBRA_NA_MAO_SERVER_LOG_DIR: '/srv/obra/log', OBRA_NA_MAO_SERVER_INSTANCE_NAME: ' Escritório Central ', OBRA_NA_MAO_PLATFORM_URL: ' https://example.test/ ' }, homeDir: HOME })
  assert.deepEqual(config, { mode:'lan', transport:'local-network', host: '0.0.0.0', port: 5843, dataDir: path.resolve('/srv/obra/data'), backupDir: path.resolve('/srv/obra/backup'), logDir: path.resolve('/srv/obra/log'), instanceName: 'Escritório Central', cloudBaseUrl: 'https://example.test', showSetupCode: false })
})

test('legacy LAN variables remain supported and generic SERVER variables take precedence', () => {
  const legacy = loadRuntimeConfig({ env: { OBRA_NA_MAO_LAN_HOST: '192.168.1.20', OBRA_NA_MAO_LAN_PORT: '4900', OBRA_NA_MAO_LAN_DATA_DIR: '/legacy/data', OBRA_NA_MAO_LAN_BACKUP_DIR: '/legacy/backup' }, homeDir: HOME })
  assert.equal(legacy.host, '192.168.1.20')
  assert.equal(legacy.port, 4900)
  assert.equal(legacy.dataDir, path.resolve('/legacy/data'))
  assert.equal(legacy.backupDir, path.resolve('/legacy/backup'))
  const preferred = loadRuntimeConfig({ env: { OBRA_NA_MAO_SERVER_HOST: '10.0.0.5', OBRA_NA_MAO_LAN_HOST: '192.168.1.20', OBRA_NA_MAO_SERVER_PORT: '5000', OBRA_NA_MAO_LAN_PORT: '4900', OBRA_NA_MAO_SERVER_DATA_DIR: '/server/data', OBRA_NA_MAO_LAN_DATA_DIR: '/legacy/data', OBRA_NA_MAO_SERVER_BACKUP_DIR: '/server/backup', OBRA_NA_MAO_LAN_BACKUP_DIR: '/legacy/backup' }, homeDir: HOME })
  assert.equal(preferred.host, '10.0.0.5')
  assert.equal(preferred.port, 5000)
  assert.equal(preferred.dataDir, path.resolve('/server/data'))
  assert.equal(preferred.backupDir, path.resolve('/server/backup'))
})

test('backup and log directories derive from the selected data directory when omitted', () => {
  const config = loadRuntimeConfig({ env: { OBRA_NA_MAO_SERVER_DATA_DIR: '/srv/obra/custom-data' }, homeDir: HOME })
  assert.equal(config.backupDir, path.resolve('/srv/obra/custom-data/backups'))
  assert.equal(config.logDir, path.resolve('/srv/obra/custom-data/logs'))
})

test('invalid TCP ports fail before the server can open a socket', () => {
  for (const value of ['0', '65536', '-1', 'abc', '4732abc', '12.5']) assert.throws(() => loadRuntimeConfig({ env: { OBRA_NA_MAO_SERVER_PORT: value }, homeDir: HOME }), /porta TCP válida entre 1 e 65535/i)
})

test('setup code display is secure by default and requires explicit opt-in', () => {
  assert.equal(loadRuntimeConfig({ env: {}, homeDir: HOME }).showSetupCode, false)
  assert.equal(loadRuntimeConfig({ env: { OBRA_NA_MAO_SERVER_SHOW_SETUP_CODE: 'true' }, homeDir: HOME }).showSetupCode, true)
  assert.equal(loadRuntimeConfig({ env: { OBRA_NA_MAO_SERVER_SHOW_SETUP_CODE: '1' }, homeDir: HOME }).showSetupCode, false)
})

test('diagnostic config is allowlisted and never exposes secret-shaped values', () => {
  const config = { ...loadRuntimeConfig({ env: {}, homeDir: HOME }), token: 'token-secret', password: 'password-secret', pairingCode: 'pairing-secret', snapshot: { secret: 'snapshot-secret' }, authorization: 'Bearer super-secret' }
  const diagnostic = runtimeConfigForDiagnostics(config)
  const serialized = JSON.stringify(diagnostic)
  assert.deepEqual(Object.keys(diagnostic).sort(), ['backupDir', 'dataDir', 'host', 'instanceName', 'logDir', 'mode', 'port', 'transport'].sort())
  for (const secret of ['token-secret', 'password-secret', 'pairing-secret', 'snapshot-secret', 'super-secret']) assert.equal(serialized.includes(secret), false)
})
