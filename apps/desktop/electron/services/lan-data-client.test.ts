import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const credentialsFor=(baseUrl:string,token='lan-device-token')=>({ token:(serverKey:string)=>serverKey===baseUrl?token:'' })

describe('LanDataClient', () => {
  it('lista entidades suportadas com filtros e bearer do servidor exato', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const fetchImpl = vi.fn(async () => ({ ok:true,status:200,json:async()=>[{id:1,razao_social:'Empresa A'}] }))
    const baseUrl='http://192.168.0.10:4732'
    const storage = { state: () => ({ mode:'server',operationalMode:'lan-client',baseUrl }) }
    const client = new LanDataClient({ storage, credentials:credentialsFor(baseUrl), fetchImpl })

    await expect(client.list('empresas',{status:'ativa',vazio:''})).resolves.toEqual([{id:1,razao_social:'Empresa A'}])
    const [url,options]=fetchImpl.mock.calls[0]
    expect(url).toBe(`${baseUrl}/api/v1/empresas?status=ativa`)
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer lan-device-token')
  })

  it('usa POST para criar e PUT para atualizar com o mesmo bearer', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const fetchImpl=vi.fn(async(_url:string,options:any)=>({ok:true,status:options.method==='POST'?201:200,json:async()=>JSON.parse(options.body)}))
    const baseUrl='http://servidor:4732'
    const storage={state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})}
    const client=new LanDataClient({storage,credentials:credentialsFor(baseUrl),fetchImpl})
    await client.save('clientes',{nome:'Cliente A',empresa_id:1})
    await client.save('obras',{id:9,nome:'Obra A',empresa_id:1})
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer lan-device-token')
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer lan-device-token')
  })

  it('falha antes da rede quando o servidor atual ainda não foi pareado', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const fetchImpl=vi.fn()
    const storage={state:()=>({mode:'server',operationalMode:'lan-client',baseUrl:'http://server-b:4732'})}
    const credentials={token:(key:string)=>key==='http://server-a:4732'?'token-a':''}
    const client=new LanDataClient({storage,credentials,fetchImpl})
    await expect(client.list('empresas',{})).rejects.toThrow(/pare|credencial|autoriza/i)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('nunca inclui o bearer em mensagem de erro do servidor', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const token='super-secret-lan-token',baseUrl='http://servidor:4732'
    const fetchImpl=vi.fn(async()=>({ok:false,status:403,json:async()=>({message:'Acesso negado.'})}))
    const client=new LanDataClient({storage:{state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})},credentials:credentialsFor(baseUrl,token),fetchImpl})
    await expect(client.list('obras',{})).rejects.toThrow('Acesso negado.')
    try{await client.list('obras',{})}catch(error){expect(String((error as Error).message)).not.toContain(token)}
  })

  it('propaga mensagem legivel do servidor e rejeita tabelas fora do escopo', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const baseUrl='http://servidor:4732'
    const fetchImpl=vi.fn(async()=>({ok:false,status:400,json:async()=>({error:'validation_error',message:'Empresa obrigatória.'})}))
    const client=new LanDataClient({storage:{state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})},credentials:credentialsFor(baseUrl),fetchImpl})
    await expect(client.save('obras',{nome:'Sem empresa'})).rejects.toThrow('Empresa obrigatória.')
    await expect(client.list('contas',{})).rejects.toThrow('Entidade ainda não disponível no servidor da empresa.')
  })
})
