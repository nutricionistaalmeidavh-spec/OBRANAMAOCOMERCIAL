import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { LanRepository } from '../../lan-server/src/repository.mjs'
import { PairingService } from '../../lan-server/src/pairing-service.mjs'
import { createLanServer } from '../../lan-server/src/server.mjs'

const root=path.dirname(fileURLToPath(import.meta.url))
const artifacts=path.resolve(root,'../qa-artifacts')
fs.mkdirSync(artifacts,{recursive:true})
const repository=new LanRepository({filename:':memory:'})
repository.applyMigrations(path.resolve(root,'../../lan-server/migrations'))
const company=repository.save('empresas',{razao_social:'QA Engenharia'})
const db=repository.connection()
const work=Number(db.prepare("INSERT INTO obras(empresa_id,nome) VALUES(?,'Obra QA')").run(company.id).lastInsertRowid)
const payable=Number(db.prepare("INSERT INTO contas(tipo,empresa_id,obra_id,descricao,competencia,vencimento,valor_centavos,status) VALUES('pagar',?,?,'Compra de materiais','2026-11','2026-11-18',12345,'pago')").run(company.id,work).lastInsertRowid)
db.prepare("INSERT INTO pagamentos_conta(conta_id,valor_centavos,data) VALUES(?,12345,'2026-11-18')").run(payable)
db.prepare("INSERT INTO contas(tipo,empresa_id,obra_id,descricao,competencia,vencimento,valor_centavos,status) VALUES('pagar',?,?,'Compra futura','2026-11','2026-11-25',7000,'pendente')").run(company.id,work)
const member={memberId:'qa-admin',name:'Gestor Financeiro',email:'qa@example.local',role:'admin',modules:['finance'],channels:['desktop'],status:'active'}
const hashes=new Map(),codes=new Map()
const hash=s=>createHash('sha256').update(String(s)).digest('hex')
const security={
 serverState:()=>({claimed:true,serverId:'qa-server',companyId:'qa-cloud-company'}),
 member:(id)=>id===member.memberId?member:null,
 members:()=>[member],
 createPairingCode:({memberId,codeHash,expiresAt,createdByDeviceId})=>{codes.set(codeHash,{memberId,expiresAt,createdByDeviceId})},
 consumePairingCode:(codeHash)=>{const item=codes.get(codeHash);codes.delete(codeHash);return item||null},
 createDevice:({memberId,installationId,deviceName,tokenHash})=>{const record={id:'paired-'+(hashes.size+1),memberId,installationId,deviceName,tokenHash,status:'active'};hashes.set(tokenHash,record);return record},
 deviceByTokenHash:(digest)=>hashes.get(digest)||null,
 touchDevice:()=>{},
 appendAudit:()=>{}
}
const pairingService=new PairingService({security})
const invite=pairingService.createInvitation({actor:{device:{id:'admin'},member},targetMemberId:member.memberId})
const server=createLanServer({repository,security,pairingService})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const url='http://127.0.0.1:'+server.address().port+'/financeiro-web'
let browser
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']})
 const page=await browser.newPage({viewport:{width:1365,height:900},deviceScaleFactor:1})
 const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 await page.goto(url,{waitUntil:'domcontentloaded'})
 await page.locator('#pair-code').fill(invite.code)
 await page.locator('#device-name').fill('QA Browser')
 await page.locator('#pair-form button[type=submit]').click()
 await page.locator('#app').waitFor({state:'visible',timeout:10000})
 await assert.doesNotReject(()=>page.getByText('Gestão financeira',{exact:true}).waitFor({state:'visible',timeout:10000}))
 assert.match(await page.locator('#member').innerText(),/Gestor Financeiro/)
 // B1 via Web
 const bankForm=page.locator('#view form').first()
 await bankForm.locator('input').nth(0).fill('Conta QA')
 await bankForm.locator('input').nth(1).fill('Banco QA')
 await bankForm.locator('input').nth(4).fill('1.000,00')
 await bankForm.locator('input[type=date]').fill('2026-11-01')
 await bankForm.getByRole('button',{name:'Cadastrar conta'}).click()
 await page.getByText('Conta QA',{exact:true}).first().waitFor({state:'visible',timeout:10000})
 assert.equal(db.prepare('SELECT COUNT(*) n FROM contas_bancarias').get().n,1)
 // B2 import OFX/CSV no browser com estado de prévia
 await page.locator('[data-tab=imports]').click()
 await page.locator('#view input[type=file]').setInputFiles({name:'novembro.csv',mimeType:'text/csv',buffer:Buffer.from('Data;Descricao;Valor;FITID\n18/11/2026;Compra de materiais;-123,45;QA001\n')})
 await page.getByRole('button',{name:'Conferir prévia'}).click()
 await page.getByText('Prévia · novembro.csv').waitFor({state:'visible',timeout:10000})
 await page.getByRole('button',{name:'Confirmar importação'}).click()
 await page.getByText('Histórico de importações').waitFor({state:'visible',timeout:10000})
 assert.equal(db.prepare('SELECT COUNT(*) n FROM transacoes_bancarias').get().n,1)
 // B3 reconciliar o pagamento existente
 await page.locator('[data-tab=reconcile]').click()
 await page.getByText('Pagamentos', {exact:true}).count().catch(()=>0)
 await page.getByText('Compra de materiais').first().waitFor({state:'visible',timeout:10000})
 const paymentRow=page.locator('#view .bank').filter({hasText:'Compra de materiais'}).last()
 await paymentRow.locator('input[type=checkbox]').first().check()
 await page.getByRole('button',{name:'Confirmar conciliação'}).click()
 await page.getByText('Histórico e reversões').waitFor({state:'visible',timeout:10000})
 assert.equal(db.prepare("SELECT COUNT(*) n FROM reconciliacao_lotes WHERE status='active'").get().n,1)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM pagamentos_conta').get().n,1)
 // C0-C2 observar fluxo e atribuir banco futuro
 await page.locator('[data-tab=cash]').click()
 await page.getByText('Evolução diária').waitFor({state:'visible',timeout:10000})
 await page.getByText('Compra futura').waitFor({state:'visible',timeout:10000})
 const assignRow=page.locator('#view tbody tr').filter({hasText:'Compra futura'}).first()
 await assignRow.locator('select').selectOption({index:1})
 await page.getByText('Compra futura').waitFor({state:'visible',timeout:10000})
 assert.equal(db.prepare('SELECT COUNT(*) n FROM conta_previsao_bancaria').get().n,1)
 await page.screenshot({path:path.join(artifacts,'finance-selfhosted-desktop.png'),fullPage:true})
 await page.setViewportSize({width:390,height:844})
 await page.screenshot({path:path.join(artifacts,'finance-selfhosted-mobile.png'),fullPage:true})
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+4)
 assert.equal(overflow,false,'layout financeiro não deve transbordar a viewport mobile')
 assert.deepEqual(errors,[],'console e pageerror devem estar vazios')
 await page.locator('#logout').click()
 await page.locator('#connection').waitFor({state:'visible'})
 console.log('P1 selfhosted browser QA PASS: login, B1, B2, B3, C2, desktop/mobile, imagens em '+artifacts)
}finally{
 if(browser)await browser.close()
 await new Promise(resolve=>server.close(resolve))
 repository.close()
}
