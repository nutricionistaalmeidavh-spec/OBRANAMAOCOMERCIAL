import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
const require=createRequire(import.meta.url)

function fakeDb(initial:Record<string,string>={}){
  const values=new Map(Object.entries(initial))
  return {values,db:{prepare(sql:string){
    if(/SELECT valor FROM configuracoes/.test(sql))return{get:(key:string)=>values.has(key)?{valor:values.get(key)}:undefined}
    if(/INSERT INTO configuracoes/.test(sql))return{run:(key:string,value:string)=>{values.set(key,String(value));return{changes:1}}}
    throw new Error('SQL inesperado')
  }}}
}
const response=(status:number,body:any)=>({ok:status>=200&&status<300,status,json:async()=>body})

describe('F25 remote topology and transport policy',()=>{
  it('accepts public remote endpoint only with HTTPS and persists remote topology',async()=>{
    const {StorageConnectionService}=require('./storage-connection-service.cjs')
    const fetchImpl=vi.fn(async(url:string)=>{
      if(url==='https://obras.example.com/health')return response(200,{status:'ok',product:'Obra na Mão',apiVersion:'1'})
      if(url==='https://obras.example.com/ready')return response(200,{ready:true,status:'ready',identity:{serverId:'srv-remote'}})
      throw new Error('unexpected')
    })
    const db=fakeDb(),service=new StorageConnectionService({db,fetchImpl})
    const result=await service.connectAddress('https://obras.example.com',{operationalMode:'remote'})
    expect(result.state).toMatchObject({operationalMode:'remote',scheme:'https',serverId:'srv-remote',transport:'https'})
    expect(db.values.get('storage_operational_mode')).toBe('remote')
  })

  it('rejects public HTTP remote endpoints before any network request',async()=>{
    const {StorageConnectionService}=require('./storage-connection-service.cjs')
    const fetchImpl=vi.fn()
    const service=new StorageConnectionService({db:fakeDb(),fetchImpl})
    await expect(service.connectAddress('http://203.0.113.10:4732',{operationalMode:'remote'})).rejects.toThrow(/HTTPS|privada|VPN|segur/i)
    expect(fetchImpl).not.toHaveBeenCalled()
    await expect(service.connectAddress('http://obras.example.com:4732',{operationalMode:'remote'})).rejects.toThrow(/HTTPS|privada|VPN|segur/i)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each(['http://10.66.0.1:4732','http://192.168.250.2:4732','http://obra-vpn.local:4732'])(
    'allows HTTP remote endpoint on private/VPN addressing: %s',
    async(address)=>{
      const {StorageConnectionService}=require('./storage-connection-service.cjs')
      const fetchImpl=vi.fn(async(url:string)=>{
        if(url.endsWith('/health'))return response(200,{status:'ok',product:'Obra na Mão',apiVersion:'1'})
        if(url.endsWith('/ready'))return response(200,{ready:true,status:'ready',identity:{serverId:'srv-vpn'}})
        throw new Error('unexpected')
      })
      const service=new StorageConnectionService({db:fakeDb(),fetchImpl})
      await expect(service.connectAddress(address,{operationalMode:'remote'})).resolves.toMatchObject({
        state:{operationalMode:'remote',serverId:'srv-vpn',transport:'private-network'}
      })
    }
  )

  it('remote reconnect never runs LAN discovery and never switches instance',async()=>{
    const {ServerReconnectService}=require('./server-reconnect-service.cjs')
    const discovery={discover:vi.fn(async()=>[{serverId:'srv-a',baseUrl:'http://10.0.0.5:4732'}])}
    const storage={
      state:vi.fn(()=>({mode:'server',operationalMode:'remote',serverId:'srv-a',baseUrl:'https://offline.example.com'})),
      probeAddress:vi.fn(async()=>{throw new Error('offline')}),
      updateEndpointForServer:vi.fn()
    }
    const credentials={token:vi.fn(()=> 'token-a'),clear:vi.fn(),rekey:vi.fn()}
    const service=new ServerReconnectService({storage,discovery,credentials,fetchImpl:vi.fn()})
    await expect(service.reconnect()).resolves.toMatchObject({status:'unreachable',serverId:'srv-a'})
    expect(storage.probeAddress).toHaveBeenCalledWith('https://offline.example.com',{operationalMode:'remote'})
    expect(discovery.discover).not.toHaveBeenCalled()
    expect(storage.updateEndpointForServer).not.toHaveBeenCalled()
  })
})
