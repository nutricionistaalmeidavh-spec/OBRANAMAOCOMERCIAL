import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
const require=createRequire(import.meta.url)

describe('F24 authenticated client lifecycle',()=>{
  it('uses stable serverId as credential key even when endpoint changes',async()=>{
    const {LanDataClient}=require('./lan-data-client.cjs')
    const credentials={token:vi.fn((key:string)=>key==='srv-a'?'token-a':''),clear:vi.fn()}
    const fetchImpl=vi.fn(async()=>({ok:true,status:200,json:async()=>[]}))
    const storage={state:()=>({mode:'server',operationalMode:'lan-client',serverId:'srv-a',baseUrl:'http://192.168.1.77:4732'})}
    const client=new LanDataClient({storage,credentials,fetchImpl})
    await client.list('empresas',{})
    expect(credentials.token).toHaveBeenCalledWith('srv-a')
    expect(fetchImpl.mock.calls[0][0]).toBe('http://192.168.1.77:4732/api/v1/empresas')
  })

  it.each(['invalid_device_token','device_revoked','member_not_authorized','desktop_channel_required'])(
    'clears persisted LAN credential immediately for terminal authorization error %s',
    async(errorCode)=>{
      const {LanDataClient}=require('./lan-data-client.cjs')
      const credentials={token:vi.fn(()=> 'token-a'),clear:vi.fn()}
      const fetchImpl=vi.fn(async()=>({ok:false,status:errorCode==='invalid_device_token'?401:403,json:async()=>({error:errorCode,message:'Acesso LAN recusado.'})}))
      const storage={state:()=>({mode:'server',operationalMode:'lan-client',serverId:'srv-a',baseUrl:'http://server:4732'})}
      const client=new LanDataClient({storage,credentials,fetchImpl})
      await expect(client.list('empresas',{})).rejects.toThrow(/recusado|acesso|autoriz/i)
      expect(credentials.clear).toHaveBeenCalledWith('srv-a')
    }
  )

  it('does not clear pairing for ordinary granular forbidden responses',async()=>{
    const {LanDataClient}=require('./lan-data-client.cjs')
    const credentials={token:vi.fn(()=> 'token-a'),clear:vi.fn()}
    const fetchImpl=vi.fn(async()=>({ok:false,status:403,json:async()=>({error:'forbidden',message:'Sem permissão para editar.'})}))
    const storage={state:()=>({mode:'server',operationalMode:'lan-client',serverId:'srv-a',baseUrl:'http://server:4732'})}
    const client=new LanDataClient({storage,credentials,fetchImpl})
    await expect(client.list('empresas',{})).rejects.toThrow(/permissão/i)
    expect(credentials.clear).not.toHaveBeenCalled()
  })
})
