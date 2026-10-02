import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
const require=createRequire(import.meta.url)
const response=(status:number,body:any)=>({ok:status>=200&&status<300,status,json:async()=>body})

function fixture(){
  let state:any={mode:'server',operationalMode:'lan-client',serverId:null,baseUrl:'http://192.168.1.50:4732'}
  const storage={
    state:vi.fn(()=>({...state})),
    bindServerIdentity:vi.fn((serverId:string)=>{state={...state,serverId};return{...state}})
  }
  const credentials={
    state:vi.fn((key:string)=>({paired:key==='srv-a',serverKey:key,deviceId:key==='srv-a'?'dev-a':null})),
    token:vi.fn(()=> ''),
    store:vi.fn((value:any)=>({paired:true,serverKey:value.serverKey,deviceId:value.deviceId,member:value.member})),
    clear:vi.fn((key:string)=>({paired:false,serverKey:key})),
    rekey:vi.fn((_from:string,to:string)=>({paired:true,serverKey:to,deviceId:'legacy-dev'}))
  }
  const online={installationId:vi.fn(()=> 'install-a'),session:vi.fn(async()=>({role:'admin'}))}
  return{storage,credentials,online,getState:()=>state}
}

describe('F24 pairing binds stable server identity',()=>{
  it('status binds serverId and migrates a legacy endpoint credential',async()=>{
    const {LanSetupService}=require('./lan-setup-service.cjs')
    const fx=fixture()
    const fetchImpl=vi.fn(async(url:string)=>{
      if(url.endsWith('/api/v1/setup/status'))return response(200,{claimed:true,serverId:'srv-a'})
      throw new Error('unexpected')
    })
    const service=new LanSetupService({...fx,fetchImpl})
    const result=await service.status()
    expect(fx.storage.bindServerIdentity).toHaveBeenCalledWith('srv-a')
    expect(fx.credentials.rekey).toHaveBeenCalledWith('http://192.168.1.50:4732','srv-a')
    expect(result).toMatchObject({serverId:'srv-a',credential:{paired:true,serverKey:'srv-a'}})
  })

  it('pair verifies the selected server identity before sending a one-use code and stores by serverId',async()=>{
    const {LanSetupService}=require('./lan-setup-service.cjs')
    const fx=fixture()
    const calls:string[]=[]
    const fetchImpl=vi.fn(async(url:string,options:any)=>{
      calls.push(url)
      if(url.endsWith('/api/v1/setup/status'))return response(200,{claimed:true,serverId:'srv-a'})
      if(url.endsWith('/api/v1/pair/claim')){
        expect(JSON.parse(options.body)).toMatchObject({code:'PAIR-1234',installationId:'install-a'})
        return response(201,{device:{id:'dev-a'},member:{memberId:'m-a',role:'foreman'},deviceToken:'secret-a'})
      }
      throw new Error('unexpected')
    })
    const service=new LanSetupService({...fx,fetchImpl,deviceName:'PC Engenharia'})
    const result=await service.pair({code:'PAIR-1234'})
    expect(calls[0]).toMatch(/setup\/status$/)
    expect(calls[1]).toMatch(/pair\/claim$/)
    expect(fx.credentials.store).toHaveBeenCalledWith(expect.objectContaining({serverKey:'srv-a',deviceId:'dev-a',token:'secret-a'}))
    expect(JSON.stringify(result)).not.toContain('secret-a')
  })

  it('refuses pairing when endpoint identity differs from already selected serverId',async()=>{
    const {LanSetupService}=require('./lan-setup-service.cjs')
    const fx=fixture()
    fx.storage.bindServerIdentity('srv-a')
    const fetchImpl=vi.fn(async(url:string)=>{
      if(url.endsWith('/api/v1/setup/status'))return response(200,{claimed:true,serverId:'srv-b'})
      throw new Error('pair claim must not be called')
    })
    const service=new LanSetupService({...fx,fetchImpl})
    await expect(service.pair({code:'PAIR-1234'})).rejects.toThrow(/identidade|instância|servidor/i)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fx.credentials.store).not.toHaveBeenCalled()
  })
})
