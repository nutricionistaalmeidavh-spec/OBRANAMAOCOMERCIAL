import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { issueSetupCode, parseServerEnvironment, startWizard, updateServerEnvironment, validateServerSettings } from '../packaging/common/config-wizard.mjs'

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-server-wizard-'))
  const configPath = path.join(root, 'server.env')
  const source = `OBRA_NA_MAO_SERVER_MODE=lan\nOBRA_NA_MAO_SERVER_TRANSPORT=local-network\nOBRA_NA_MAO_SERVER_HOST=127.0.0.1\nOBRA_NA_MAO_SERVER_PORT=4732\nOBRA_NA_MAO_SERVER_DATA_DIR=${root}\nOBRA_NA_MAO_SERVER_BACKUP_ENABLED=true\nOBRA_NA_MAO_PLATFORM_URL=https://cloud.example\n`
  fs.writeFileSync(configPath, source)
  return { root, source, configPath, dispose:()=>fs.rmSync(root,{recursive:true,force:true}) }
}

const ready = async () => ({ ready:true, identity: {serverId:'srv-123'} })

test('wizard preserves cloud/storage/backup settings while writing only safe reverse-proxy configuration', () => {
  const source = 'OBRA_NA_MAO_SERVER_BACKUP_ENABLED=true\nOBRA_NA_MAO_SERVER_MODE=lan\nOBRA_NA_MAO_SERVER_PORT=4732\n'
  const next = updateServerEnvironment(source, { publicUrl:'https://obras.example.com',port:4980 })
  const cfg = parseServerEnvironment(next)
  assert.equal(cfg.OBRA_NA_MAO_SERVER_BACKUP_ENABLED,'true')
  assert.equal(cfg.OBRA_NA_MAO_SERVER_MODE,'remote')
  assert.equal(cfg.OBRA_NA_MAO_SERVER_TRANSPORT,'reverse-proxy')
  assert.equal(cfg.OBRA_NA_MAO_SERVER_HOST,'127.0.0.1')
  assert.equal(cfg.OBRA_NA_MAO_SERVER_PORT,'4980')
  assert.equal(cfg.OBRA_NA_MAO_SERVER_PUBLIC_URL,'https://obras.example.com')
})

test('wizard rejects unsafe endpoint and invalid ports', () => {
  for (const publicUrl of ['http://public.example.com','https://user:pass@public.example.com','https://public.example.com/a','https://public.example.com/?token=x','not-a-url']) {
    assert.throws(()=>validateServerSettings({publicUrl,port:4732}))
  }
  for (const port of [0,80,65536,4734,'NaN']) assert.throws(()=>validateServerSettings({publicUrl:'https://public.example.com',port}))
})

test('HTTP setup wizard only allows tokenized localhost requests and saves/restarts server', async () => {
  const f=fixture();let restarts=0
  const wizard=await startWizard({configPath:f.configPath,port:0,probe:ready,restartService:async()=>{restarts++}})
  try {
    const base=new URL(wizard.url).origin
    const token=new URL(wizard.url).searchParams.get('token')
    const page=await fetch(wizard.url)
    assert.equal(page.status,200)
    assert.match(await page.text(),/Configurar servidor/)
    assert.equal((await fetch(`${base}/api/state`)).status,403)
    const saved=await fetch(`${base}/api/config`,{method:'POST',headers:{'content-type':'application/json','origin':base,'x-setup-token':token},body:JSON.stringify({publicUrl:'https://obras.example.com',port:4949})})
    assert.equal(saved.status,200)
    assert.equal((await saved.json()).serverId,'srv-123')
    assert.equal(restarts,1)
    assert.equal(parseServerEnvironment(fs.readFileSync(f.configPath,'utf8')).OBRA_NA_MAO_SERVER_PORT,'4949')
    const evil=await fetch(`${base}/api/config`,{method:'POST',headers:{'content-type':'application/json','origin':'https://other.example','x-setup-token':token},body:JSON.stringify({publicUrl:'https://other.example',port:5555})})
    assert.equal(evil.status,403)
  } finally {await wizard.close();f.dispose()}
})

test('failed restart rolls back previous config and attempts original service restart', async()=>{
  const f=fixture();let calls=0
  const wizard=await startWizard({configPath:f.configPath,port:0,restartService:async()=>{calls++;if(calls===1)throw new Error('restart failed')},probe:ready})
  try {
    const base=new URL(wizard.url).origin,token=new URL(wizard.url).searchParams.get('token')
    const r=await fetch(`${base}/api/config`,{method:'POST',headers:{'content-type':'application/json',origin:base,'x-setup-token':token},body:JSON.stringify({publicUrl:'https://obras.example.com',port:4732})})
    assert.equal(r.status,400)
    assert.match((await r.json()).error,/revertida/i)
    assert.equal(fs.readFileSync(f.configPath,'utf8'),f.source)
    assert.equal(calls,2)
  } finally {await wizard.close();f.dispose()}
})

test('one-time bootstrap code updates canonical SQLite hash without revealing database secrets',()=>{
  const f=fixture(), dbFile=path.join(f.root,'obra-na-mao-lan.sqlite')
  const db=new DatabaseSync(dbFile)
  db.exec('CREATE TABLE lan_server_identity (id INTEGER PRIMARY KEY,server_id TEXT,company_id TEXT,setup_code_hash TEXT); INSERT INTO lan_server_identity(id,server_id) VALUES(1,\'server-a\');')
  db.close()
  try {
    const result=issueSetupCode(f.configPath)
    assert.match(result.code,/^[A-F0-9]{5}-[A-F0-9]{5}$/)
    assert.equal(result.serverId,'server-a')
    const copy=new DatabaseSync(dbFile)
    const row=copy.prepare('SELECT setup_code_hash FROM lan_server_identity WHERE id=1').get()
    assert.equal(row.setup_code_hash,crypto.createHash('sha256').update(result.code).digest('hex'))
    copy.prepare("UPDATE lan_server_identity SET company_id='company-a' WHERE id=1").run()
    copy.close()
    assert.throws(()=>issueSetupCode(f.configPath),/já vinculado/i)
  } finally {f.dispose()}
})