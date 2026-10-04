import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

describe('LanFirewallService',()=>{
  it('não tenta alterar firewall fora do Windows',async()=>{
    const {LanFirewallService}=require('./lan-firewall-service.cjs')
    const execFileImpl=vi.fn()
    const service=new LanFirewallService({platform:'darwin',execFileImpl})
    await expect(service.state()).resolves.toMatchObject({supported:false,enabled:false})
    await expect(service.enable({port:4732})).rejects.toThrow(/Windows/i)
    expect(execFileImpl).not.toHaveBeenCalled()
  })

  it('libera somente TCP da API e UDP de discovery para LocalSubnet em perfis privados',async()=>{
    const {LanFirewallService}=require('./lan-firewall-service.cjs')
    const calls:string[][]=[]
    const execFileImpl=vi.fn((_file:string,args:string[],_options:any,callback:(error:any,stdout:string,stderr:string)=>void)=>{
      calls.push(args)
      callback(null,calls.length>1?'true':'','')
    })
    const service=new LanFirewallService({platform:'win32',execFileImpl})
    await service.enable({port:4732})
    const command=calls.flat().join(' ')
    expect(command).toContain('4732')
    expect(command).toContain('4733')
    expect(command).toContain('LocalSubnet')
    expect(command).toContain('Domain,Private')
    expect(command).not.toContain('Profile Any')
    expect(command).not.toContain('RemoteAddress Any')
  })

  it('consulta estado sem solicitar elevação',async()=>{
    const {LanFirewallService}=require('./lan-firewall-service.cjs')
    const execFileImpl=vi.fn((_file:string,_args:string[],_options:any,callback:(error:any,stdout:string,stderr:string)=>void)=>callback(null,'true',''))
    const service=new LanFirewallService({platform:'win32',execFileImpl})
    await expect(service.state({port:4732})).resolves.toMatchObject({supported:true,enabled:true,port:4732,discoveryPort:4733})
  })
})
