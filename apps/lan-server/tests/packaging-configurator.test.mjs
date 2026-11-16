import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
const root = path.resolve(import.meta.dirname, '../packaging')
const read = pathPart => fs.readFileSync(path.join(root,pathPart),'utf8')

test('Windows installer exposes optional local setup UI from Start menu and finish screen', () => {
  const iss=read('windows/installer.iss')
  const build=read('windows/build.ps1')
  const launcher=read('windows/configure-server.ps1')
  assert.match(iss, /\[Icons\][\s\S]*configure-server\.ps1/i)
  assert.match(iss, /\[Run\][\s\S]*postinstall[\s\S]*skipifsilent/i)
  assert.match(build, /configure-server\.ps1/)
  assert.match(launcher, /WindowsBuiltInRole.*Administrator/)
  assert.match(launcher, /configurator\.mjs/)
})

test('Linux installed package supplies an independent local setup command', () => {
  assert.match(read('linux/build.sh'), /configure-server\.sh/)
  assert.match(read('linux/install.sh'), /obra-na-mao-configurar/)
  assert.match(read('linux/uninstall.sh'), /obra-na-mao-configurar/)
  const launcher=read('linux/configure-server.sh')
  assert.match(launcher, /sudo/)
  assert.match(launcher, /configurator\.mjs/)
})

test('configurator is local-only and never included as a public route', () => {
  const conf=fs.readFileSync(path.resolve(root,'../src/configurator.mjs'),'utf8')
  assert.match(conf, /app\.listen\(SETUP_PORT,'127\.0\.0\.1'/)
  assert.match(conf, /randomBytes\(32\)/)
  assert.match(conf, /configurator-ui\.html/)
  assert.match(conf, /restartInstalledService/)
  assert.match(conf, /generateClaimCode/)
})
