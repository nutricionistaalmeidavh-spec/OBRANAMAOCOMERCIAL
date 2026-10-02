import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const linuxDir = path.resolve(import.meta.dirname, '../packaging/linux')
const read = name => fs.readFileSync(path.join(linuxDir, name), 'utf8')

test('Linux installer requires root and amd64 and creates a non-login service user', () => {
  const install = read('install.sh')
  assert.match(install, /EUID.*0|id -u.*0/i)
  assert.match(install, /(uname -m|dpkg --print-architecture)/i)
  assert.match(install, /(x86_64|amd64)/i)
  assert.match(install, /useradd/i)
  assert.match(install, /obra-na-mao/i)
  assert.match(install, /(nologin|false)/i)
  assert.doesNotMatch(install, /useradd[^\n]*-m\b/i)
})

test('install and upgrade replace only runtime while preserving config and persistent data', () => {
  const install = read('install.sh')
  assert.match(install, /systemctl\s+stop\s+obra-na-mao-server\.service/i)
  assert.match(install, /\/opt\/obra-na-mao\/server/i)
  assert.match(install, /\/etc\/obra-na-mao\/server\.env/i)
  assert.match(install, /\/var\/lib\/obra-na-mao/i)
  assert.match(install, /\/var\/log\/obra-na-mao/i)
  assert.match(install, /if\s+\[\[?\s+!\s+-f\s+.*server\.env/i)
  assert.match(install, /server\.env\.template/i)
  assert.match(install, /chown/i)
  assert.doesNotMatch(install, /rm\s+-rf\s+["']?\/etc\/obra-na-mao/i)
  assert.doesNotMatch(install, /rm\s+-rf\s+["']?\/var\/lib\/obra-na-mao/i)
})

test('Linux installer reloads systemd, enables service and uses bundled Node for readiness', () => {
  const install = read('install.sh')
  assert.match(install, /systemctl\s+daemon-reload/i)
  assert.match(install, /systemctl\s+enable\s+--now\s+obra-na-mao-server\.service/i)
  assert.match(install, /\/ready/i)
  assert.match(install, /runtime\/node/i)
  assert.match(install, /(não ficou ready|not ready|readiness)/i)
  assert.doesNotMatch(install, /\b(curl|wget)\b/i)
})

test('Linux installer and uninstaller never mutate firewall rules', () => {
  for (const file of ['install.sh', 'uninstall.sh']) {
    const content = read(file)
    assert.doesNotMatch(content, /\b(ufw|iptables|nft|firewall-cmd)\b/i)
  }
})

test('default Linux uninstall removes service and runtime but preserves config and data', () => {
  const uninstall = read('uninstall.sh')
  assert.match(uninstall, /SERVICE_NAME=["']obra-na-mao-server\.service["']/i)
  assert.match(uninstall, /UNIT_PATH=["']\/etc\/systemd\/system\/\$SERVICE_NAME["']/i)
  assert.match(uninstall, /systemctl\s+disable\s+--now\s+obra-na-mao-server\.service/i)
  assert.match(uninstall, /rm\s+-f\s+["']\$UNIT_PATH["']/i)
  assert.match(uninstall, /rm\s+-rf\s+["']?\/opt\/obra-na-mao\/server/i)
  assert.match(uninstall, /systemctl\s+daemon-reload/i)
  assert.doesNotMatch(uninstall, /rm\s+-rf\s+["']?\/etc\/obra-na-mao/i)
  assert.doesNotMatch(uninstall, /rm\s+-rf\s+["']?\/var\/lib\/obra-na-mao/i)
  assert.doesNotMatch(uninstall, /--purge/i)
})
