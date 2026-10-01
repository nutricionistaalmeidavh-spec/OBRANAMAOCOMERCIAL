import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require=createRequire(import.meta.url)
const dirs:string[]=[]
afterEach(()=>{while(dirs.length)fs.rmSync(dirs.pop()!,{recursive:true,force:true})})

describe('OnlineService LAN server claim',()=>{
  it('uses existing Desktop device token and returns only claim payload',async()=>{
    const { OnlineService }=require('./online-service.cjs')
    const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'obn-online-lan-'));dirs.push(dataDir)
    const fetchImpl=vi.fn(async(url:string,options:any)=>{
      expect(url).toBe('https://cloud.example/api/desktop/lan/claim/start')
      const body=JSON.parse(options.body)
      expect(body).toEqual({deviceToken:'desktop-token',serverId:'server-12345678'})
      return{ok:true,status:200,json:async()=>({claimToken:'claim-one-use',expiresAt:'2026-09-29T20:10:00.000Z'}),headers:{getSetCookie:()=>[],get:()=>null}}
    })
    const service=new OnlineService({dataDir,shell:{},safeStorage:{isEncryptionAvailable:()=>false},fetchImpl,baseUrl:'https://cloud.example'})
    service.storeToken('desktop-token')
    await expect(service.startLanServerClaim('server-12345678')).resolves.toEqual({claimToken:'claim-one-use',expiresAt:'2026-09-29T20:10:00.000Z'})
  })

  it('requires the Desktop to be linked before creating LAN claim',async()=>{
    const { OnlineService }=require('./online-service.cjs')
    const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'obn-online-lan-'));dirs.push(dataDir)
    const fetchImpl=vi.fn()
    const service=new OnlineService({dataDir,shell:{},safeStorage:{isEncryptionAvailable:()=>false},fetchImpl,baseUrl:'https://cloud.example'})
    await expect(service.startLanServerClaim('server-12345678')).rejects.toThrow(/vinculado|Desktop/i)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
