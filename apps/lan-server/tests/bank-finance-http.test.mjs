import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { LanRepository } from '../src/repository.mjs'
import { createLanServer } from '../src/server.mjs'

test('HTTP B1/B2 exige autenticação e persiste extrato no banco LAN sem baixar contas operacionais', async () => {
  const repository = new LanRepository({ filename:':memory:' })
  repository.applyMigrations(path.resolve(import.meta.dirname,'../migrations'))
  const company=repository.save('empresas',{razao_social:'Empresa de teste'})
  const token='token-teste-banco'
  const expected=createHash('sha256').update(token).digest('hex')
  const security={
    serverState:()=>({claimed:true,companyId:'empresa-do-contrato'}),
    deviceByTokenHash:digest=>digest===expected?{id:'device',memberId:'m1',status:'active'}:null,
    member:id=>id==='m1'?{role:'admin',status:'active',modules:['finance'],channels:['desktop']}:null,
    touchDevice:()=>{}
  }
  const server=createLanServer({ repository,security })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const base='http://127.0.0.1:'+server.address().port
  const auth={authorization:'Bearer '+token}
  const send=(path,method='GET',body)=>fetch(base+path,{method,headers:{...auth,'content-type':'application/json'},body:body?JSON.stringify(body):undefined})
  try{
    const unauthorized=await fetch(base+'/api/v1/finance/bank-accounts?empresaId='+company.id)
    assert.equal(unauthorized.status,401)
    const created=await send('/api/v1/finance/bank-accounts','POST',{
      empresaId:company.id,nome:'Conta principal',bancoNome:'Banco XPTO',saldoInicialCentavos:50000,
      saldoReferenciaData:'2026-11-01',requestId:'http-test-account-01'
    })
    assert.equal(created.status,201)
    const bank=await created.json()
    assert.ok(bank.id>0)
    const list=await send('/api/v1/finance/bank-accounts?empresaId='+company.id)
    assert.equal((await list.json()).length,1)
    const payload={
      empresaId:company.id,contaBancariaId:bank.id,fileName:'novembro.csv',format:'csv',
      contentBase64:Buffer.from('Data;Descricao;Valor\n18/11/2026;Pagamento;-25,90\n').toString('base64')
    }
    const previewResponse=await send('/api/v1/finance/bank-imports/preview','POST',payload)
    assert.equal(previewResponse.status,200)
    const preview=await previewResponse.json()
    assert.equal(preview.importable,1)
    const confirmation=await send('/api/v1/finance/bank-imports/confirm','POST',{...payload,previewHash:preview.previewHash})
    assert.equal(confirmation.status,200)
    assert.equal((await confirmation.json()).imported,1)
    const movements=await send('/api/v1/finance/bank-transactions?empresaId='+company.id+'&contaBancariaId='+bank.id)
    assert.equal((await movements.json()).length,1)
    assert.equal(repository.connection().prepare('SELECT COUNT(*) n FROM contas').get().n,0)
    assert.equal(repository.connection().prepare('SELECT COUNT(*) n FROM pagamentos_conta').get().n,0)
  }finally{
    await new Promise(resolve=>server.close(resolve))
    repository.close()
  }
})
