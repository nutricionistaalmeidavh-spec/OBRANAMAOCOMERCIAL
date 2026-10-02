import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
const require=createRequire(import.meta.url)
const { StorageConnectionService }=require('./storage-connection-service.cjs')

function fakeDb(initial:Record<string,string>={}){
  const values=new Map(Object.entries(initial))
  return {values,db:{prepare(sql:string){
    if(/SELECT valor FROM configuracoes/.test(sql))return{get:(key:string)=>values.has(key)?{valor:values.get(key)}:undefined}
    if(/INSERT INTO configuracoes/.test(sql))return{run:(key:string,value:string)=>{values.set(key,String(value));return{changes:1}}}
    throw new Error('SQL inesperado')
  }}}
}
const response=(status:number,body:any)=>({ok:status>=200&&status<300,status,json:async()=>body})

describe('F24 stable server identity',()=>{
  it('persists serverId returned by readiness when connecting',async()=>{
    const db=fakeDb()
    const fetchImpl=vi.fn(async(url:string)=>{
      if(url.endsWith('/health'))return response(200,{status:'ok',product:'Obra na Mão',apiVersion:'1'})
      if(url.endsWith('/ready'))return response(200,{ready:true,status:'ready',identity:{serverId:'srv-a'}})
      throw new Error('unexpected')
    })
    const service=new StorageConnectionService({db,fetchImpl})
    const result=await service.connectAddress('192.168.1.50')
    expect(result.state).toMatchObject({serverId:'srv-a',baseUrl:'http://192.168.1.50:4732'})
    expect(db.values.get('lan_server_id')).toBe('srv-a')
  })

  it('updates endpoint only for the already selected server identity',()=>{
    const db=fakeDb({
      storage_mode:'server',storage_operational_mode:'lan-client',lan_server_scheme:'http',
      lan_server_host:'192.168.1.50',lan_server_port:'4732',lan_server_id:'srv-a'
    })
    const service=new StorageConnectionService({db,fetchImpl:vi.fn()})
    expect(service.updateEndpointForServer('srv-a','192.168.1.77:4810')).toMatchObject({
      serverId:'srv-a',host:'192.168.1.77',port:4810,baseUrl:'http://192.168.1.77:4810'
    })
    expect(()=>service.updateEndpointForServer('srv-b','192.168.1.88')).toThrow(/identidade|instância|servidor/i)
    expect(service.state()).toMatchObject({serverId:'srv-a',host:'192.168.1.77',port:4810})
  })

  it('never replaces an existing serverId when explicit expected identity mismatches',async()=>{
    const db=fakeDb({storage_mode:'server',storage_operational_mode:'lan-client',lan_server_host:'old.local',lan_server_port:'4732',lan_server_id:'srv-a'})
    const fetchImpl=vi.fn(async(url:string)=>{
      if(url.endsWith('/health'))return response(200,{status:'ok',product:'Obra na Mão',apiVersion:'1'})
      if(url.endsWith('/ready'))return response(200,{ready:true,status:'ready',identity:{serverId:'srv-b'}})
      throw new Error('unexpected')
    })
    const service=new StorageConnectionService({db,fetchImpl})
    await expect(service.connectAddress('new.local',{expectedServerId:'srv-a'})).rejects.toThrow(/identidade|instância|servidor/i)
    expect(service.state()).toMatchObject({serverId:'srv-a',host:'old.local'})
  })
})
