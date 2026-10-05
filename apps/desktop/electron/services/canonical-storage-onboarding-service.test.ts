import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require=createRequire(import.meta.url)

function fixture(overrides:any={}){
  let required:any={mode:'lan-server',serverId:'server-company-01',autoEnroll:true}
  let state:any={operationalMode:'local',baseUrl:'',serverId:null}
  const online={
    state:vi.fn(()=>({linked:false,storageRequired:required})),
    startLanDeviceEnrollment:vi.fn(async()=>({enrollmentToken:'enroll-secret'})),
    clearRequiredStorage:vi.fn((serverId:string)=>{expect(serverId).toBe('server-company-01');required=null;return{linked:true,storageRequired:null}})
  }
  const storage={
    state:vi.fn(()=>({...state})),
    connectAddress:vi.fn(async(address:string,options:any)=>{state={operationalMode:'lan-client',baseUrl:address,serverId:options.expectedServerId};return{state:{...state}}})
  }
  const serverDiscovery={discover:vi.fn(async()=>[{serverId:'server-company-01',baseUrl:'http://10.0.0.5:4732',name:'Principal'}])}
  const lanSetup={
    status:vi.fn(async()=>({serverId:state.serverId,credential:{paired:false}})),
    enroll:vi.fn(async()=>({paired:true,serverId:'server-company-01'}))
  }
  return{online,storage,serverDiscovery,lanSetup,refreshCapabilities:vi.fn(async()=>{}),...overrides}
}

describe('CanonicalStorageOnboardingService',()=>{
  it('discovers only the company server, enrolls once and clears the storage gate',async()=>{
    const {CanonicalStorageOnboardingService}=require('./canonical-storage-onboarding-service.cjs')
    const fx=fixture(),service=new CanonicalStorageOnboardingService(fx)
    await expect(service.complete()).resolves.toMatchObject({linked:true,storageStatus:'connected',serverId:'server-company-01'})
    expect(fx.storage.connectAddress).toHaveBeenCalledWith('http://10.0.0.5:4732',{expectedServerId:'server-company-01',operationalMode:'lan-client'})
    expect(fx.online.startLanDeviceEnrollment).toHaveBeenCalledWith('server-company-01')
    expect(fx.lanSetup.enroll).toHaveBeenCalledWith({enrollmentToken:'enroll-secret'})
    expect(fx.online.clearRequiredStorage).toHaveBeenCalledWith('server-company-01')
  })

  it('never falls back to local when the canonical server is unavailable',async()=>{
    const {CanonicalStorageOnboardingService}=require('./canonical-storage-onboarding-service.cjs')
    const fx=fixture()
    fx.serverDiscovery.discover.mockResolvedValue([{serverId:'another-server',baseUrl:'http://10.0.0.9:4732'}])
    const service=new CanonicalStorageOnboardingService(fx)
    await expect(service.complete()).resolves.toMatchObject({linked:false,storageStatus:'unavailable',storageRequired:{serverId:'server-company-01'}})
    expect(fx.storage.connectAddress).not.toHaveBeenCalled()
    expect(fx.lanSetup.enroll).not.toHaveBeenCalled()
    expect(fx.online.clearRequiredStorage).not.toHaveBeenCalled()
  })

  it('keeps the already-claimed principal host when it is the canonical server',async()=>{
    const {CanonicalStorageOnboardingService}=require('./canonical-storage-onboarding-service.cjs')
    const fx=fixture()
    fx.storage.state.mockReturnValue({operationalMode:'lan-host',baseUrl:'http://127.0.0.1:4732',serverId:'server-company-01'})
    fx.lanSetup.status.mockResolvedValue({serverId:'server-company-01',credential:{paired:true}})
    const service=new CanonicalStorageOnboardingService(fx)
    await expect(service.complete()).resolves.toMatchObject({linked:true,storageStatus:'connected',serverId:'server-company-01'})
    expect(fx.serverDiscovery.discover).not.toHaveBeenCalled()
    expect(fx.online.startLanDeviceEnrollment).not.toHaveBeenCalled()
  })


  it('accepts a manual recovery address only through the canonical server id check',async()=>{
    const {CanonicalStorageOnboardingService}=require('./canonical-storage-onboarding-service.cjs')
    const fx=fixture()
    fx.serverDiscovery.discover.mockResolvedValue([])
    const service=new CanonicalStorageOnboardingService(fx)
    await expect(service.complete({address:'http://192.168.1.20:4732'})).resolves.toMatchObject({linked:true,serverId:'server-company-01'})
    expect(fx.storage.connectAddress).toHaveBeenCalledWith('http://192.168.1.20:4732',{expectedServerId:'server-company-01',operationalMode:'lan-client'})
  })
})
