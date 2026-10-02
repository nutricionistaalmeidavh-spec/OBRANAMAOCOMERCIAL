import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
const require=createRequire(import.meta.url)
const response=(status:number,body:any)=>({ok:status>=200&&status<300,status,json:async()=>body})

function base(){
  let state:any={mode:'server',operationalMode:'lan-client',scheme:'http',host:'192.168.1.50',port:4732,baseUrl:'http://192.168.1.50:4732',serverId:'srv-a'}
  const storage={
    state:vi.fn(()=>({...state})),
    probeAddress:vi.fn(async(address:string)=>{
      if(address.includes('192.168.1.50'))return{ok:true,baseUrl:state.baseUrl,serverId:'srv-a'}
      return{ok:true,baseUrl:'http://192.168.1.77:4732',serverId:'srv-a'}
    }),
    updateEndpointForServer:vi.fn((_id:string,address:string)=>{state={...state,host:'192.168.1.77',baseUrl:address};return{...state}})
  }
  const discovery={discover:vi.fn(async()=>[{serverId:'srv-a',name:'Servidor',host:'192.168.1.77',port:4732,baseUrl:'http://192.168.1.77:4732',ready:true,latencyMs:2}])}
  const credentials={token:vi.fn(()=> 'token-a'),clear:vi.fn(),rekey:vi.fn()}
  return{storage,discovery,credentials,getState:()=>state}
}

describe('F24 automatic reconnect',()=>{
  it('reuses valid pairing on the saved endpoint without discovery or re-pair',async()=>{
    const {ServerReconnectService}=require('./server-reconnect-service.cjs')
    const fx=base()
    const fetchImpl=vi.fn(async(url:string,options:any)=>{
      expect(options.headers.Authorization).toBe('Bearer token-a')
      return response(200,{serverId:'srv-a',device:{id:'dev-a',status:'active'},member:{memberId:'m-a',status:'active'}})
    })
    const service=new ServerReconnectService({...fx,fetchImpl})
    await expect(service.reconnect()).resolves.toMatchObject({status:'connected',serverId:'srv-a',reusedCredential:true,endpointChanged:false})
    expect(fx.discovery.discover).not.toHaveBeenCalled()
  })

  it('discovers the same serverId after IP change and reconnects without re-pair',async()=>{
    const {ServerReconnectService}=require('./server-reconnect-service.cjs')
    const fx=base()
    fx.storage.probeAddress.mockRejectedValueOnce(new Error('offline'))
    const fetchImpl=vi.fn(async()=>response(200,{serverId:'srv-a',device:{id:'dev-a',status:'active'},member:{memberId:'m-a',status:'active'}}))
    const service=new ServerReconnectService({...fx,fetchImpl})
    const result=await service.reconnect()
    expect(fx.discovery.discover).toHaveBeenCalledTimes(1)
    expect(fx.storage.updateEndpointForServer).toHaveBeenCalledWith('srv-a','http://192.168.1.77:4732')
    expect(result).toMatchObject({status:'connected',serverId:'srv-a',endpointChanged:true,reusedCredential:true})
  })

  it('never switches to a different discovered server instance',async()=>{
    const {ServerReconnectService}=require('./server-reconnect-service.cjs')
    const fx=base()
    fx.storage.probeAddress.mockRejectedValueOnce(new Error('offline'))
    fx.discovery.discover.mockResolvedValue([{serverId:'srv-b',baseUrl:'http://192.168.1.88:4732'}])
    const service=new ServerReconnectService({...fx,fetchImpl:vi.fn()})
    await expect(service.reconnect()).resolves.toMatchObject({status:'unreachable',serverId:'srv-a'})
    expect(fx.storage.updateEndpointForServer).not.toHaveBeenCalled()
  })

  it('clears pairing immediately when saved device was revoked',async()=>{
    const {ServerReconnectService}=require('./server-reconnect-service.cjs')
    const fx=base()
    const fetchImpl=vi.fn(async()=>response(403,{error:'device_revoked',message:'Dispositivo revogado.'}))
    const service=new ServerReconnectService({...fx,fetchImpl})
    await expect(service.reconnect()).resolves.toMatchObject({status:'pairing-required',reason:'device_revoked',serverId:'srv-a'})
    expect(fx.credentials.clear).toHaveBeenCalledWith('srv-a')
  })
})
