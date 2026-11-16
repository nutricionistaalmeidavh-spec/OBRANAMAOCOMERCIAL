import assert from 'node:assert/strict'
import { randomBytes, createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import {
  validateServerSettings, mergeServerSettings, generateClaimCode,
  createSetupApp, writeServerConfig
} from '../src/configurator.mjs'

const ORIGINAL = `# keep settings from previous installations
OBRA_NA_MAO_SERVER_MODE=lan
OBRA_NA_MAO_SERVER_TRANSPORT=local-network
OBRA_NA_MAO_SERVER_HOST=127.0.0.1
OBRA_NA_MAO_SERVER_PORT=4732
OBRA_NA_MAO_SERVER_BACKUP_ENABLED=true
OBRA_NA_MAO_SERVER_BACKUP_RETENTION=7
OBRA_NA_MAO_PLATFORM_URL=https://cloud.example
`

test('accepts a prepared HTTPS origin and a valid internal port', () => {
  assert.deepEqual(validateServerSettings({ publicUrl: 'https://obras.cliente.com/', port: 4732 }), { publicUrl: 'https://obras.cliente.com', port: 4732 })
  assert.deepEqual(validateServerSettings({ publicUrl: 'https://cliente.com:8443', port: '5010' }), { publicUrl: 'https://cliente.com:8443', port: 5010 })
})

test('refuses unsafe or malformed public endpoints and reserved ports', () => {
  for (const url of ['http://public.example', 'https://user:pass@example.com', 'https://example.com/api', 'https://example.com?q=1', 'https://example.com/#frag', 'https://example.com:443\nX=evil', 'file:///etc/passwd']) {
    assert.throws(() => validateServerSettings({ publicUrl: url, port: 4732 }), /HTTPS|endereço|domínio|invalido|inválido/i, url)
  }
  for (const port of [0, 65536, 'abc', 4734, '4732\nBAD=1', 4.4]) assert.throws(() => validateServerSettings({ publicUrl: 'https://obras.example', port }), /porta/i)
})

test('updates only allowlisted transport settings and keeps backups, cloud URL, and CRLF', () => {
  const original = ORIGINAL.replaceAll('\n', '\r\n')
  const updated = mergeServerSettings(original, { publicUrl: 'https://obras.cliente.com', port: 5700 })
  assert.match(updated, /OBRA_NA_MAO_SERVER_MODE=remote\r\n/)
  assert.match(updated, /OBRA_NA_MAO_SERVER_TRANSPORT=reverse-proxy\r\n/)
  assert.match(updated, /OBRA_NA_MAO_SERVER_HOST=127\.0\.0\.1\r\n/)
  assert.match(updated, /OBRA_NA_MAO_SERVER_PORT=5700\r\n/)
  assert.match(updated, /OBRA_NA_MAO_SERVER_PUBLIC_URL=https:\/\/obras\.cliente\.com\r\n/)
  assert.match(updated, /OBRA_NA_MAO_SERVER_BACKUP_ENABLED=true\r\n/)
  assert.match(updated, /OBRA_NA_MAO_PLATFORM_URL=https:\/\/cloud\.example\r\n/)
  assert.equal(updated.match(/OBRA_NA_MAO_SERVER_PORT=/g).length, 1)
  assert.equal(updated.includes('\n') && updated.replaceAll('\r\n', '').includes('\n'), false)
})

test('writes config atomically without modifying existing persistent fields', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-config-test-'))
  try {
    const file = path.join(tmp, 'server.env')
    fs.writeFileSync(file, ORIGINAL, { mode: 0o600 })
    writeServerConfig(file, { publicUrl: 'https://cliente.example', port: 4900 })
    const result = fs.readFileSync(file, 'utf8')
    assert.match(result, /OBRA_NA_MAO_SERVER_PORT=4900/)
    assert.match(result, /OBRA_NA_MAO_SERVER_BACKUP_RETENTION=7/)
    assert.equal(fs.statSync(file).mode & 0o777, 0o600)
    assert.deepEqual(fs.readdirSync(tmp), ['server.env'])
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
})

test('generates one-time claim code only for an unclaimed server identity', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-claim-test-'))
  try {
    const dbPath = path.join(tmp, 'obra-na-mao-lan.sqlite')
    const db = new DatabaseSync(dbPath)
    db.exec('CREATE TABLE lan_server_identity (id INTEGER PRIMARY KEY, server_id TEXT, setup_code_hash TEXT, company_id TEXT);')
    db.prepare('INSERT INTO lan_server_identity (id, server_id, company_id) VALUES (1, ?, NULL)').run('srv-1')
    const code = generateClaimCode(dbPath)
    assert.match(code, /^[A-F0-9]{5}-[A-F0-9]{5}$/)
    const digest = createHash('sha256').update(code).digest('hex')
    assert.equal(db.prepare('SELECT setup_code_hash FROM lan_server_identity WHERE id=1').get().setup_code_hash, digest)
    db.prepare('UPDATE lan_server_identity SET company_id=? WHERE id=1').run('company-1')
    assert.throws(() => generateClaimCode(dbPath), /vinculad|autorizad/i)
    db.close()
  } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
})

test('local setup UI requires a random token and cannot be called by a public proxy', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-setup-http-'))
  const configPath = path.join(tmp, 'server.env')
  fs.writeFileSync(configPath, ORIGINAL)
  const token = randomBytes(32).toString('hex')
  const app = createSetupApp({configPath, token, restart: async () => {}, verifyReady: async () => true})
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve))
  const port = app.address().port
  const base = `http://127.0.0.1:${port}`
  const send = (url, opts) => fetch(base+url, opts)
  try {
    const unauth = await send('/api/status')
    assert.equal(unauth.status, 403)
    const wrongHostStatus = await new Promise((resolve,reject) => {
      const req=http.request({hostname:'127.0.0.1',port,path:'/api/status',headers:{host:'public.example:4734','x-setup-token':token}},res => {res.resume();res.on('end',()=>resolve(res.statusCode))});
      req.on('error',reject);req.end()
    })
    assert.equal(wrongHostStatus, 403)
    const good = await send('/api/status', {headers: {'x-setup-token':token}})
    assert.equal(good.status, 200)
    const body = await good.json()
    assert.equal(body.port, 4732)
    const invalidOrigin = await send('/api/save', {method:'POST', headers: {'x-setup-token':token,origin:'https://hostile.example','content-type':'application/json'},body:JSON.stringify({port:5100,publicUrl:'https://cliente.example'})})
    assert.equal(invalidOrigin.status, 403)
    assert.match(fs.readFileSync(configPath,'utf8'),/OBRA_NA_MAO_SERVER_PORT=4732/)
  } finally { app.close();fs.rmSync(tmp,{recursive:true,force:true}) }
})

test('service restart failure restores old configuration without modifying data', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-setup-rollback-'))
  const configPath = path.join(tmp, 'server.env')
  fs.writeFileSync(configPath, ORIGINAL)
  const token = randomBytes(32).toString('hex')
  const app = createSetupApp({configPath,token,restart:async () => {throw new Error('service unavailable')}})
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve))
  const port=app.address().port
  try {
    const res=await fetch(`http://127.0.0.1:${port}/api/save`,{method:'POST',headers:{'x-setup-token':token,'content-type':'application/json',origin:`http://127.0.0.1:${port}`},body:JSON.stringify({port:4900,publicUrl:'https://cliente.example'})})
    assert.equal(res.status,500)
    assert.equal(fs.readFileSync(configPath,'utf8'), ORIGINAL)
  }finally{app.close();fs.rmSync(tmp,{recursive:true,force:true})}
})
