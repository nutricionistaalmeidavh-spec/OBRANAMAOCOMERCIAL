import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { OnlineService } = require('./online-service.cjs')
const dirs: string[] = []

function response(status: number, body: any) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('OnlineService', () => {
  it('vincula o Desktop, guarda o token e valida a sessão', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-online-'))
    dirs.push(dir)
    const opened: string[] = []
    let requestId = ''
    let secret = ''
    const fetchImpl = vi.fn(async (url: string, init: any) => {
      const route = new URL(url).pathname
      const body = JSON.parse(init.body)
      if (route === '/api/desktop/start') {
        requestId = body.requestId
        secret = body.secret
        return response(200, { ok: true, expiresAt: '2099-01-01T00:00:00.000Z' })
      }
      if (route === '/api/desktop/status') {
        expect(body).toMatchObject({ requestId, secret })
        return response(200, { status: 'approved', deviceToken: 'device-token-test', deviceId: 'd1' })
      }
      if (route === '/api/desktop/session') {
        expect(body.deviceToken).toBe('device-token-test')
        return response(200, { authorized: true, company: { id: 'tenant-test', name: 'Empresa Teste' } })
      }
      return response(404, { error: 'rota inesperada' })
    })
    const service = new OnlineService({
      dataDir: dir,
      fetchImpl,
      baseUrl: 'https://example.test',
      shell: { openExternal: async (url: string) => { opened.push(url) } },
      safeStorage: { isEncryptionAvailable: () => false }
    })

    const started = await service.start()
    expect(opened[0]).toContain('#desktop-auth=')
    expect(started.expiresAt).toBeTruthy()

    const status = await service.status()
    expect(status).toMatchObject({ status: 'approved', linked: true })

    const session = await service.session()
    expect(session).toMatchObject({ authorized: true })
    expect(service.state().linked).toBe(true)
  })

  it('libera somente o shell no modo QA isolado sem persistir token real', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-online-qa-'))
    dirs.push(dir)
    const service = new OnlineService({ dataDir: dir, fetchImpl: vi.fn(), baseUrl: 'https://example.test', qaLinked: true })
    expect(service.state()).toMatchObject({ linked: true, linkedAt: 'qa-isolated-session' })
    expect(service.deviceToken()).toBe('')
    await expect(service.financeRead('dashboard')).rejects.toThrow(/vinculado/i)
    const saved = fs.readFileSync(path.join(dir, 'online-connection.json'), 'utf8')
    expect(saved).not.toContain('tokenValue')
  })

  it('não envia chamadas protegidas antes do vínculo', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-online-'))
    dirs.push(dir)
    const service = new OnlineService({ dataDir: dir, fetchImpl: vi.fn(), baseUrl: 'https://example.test' })
    await expect(service.financeRead('dashboard')).rejects.toThrow(/vinculado/i)
  })

  it('mantém a chamada de IA ativa por até 90 segundos', async () => {
    vi.useFakeTimers()
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-online-'))
    dirs.push(dir)
    let aborts = 0
    const fetchImpl = vi.fn((_url: string, init: any) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        aborts++
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }))
    const service = new OnlineService({ dataDir: dir, fetchImpl, baseUrl: 'https://example.test' })
    service.storeToken('device-token-test')

    const outcome = service.aiAnalyze({ question: 'teste de timeout' }).then(
      (value: unknown) => ({ value }),
      (error: Error) => ({ error })
    )

    await vi.advanceTimersByTimeAsync(15001)
    expect(aborts).toBe(0)

    await vi.advanceTimersByTimeAsync(75000)
    const result = await outcome
    expect(aborts).toBe(1)
    expect('error' in result ? result.error.message : '').toMatch(/90 segundos/i)
  })
})


describe('autenticação central', () => {
  function fixture(needsClaim = false) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'commercial-auth-')); dirs.push(dir)
    let needsSetup = needsClaim
    const fetchImpl = vi.fn(async (url: string, init: any) => {
      const route = new URL(url).pathname
      if (route.startsWith('/api/auth/password/')) return { ...response(200, {}), headers: { getSetCookie: () => ['obn_session=secret-cookie; HttpOnly; Secure'] } }
      if (['/api/desktop/bootstrap', '/api/desktop/claim', '/api/desktop/approve'].includes(route)) expect(init.headers.cookie).toBe('obn_session=secret-cookie')
      if (route === '/api/desktop/bootstrap') return response(200, { needsClaim: needsSetup, authorized: true, company: needsSetup ? undefined : { id: 'tenant-a' } })
      if (route === '/api/desktop/claim') { expect(JSON.parse(init.body)).toEqual({ companyName: 'Empresa A', projectName: 'Obra A' }); needsSetup = false; return response(201, {}) }
      if (route === '/api/desktop/status') return response(200, { status: 'approved', deviceToken: 'device-a' })
      if (route === '/api/desktop/session') return response(200, { authorized: true, company: { id: 'tenant-a' }, project: { id: 'project-a' } })
      return response(200, {})
    })
    const shell = { openExternal: vi.fn() }
    return { service: new OnlineService({ dataDir: dir, baseUrl: 'https://example.test', fetchImpl, shell }), fetchImpl, shell, dir }
  }
  it('ativa e configura empresa sem navegador ou persistir credenciais', async () => {
    const { service, fetchImpl, shell, dir } = fixture(true)
    expect(await service.passwordAuth({ email: 'CLIENTE@EXAMPLE.COM', password: 'private-password', code: ' access ', firstAccess: true })).toEqual({ linked: false, needsSetup: true })
    expect(service.state().linked).toBe(false)
    expect(await service.completePasswordLink({ companyName: 'Empresa A', projectName: 'Obra A' })).toMatchObject({ linked: true, company: { id: 'tenant-a' } })
    expect(shell.openExternal).not.toHaveBeenCalled()
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ email: 'cliente@example.com', password: 'private-password', code: 'ACCESS' })
    const saved = fs.readFileSync(path.join(dir, 'online-connection.json'), 'utf8')
    for (const secret of ['private-password', 'secret-cookie', 'ACCESS']) expect(saved).not.toContain(secret)
    expect(service.passwordSession).toBeNull()
  })
  it('login não publica dados locais', async () => {
    const { service, fetchImpl } = fixture()
    expect(await service.passwordAuth({ email: 'a@example.com', password: 'password' })).toMatchObject({ linked: true })
    expect(fetchImpl.mock.calls.some(([url]) => /sync|publish/.test(url))).toBe(false)
  })
  it('recusa trocar tenant após desconectar', async () => {
    const { service, fetchImpl } = fixture()
    service.writeConfig({ tenant: { companyId: 'tenant-original', baseUrl: 'https://example.test' } }); service.disconnect()
    await expect(service.passwordAuth({ email: 'a@example.com', password: 'password' })).rejects.toThrow(/outra empresa/)
    expect(service.state().linked).toBe(false)
    expect(fetchImpl.mock.calls.some(([url]) => url.endsWith('/api/desktop/approve'))).toBe(false)
  })
  it('bloqueia senha via HTTP', async () => {
    const { service, fetchImpl } = fixture(); service.setBaseUrl('http://example.test')
    await expect(service.passwordAuth({ email: 'a@example.com', password: 'password' })).rejects.toThrow(/HTTPS/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })


describe('convite Desktop vinculado à topologia da empresa',()=>{
  it('consome o código como convite de membro e bloqueia o shell até o servidor LAN obrigatório estar pronto',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'member-invite-storage-'));dirs.push(dir)
    const calls:any[]=[]
    const fetchImpl=vi.fn(async(url:string,init:any)=>{
      const route=new URL(url).pathname
      const body=init.body?JSON.parse(init.body):{}
      calls.push({route,body,cookie:init.headers?.cookie})
      if(route==='/api/auth/password/first-access')return{...response(200,{accessPurpose:'member-invitation'}),headers:{getSetCookie:()=>['obn_session=member-cookie; HttpOnly; Secure']}}
      if(route==='/api/access/claim')return response(200,{ok:true})
      if(route==='/api/desktop/bootstrap')return response(200,{needsClaim:false,company:{id:'company-a'},storageTopology:{mode:'lan-server',serverId:'server-company-01'},desktopStorage:{mode:'lan-server',serverId:'server-company-01',autoEnroll:true}})
      if(route==='/api/desktop/start')return response(200,{ok:true,expiresAt:'2099-01-01T00:00:00.000Z'})
      if(route==='/api/desktop/approve')return response(200,{ok:true})
      if(route==='/api/desktop/status')return response(200,{status:'approved',deviceToken:'cloud-device-token',deviceId:'cloud-device-a'})
      if(route==='/api/desktop/session')return response(200,{authorized:true,company:{id:'company-a'},project:{id:'project-a'},storageTopology:{mode:'lan-server',serverId:'server-company-01'},desktopStorage:{mode:'lan-server',serverId:'server-company-01',autoEnroll:true}})
      if(route==='/api/desktop/lan/enroll/start')return response(200,{serverId:'server-company-01',enrollmentToken:'enroll-secret',expiresAt:'2099-01-01T00:00:00.000Z'})
      return response(404,{error:'unexpected '+route})
    })
    const service=new OnlineService({dataDir:dir,baseUrl:'https://example.test',fetchImpl,shell:{openExternal:vi.fn()}})
    const result=await service.passwordAuth({email:'member@example.com',password:'member-password',code:'JOIN1234',firstAccess:true})
    expect(calls.find(x=>x.route==='/api/access/claim')).toMatchObject({body:{code:'JOIN1234'},cookie:'obn_session=member-cookie'})
    expect(result).toMatchObject({linked:false,storageRequired:{mode:'lan-server',serverId:'server-company-01'}})
    expect(service.state()).toMatchObject({linked:false,storageRequired:{mode:'lan-server',serverId:'server-company-01'}})
    const enrollment=await service.startLanDeviceEnrollment('server-company-01')
    expect(enrollment.enrollmentToken).toBe('enroll-secret')
    service.clearRequiredStorage('server-company-01')
    expect(service.state().linked).toBe(true)
  })
})


describe('gestão canônica de equipe no Desktop',()=>{
  it('lista e salva colaboradores usando o mesmo membro da Cloud e o token do Desktop',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'desktop-team-'));dirs.push(dir)
    const calls:any[]=[]
    const fetchImpl=vi.fn(async(url:string,init:any)=>{
      const route=new URL(url).pathname,body=init.body?JSON.parse(init.body):{}
      calls.push({route,body})
      if(route==='/api/desktop/members/list')return response(200,{members:[{id:'m1',email:'joao@example.com',role:'foreman',joinCode:'JOIN1234',channels:['mobile']}],companyAccess:{modules:['obra360'],channels:['desktop','mobile']},storageTopology:{mode:'lan-server',serverId:'server-company-01'}})
      if(route==='/api/desktop/members/save')return response(200,{member:{id:'m1',email:'joao@example.com',role:'foreman',joinCode:'JOIN1234',channels:['desktop','mobile'],desktopStorage:{mode:'lan-server',serverId:'server-company-01',autoEnroll:true}},storageTopology:{mode:'lan-server',serverId:'server-company-01'}})
      return response(404,{error:'unexpected '+route})
    })
    const service=new OnlineService({dataDir:dir,baseUrl:'https://example.test',fetchImpl,shell:{openExternal:vi.fn()}})
    service.storeToken('cloud-device-token')
    await expect(service.membersList()).resolves.toMatchObject({storageTopology:{mode:'lan-server',serverId:'server-company-01'}})
    await expect(service.memberSave({email:'joao@example.com',role:'foreman',channels:['desktop','mobile']})).resolves.toMatchObject({member:{joinCode:'JOIN1234',desktopStorage:{serverId:'server-company-01'}}})
    expect(calls[0]).toMatchObject({route:'/api/desktop/members/list',body:{deviceToken:'cloud-device-token'}})
    expect(calls[1].body).toMatchObject({deviceToken:'cloud-device-token',email:'joao@example.com',role:'foreman',channels:['desktop','mobile']})
  })
})
})
