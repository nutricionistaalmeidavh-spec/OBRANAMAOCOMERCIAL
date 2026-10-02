import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const linuxDir = path.resolve(import.meta.dirname, '../packaging/linux')
const read = name => fs.readFileSync(path.join(linuxDir, name), 'utf8')

test('systemd unit runs the bundled F18 runtime as obra-na-mao with safe recovery', () => {
  const unit = read('obra-na-mao-server.service')
  assert.match(unit, /^User=obra-na-mao$/m)
  assert.match(unit, /^Group=obra-na-mao$/m)
  assert.match(unit, /^EnvironmentFile=\/etc\/obra-na-mao\/server\.env$/m)
  assert.match(unit, /^ExecStart=\/opt\/obra-na-mao\/server\/runtime\/node \/opt\/obra-na-mao\/server\/app\/src\/index\.mjs$/m)
  assert.match(unit, /^Restart=on-failure$/m)
  assert.match(unit, /^RestartSec=\d+s$/m)
  assert.match(unit, /^KillSignal=SIGTERM$/m)
  assert.match(unit, /^NoNewPrivileges=true$/m)
  assert.match(unit, /^ProtectSystem=strict$/m)
  assert.match(unit, /^PrivateTmp=true$/m)
  assert.match(unit, /^ReadWritePaths=\/var\/lib\/obra-na-mao \/var\/log\/obra-na-mao$/m)
  assert.doesNotMatch(unit, /User=root|Group=root/i)
})

test('Linux environment template uses persistent system paths and safe loopback defaults', () => {
  const env = read('server.env.template')
  assert.match(env, /^OBRA_NA_MAO_SERVER_MODE=lan$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_TRANSPORT=local-network$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_HOST=127\.0\.0\.1$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_PORT=4732$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_DATA_DIR=\/var\/lib\/obra-na-mao$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_BACKUP_DIR=\/var\/lib\/obra-na-mao\/backups$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_LOG_DIR=\/var\/log\/obra-na-mao$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_SHOW_SETUP_CODE=false$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_BACKUP_ENABLED=true$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_BACKUP_INTERVAL_HOURS=24$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_BACKUP_RETENTION=7$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_BACKUP_ENABLED=true$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_BACKUP_INTERVAL_HOURS=24$/m)
  assert.match(env, /^OBRA_NA_MAO_SERVER_BACKUP_RETENTION=7$/m)
  assert.doesNotMatch(env, /(bearer|password|secret|device_token|server_token)\s*=/i)
})

test('Linux build is self-contained, pinned to .nvmrc and verifies Node checksum', () => {
  const build = read('build.sh')
  assert.match(build, /vendor-lock\.json/i)
  assert.match(build, /\.nvmrc/i)
  assert.match(build, /linuxX64/i)
  assert.match(build, /sha256sum/i)
  assert.match(build, /build-package\.mjs/i)
  assert.match(build, /tar.*-czf/i)
  assert.doesNotMatch(build, /npm\s+install/i)
})

test('Linux packaging never mutates firewall state', () => {
  const unit = read('obra-na-mao-server.service')
  const build = read('build.sh')
  for (const content of [unit, build]) {
    assert.doesNotMatch(content, /\b(ufw|iptables|nft|firewall-cmd)\b/i)
  }
})
