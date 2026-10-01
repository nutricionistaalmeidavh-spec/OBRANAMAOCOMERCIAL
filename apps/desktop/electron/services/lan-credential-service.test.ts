import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const dirs:string[]=[]
const tempDir=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'obn-lan-cred-'));dirs.push(dir);return dir}
afterEach(()=>{while(dirs.length)fs.rmSync(dirs.pop()!,{recursive:true,force:true})})

function safeStorage(){
  return {
    isEncryptionAvailable:()=>true,
    encryptString:(value:string)=>Buffer.from(`enc:${value}`,'utf8'),
    decryptString:(value:Buffer)=>value.toString('utf8').replace(/^enc:/,'')
  }
}

describe('LanCredentialService',()=>{
  it('stores credential scoped to canonical server key and never exposes token in state',()=>{
    const { LanCredentialService }=require('./lan-credential-service.cjs')
    const dir=tempDir(),service=new LanCredentialService({dataDir:dir,safeStorage:safeStorage()})
    service.store({serverKey:'server-a@http://10.0.0.10:4732',deviceId:'device-a',member:{memberId:'member-a',email:'a@example.com',role:'admin'},token:'secret-device-token'})
    expect(service.token('server-a@http://10.0.0.10:4732')).toBe('secret-device-token')
    expect(service.token('server-b@http://10.0.0.11:4732')).toBe('')
    const state=service.state('server-a@http://10.0.0.10:4732')
    expect(state).toMatchObject({paired:true,deviceId:'device-a',member:{memberId:'member-a',email:'a@example.com',role:'admin'}})
    expect(JSON.stringify(state)).not.toContain('secret-device-token')
    expect(JSON.stringify(state)).not.toContain('enc:')
  })

  it('persists safeStorage ciphertext without plaintext token and restores after restart',()=>{
    const { LanCredentialService }=require('./lan-credential-service.cjs')
    const dir=tempDir(),storage=safeStorage(),serverKey='server-a@http://127.0.0.1:4732'
    const first=new LanCredentialService({dataDir:dir,safeStorage:storage})
    first.store({serverKey,deviceId:'device-a',member:{memberId:'admin',role:'admin'},token:'plain-secret'})
    const file=path.join(dir,'lan-credentials.json'),raw=fs.readFileSync(file,'utf8')
    expect(raw).not.toContain('plain-secret')
    expect(raw).not.toContain('online-connection')
    const restarted=new LanCredentialService({dataDir:dir,safeStorage:storage})
    expect(restarted.token(serverKey)).toBe('plain-secret')
  })

  it('fallback stays process-private/file-backed and does not use renderer storage',()=>{
    const { LanCredentialService }=require('./lan-credential-service.cjs')
    const dir=tempDir(),serverKey='server-a@http://127.0.0.1:4732'
    const service=new LanCredentialService({dataDir:dir,safeStorage:{isEncryptionAvailable:()=>false}})
    service.store({serverKey,deviceId:'device-a',member:{memberId:'admin',role:'admin'},token:'fallback-secret'})
    expect(service.token(serverKey)).toBe('fallback-secret')
    expect(service.state(serverKey).paired).toBe(true)
    expect(JSON.stringify(service.state(serverKey))).not.toContain('fallback-secret')
  })

  it('clear removes only the selected LAN credential and never changes online connection config',()=>{
    const { LanCredentialService }=require('./lan-credential-service.cjs')
    const dir=tempDir(),onlinePath=path.join(dir,'online-connection.json')
    fs.writeFileSync(onlinePath,JSON.stringify({tokenValue:'online-token',tenant:{companyId:'company-a'}}))
    const service=new LanCredentialService({dataDir:dir,safeStorage:safeStorage()})
    service.store({serverKey:'a',deviceId:'device-a',member:{memberId:'a'},token:'token-a'})
    service.store({serverKey:'b',deviceId:'device-b',member:{memberId:'b'},token:'token-b'})
    service.clear('a')
    expect(service.token('a')).toBe('')
    expect(service.token('b')).toBe('token-b')
    expect(JSON.parse(fs.readFileSync(onlinePath,'utf8'))).toEqual({tokenValue:'online-token',tenant:{companyId:'company-a'}})
  })
})
