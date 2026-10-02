import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const windowsDir = path.join(root, 'packaging', 'windows')

function read(name) {
  return fs.readFileSync(path.join(windowsDir, name), 'utf8')
}

test('WinSW service runs the bundled F18 runtime as LocalService with automatic recovery', () => {
  const xml = read('service.xml')
  assert.match(xml, /<id>ObraNaMaoServer<\/id>/)
  assert.match(xml, /<name>Obra na Mão Server<\/name>/)
  assert.match(xml, /\.\.\\runtime\\node\.exe/i)
  assert.match(xml, /\.\.\\app\\src\\index\.mjs/i)
  assert.match(xml, /<startmode>Automatic<\/startmode>/i)
  assert.match(xml, /NT AUTHORITY\\LocalService/i)
  assert.doesNotMatch(xml, /LocalSystem/i)
  assert.match(xml, /<onfailure action="restart"/i)
  assert.match(xml, /<stoptimeout>\d+ sec<\/stoptimeout>/i)
  assert.match(xml, /ProgramData.*ArtiSys.*Obra na Mão Server.*logs/is)
})

test('Windows environment template is safe, persistent and loopback-only by default', () => {
  const env = read('server.env.template')
  assert.match(env, /^OBRA_NA_MAO_SERVER_MODE=lan$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_TRANSPORT=local-network$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_HOST=127\.0\.0\.1$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_PORT=4732$/m)
  assert.match(env, /OBRA_NA_MAO_SERVER_DATA_DIR=.*ProgramData.*ArtiSys.*Obra na Mão Server.*data/im)
  assert.match(env, /OBRA_NA_MAO_SERVER_BACKUP_DIR=.*ProgramData.*ArtiSys.*Obra na Mão Server.*backups/im)
  assert.match(env, /OBRA_NA_MAO_SERVER_LOG_DIR=.*ProgramData.*ArtiSys.*Obra na Mão Server.*logs/im)
  assert.match(env, /^OBRA_NA_MAO_SERVER_SHOW_SETUP_CODE=false$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_BACKUP_ENABLED=true$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_BACKUP_INTERVAL_HOURS=24$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_BACKUP_RETENTION=7$/m)
  assert.doesNotMatch(env, /(bearer|password|secret|device_token|server_token)\s*=/i)
})

test('Windows build pins and verifies Node and WinSW before creating the package', () => {
  const script = read('build.ps1')
  assert.match(script, /vendor-lock\.json/i)
  assert.match(script, /node.*windowsX64/is)
  assert.match(script, /winsw/is)
  assert.match(script, /SHA256|Get-FileHash/i)
  assert.match(script, /build-package\.mjs/i)
  assert.doesNotMatch(script, /npm\s+install/i)
})

test('service control preserves ProgramData and grants only persistent paths to LocalService', () => {
  const script = read('service-control.ps1')
  assert.match(script, /LocalService/i)
  assert.match(script, /icacls/i)
  assert.match(script, /data/i)
  assert.match(script, /backups/i)
  assert.match(script, /logs/i)
  assert.match(script, /Environment/i)
  assert.doesNotMatch(script, /Remove-Item[^\n]*ProgramData/i)
  assert.doesNotMatch(script, /LocalSystem/i)
})
