import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require=createRequire(import.meta.url)
const { StorageConnectionService }=require('./storage-connection-service.cjs')

function fakeDb(initial:Record<string,string>={}){
  const values=new Map(Object.entries(initial))
  return {
    values,
    db:{
      prepare(sql:string){
        if(/SELECT valor FROM configuracoes/.test(sql))return{get:(key:string)=>values.has(key)?{valor:values.get(key)}:undefined}
        if(/INSERT INTO configuracoes/.test(sql))return{run:(key:string,value:string)=>{values.set(key,String(value));return{changes:1}}}
        throw new Error('SQL inesperado')
      }
    }
  }
}
const response=(status:number,body:any)=>({ok:status>=200&&status<300,status,json:async()=>body})

describe('F23 manual server connection',()=>{
  it('probeAddress validates health + readiness without persisting configuration',async()=>{
    const db=fakeDb()
    const fetchImpl=vi.fn(async(url:string)=>{
      if(url==='http://192.168.1.50:4732/health')return response(200,{status:'ok',product:'Obra na Mão',apiVersion:'1'})
      if(url==='http://192.168.1.50:4732/ready')return response(200,{ready:true,status:'ready',identity:{serverId:'srv-1'}})
      throw new Error(`URL inesperada: ${url}`)
    })
    const service=new StorageConnectionService({db,fetchImpl})
    const before=service.state()
    await expect(service.probeAddress('192.168.1.50')).resolves.toMatchObject({
      ok:true,baseUrl:'http://192.168.1.50:4732',serverId:'srv-1'
    })
    expect(service.state()).toEqual(before)
    expect(db.values.size).toBe(0)
  })

  it('connectAddress persists lan-client only after a successful probe',async()=>{
    const db=fakeDb()
    const fetchImpl=vi.fn(async(url:string)=>{
      if(url.endsWith('/health'))return response(200,{status:'ok',product:'Obra na Mão',apiVersion:'1'})
      if(url.endsWith('/ready'))return response(200,{ready:true,status:'ready',identity:{serverId:'srv-2'}})
      throw new Error('unexpected')
    })
    const service=new StorageConnectionService({db,fetchImpl})
    const result=await service.connectAddress('obra-server.local:4810')
    expect(result.state).toMatchObject({
      mode:'server',operationalMode:'lan-client',scheme:'http',host:'obra-server.local',port:4810,
      baseUrl:'http://obra-server.local:4810'
    })
    expect(result.server).toMatchObject({serverId:'srv-2',ok:true})
    expect(db.values.get('storage_mode')).toBe('server')
    expect(db.values.get('storage_operational_mode')).toBe('lan-client')
    expect(db.values.get('lan_server_scheme')).toBe('http')
  })

  it('connectAddress supports HTTPS but never persists an endpoint that is not ready',async()=>{
    const db=fakeDb({storage_mode:'local'})
    const fetchImpl=vi.fn(async(url:string)=>{
      if(url.endsWith('/health'))return response(200,{status:'ok',product:'Obra na Mão',apiVersion:'1'})
      return response(503,{ready:false,status:'not_ready'})
    })
    const service=new StorageConnectionService({db,fetchImpl})
    await expect(service.connectAddress('https://servidor.empresa.com.br')).rejects.toThrow(/pronto|ready|servidor/i)
    expect(db.values.get('storage_mode')).toBe('local')
    expect(db.values.get('lan_server_host')).toBeUndefined()
    expect(db.values.get('lan_server_scheme')).toBeUndefined()
  })
  it('rejects connecting a lan-host Desktop to its own server identity before persisting',async()=>{
    const db=fakeDb({storage_mode:'server',storage_operational_mode:'lan-host',lan_server_host:'127.0.0.1',lan_server_port:'4732'})
    const fetchImpl=vi.fn(async(url:string)=>{
      if(url.endsWith('/health'))return response(200,{status:'ok',product:'Obra na Mão',apiVersion:'1'})
      if(url.endsWith('/ready'))return response(200,{ready:true,status:'ready',identity:{serverId:'srv-self'}})
      throw new Error('unexpected')
    })
    const service=new StorageConnectionService({db,fetchImpl})
    await expect(service.connectAddress('192.168.1.50',{rejectServerId:'srv-self'})).rejects.toThrow(/próprio|proprio|mesmo servidor/i)
    expect(service.state()).toMatchObject({operationalMode:'lan-host',host:'127.0.0.1',port:4732})
    expect(db.values.get('lan_server_host')).toBe('127.0.0.1')
  })

})
