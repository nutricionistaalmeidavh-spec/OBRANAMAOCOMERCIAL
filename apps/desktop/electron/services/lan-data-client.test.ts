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

  it('usa POST para criar e PUT versionado para atualizar com o mesmo bearer', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const fetchImpl=vi.fn(async(_url:string,options:any)=>({ok:true,status:options.method==='POST'?201:200,json:async()=>JSON.parse(options.body)}))
    const baseUrl='http://servidor:4732'
    const storage={state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})}
    const client=new LanDataClient({storage,credentials:credentialsFor(baseUrl),fetchImpl})
    await client.save('clientes',{nome:'Cliente A',empresa_id:1})
    await client.save('obras',{id:9,revision:3,nome:'Obra A',empresa_id:1})
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer lan-device-token')
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer lan-device-token')
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({nome:'Cliente A',empresa_id:1})
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      expectedRevision:3,
      data:{nome:'Obra A',empresa_id:1}
    })
  })

  it('envia a revisão observada ao excluir um registro central', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const baseUrl='http://servidor:4732'
    const fetchImpl=vi.fn(async()=>({ok:true,status:200,json:async()=>({ok:true})}))
    const client=new LanDataClient({storage:{state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})},credentials:credentialsFor(baseUrl),fetchImpl})

    await expect(client.remove('obras',9,4)).resolves.toBe(true)
    const [url,options]=fetchImpl.mock.calls[0]
    expect(url).toBe(`${baseUrl}/api/v1/obras/9?expectedRevision=4`)
    expect(options.method).toBe('DELETE')
  })

  it('preserva o payload estruturado de revision_conflict para a camada de UX', async () => {
    const { LanDataClient, LanRevisionConflictError } = require('./lan-data-client.cjs')
    const baseUrl='http://servidor:4732'
    const conflict={
      error:'revision_conflict',
      resourceType:'obras',
      resourceId:'9',
      expectedRevision:3,
      currentRevision:4,
      current:{id:9,nome:'Versão do servidor',revision:4}
    }
    const fetchImpl=vi.fn(async()=>({ok:false,status:409,json:async()=>conflict}))
    const client=new LanDataClient({storage:{state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})},credentials:credentialsFor(baseUrl),fetchImpl})

    try {
      await client.save('obras',{id:9,revision:3,nome:'Minha versão'})
      throw new Error('esperava conflito de revisão')
    } catch (error) {
      expect(error).toBeInstanceOf(LanRevisionConflictError)
      expect((error as any).code).toBe('revision_conflict')
      expect((error as any).resourceType).toBe('obras')
      expect((error as any).resourceId).toBe('9')
      expect((error as any).expectedRevision).toBe(3)
      expect((error as any).currentRevision).toBe(4)
      expect((error as any).current).toEqual(conflict.current)
    }
  })

  it('consulta capacidades da fonte central com a mesma credencial do dispositivo', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const baseUrl='http://servidor:4732'
    const fetchImpl=vi.fn(async()=>({ok:true,status:200,json:async()=>({version:1,modules:['core'],bridgeEntities:[]})}))
    const client=new LanDataClient({storage:{state:()=>({mode:'server',operationalMode:'lan-host',baseUrl})},credentials:credentialsFor(baseUrl),fetchImpl})

    await expect(client.syncSourceCapabilities()).resolves.toEqual({version:1,modules:['core'],bridgeEntities:[]})
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url,options]=fetchImpl.mock.calls[0]
    expect(url).toBe(`${baseUrl}/api/v1/sync-source/capabilities`)
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer lan-device-token')
  })

  it('usa as rotas financeiras centrais e preserva o requestId do pagamento', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const baseUrl='http://servidor:4732'
    const replies:any[]=[
      {id:7,status:'parcialmente_pago',pago_centavos:4000},
      [{competencia:'2026-10',tipo:'pagar',valor:10000}],
      {resultado:-10000}
    ]
    const fetchImpl=vi.fn(async()=>({ok:true,status:200,json:async()=>replies.shift()}))
    const client=new LanDataClient({storage:{state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})},credentials:credentialsFor(baseUrl),fetchImpl})

    await expect(client.accountPayment(7,{valor_centavos:4000,data:'2026-10-01'},'req-7')).resolves.toMatchObject({pago_centavos:4000})
    await expect(client.financeDre({competencia:'2026-10',empresa_id:2})).resolves.toHaveLength(1)
    await expect(client.financeDashboard({competencia:'2026-10',empresa_id:2})).resolves.toMatchObject({resultado:-10000})

    const [paymentUrl,paymentOptions]=fetchImpl.mock.calls[0]
    expect(paymentUrl).toBe(`${baseUrl}/api/v1/finance/accounts/7/payment`)
    expect(paymentOptions.method).toBe('POST')
    expect(JSON.parse(paymentOptions.body)).toEqual({requestId:'req-7',payment:{valor_centavos:4000,data:'2026-10-01'}})
    expect(fetchImpl.mock.calls[1][0]).toContain('/api/v1/finance/dre?competencia=2026-10&empresa_id=2')
    expect(fetchImpl.mock.calls[2][0]).toContain('/api/v1/finance/dashboard?competencia=2026-10&empresa_id=2')
  })

  it('aceita CRUD das tabelas financeiras que já pertencem ao servidor central', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const baseUrl='http://servidor:4732'
    const fetchImpl=vi.fn(async()=>({ok:true,status:200,json:async()=>[]}))
    const client=new LanDataClient({storage:{state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})},credentials:credentialsFor(baseUrl),fetchImpl})
    for(const table of ['fornecedores','categorias_financeiras','contas','pagamentos_conta']) await expect(client.list(table,{})).resolves.toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(4)
  })

  it('aceita CRUD RH e usa rotas de folha e ponto centrais', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const baseUrl='http://servidor:4732'
    const fetchImpl=vi.fn(async(_url:string,options:any)=>({ok:true,status:200,json:async()=>options?.body?JSON.parse(options.body):[]}))
    const client=new LanDataClient({storage:{state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})},credentials:credentialsFor(baseUrl),fetchImpl})

    await expect(client.list('funcionarios',{empresa_id:1})).resolves.toEqual([])
    await client.payrollEmployee({funcionario_id:2,competencia:'2026-10'})
    await client.payrollConfirm({funcionario_id:2,competencia:'2026-10',quinzena:1,data:'2026-10-15'})
    await client.timeGet({funcionario_id:2,competencia:'2026-10'})
    await client.timeSave({funcionario_id:2,competencia:'2026-10',marks:[]})
    await client.timeDocumentContext({funcionario_id:2,competencia:'2026-10'})

    expect(fetchImpl.mock.calls[0][0]).toContain('/api/v1/funcionarios?empresa_id=1')
    expect(fetchImpl.mock.calls[1][0]).toBe(`${baseUrl}/api/v1/rh/payroll/employee`)
    expect(fetchImpl.mock.calls[2][0]).toBe(`${baseUrl}/api/v1/rh/payroll/confirm`)
    expect(fetchImpl.mock.calls[3][0]).toBe(`${baseUrl}/api/v1/rh/time/get`)
    expect(fetchImpl.mock.calls[4][0]).toBe(`${baseUrl}/api/v1/rh/time/save`)
    expect(fetchImpl.mock.calls[5][0]).toBe(`${baseUrl}/api/v1/rh/time/document-context`)
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
    const fetchImpl=vi.fn(async()=>({ok:false,status:403,json:async()=>({message:`Acesso negado para ${token}.`})}))
    const client=new LanDataClient({storage:{state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})},credentials:credentialsFor(baseUrl,token),fetchImpl})
    try{await client.syncSourceCapabilities(); throw new Error('esperava falha')}catch(error){
      expect(String((error as Error).message)).toContain('[credencial protegida]')
      expect(String((error as Error).message)).not.toContain(token)
    }
  })

  it('propaga mensagem legivel do servidor e rejeita tabelas fora do escopo', async () => {
    const { LanDataClient } = require('./lan-data-client.cjs')
    const baseUrl='http://servidor:4732'
    const fetchImpl=vi.fn(async()=>({ok:false,status:400,json:async()=>({error:'validation_error',message:'Empresa obrigatória.'})}))
    const client=new LanDataClient({storage:{state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})},credentials:credentialsFor(baseUrl),fetchImpl})
    await expect(client.save('obras',{nome:'Sem empresa'})).rejects.toThrow('Empresa obrigatória.')
    await expect(client.list('configuracoes',{})).rejects.toThrow('Entidade ainda não disponível no servidor da empresa.')
  })
})
