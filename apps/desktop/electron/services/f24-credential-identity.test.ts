import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
const require=createRequire(import.meta.url)
const dirs:string[]=[]
const tempDir=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'obn-f24-cred-'));dirs.push(dir);return dir}
afterEach(()=>{while(dirs.length)fs.rmSync(dirs.pop()!,{recursive:true,force:true})})
const safeStorage=()=>({
  isEncryptionAvailable:()=>true,
  encryptString:(value:string)=>Buffer.from('enc:'+value),
  decryptString:(value:Buffer)=>value.toString().replace(/^enc:/,'')
})

describe('F24 credential identity migration',()=>{
  it('rekeys legacy endpoint credential to stable serverId without exposing or re-encrypting plaintext',()=>{
    const {LanCredentialService}=require('./lan-credential-service.cjs')
    const dir=tempDir(),service=new LanCredentialService({dataDir:dir,safeStorage:safeStorage()})
    service.store({serverKey:'http://192.168.1.50:4732',deviceId:'dev-a',member:{memberId:'m-a'},token:'secret-a'})
    const before=fs.readFileSync(path.join(dir,'lan-credentials.json'),'utf8')
    const state=service.rekey('http://192.168.1.50:4732','srv-a')
    expect(state).toMatchObject({paired:true,serverKey:'srv-a',deviceId:'dev-a'})
    expect(service.token('srv-a')).toBe('secret-a')
    expect(service.token('http://192.168.1.50:4732')).toBe('')
    const after=fs.readFileSync(path.join(dir,'lan-credentials.json'),'utf8')
    expect(after).not.toContain('secret-a')
    expect(JSON.stringify(state)).not.toContain('secret-a')
    expect(before).not.toContain('secret-a')
  })

  it('does not overwrite an existing stable credential while rekeying legacy aliases',()=>{
    const {LanCredentialService}=require('./lan-credential-service.cjs')
    const service=new LanCredentialService({dataDir:tempDir(),safeStorage:safeStorage()})
    service.store({serverKey:'srv-a',deviceId:'stable',member:{memberId:'m-stable'},token:'stable-token'})
    service.store({serverKey:'http://old:4732',deviceId:'legacy',member:{memberId:'m-old'},token:'legacy-token'})
    service.rekey('http://old:4732','srv-a')
    expect(service.token('srv-a')).toBe('stable-token')
    expect(service.token('http://old:4732')).toBe('')
  })
})
