'use strict'
// Smoke visual REAL do Electron Desktop, isolado de banco e contas dos clientes.
// Requires Playwright via dev-only CI workflow, never a runtime product dependency.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const { _electron: electron }=require('playwright')
const { DatabaseService }=require('../electron/services/database-safe.cjs')
const { BankFinanceService }=require('../../lan-server/src/bank-finance.cjs')
const root=path.resolve(__dirname,'..')
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'obranamao-finance-electron-'))
const screenshots=path.join(root,'qa-artifacts','finance-desktop')
fs.mkdirSync(screenshots,{recursive:true})
const db=new DatabaseService({dataDir,migrationsDir:path.join(root,'database','migrations')})
let launched
const today=new Date().toISOString().slice(0,10)
const reference=today.slice(0,7)+'-01'
async function main(){
 try{
 db.open()
 const company=db.save('empresas',{razao_social:'Empresa QA — Financeiro Desktop',nome_fantasia:'Obra QA'})
 const work=db.save('obras',{empresa_id:company.id,nome:'Obra Demonstrativa',codigo:'QA-P2'})
 db.save('contas',{empresa_id:company.id,obra_id:work.id,tipo:'pagar',descricao:'Material planejado',competencia:today.slice(0,7),vencimento:today,valor_centavos:24500,status:'pendente'})
 const bank=new BankFinanceService({db:db.db})
 const account=bank.saveAccount({empresaId:company.id,nome:'Conta QA',bancoNome:'Banco demonstrativo',saldoInicialCentavos:100000,saldoReferenciaData:reference,requestId:'finance-ui-qa-0001'})
 const csv='Data;Descricao;Valor;FITID\n'+today.slice(8,10)+'/'+today.slice(5,7)+'/'+today.slice(0,4)+';Recebimento QA;500,00;QA-ELECTRON-1\n'
 const input={empresaId:company.id,contaBancariaId:account.id,fileName:'qa.csv',format:'csv',contentBase64:Buffer.from(csv).toString('base64')}
 const preview=bank.previewImport(input)
 bank.confirmImport({...input,previewHash:preview.previewHash})
 db.close()
 launched=await electron.launch({
  executablePath:require('electron'),
  args:['.','--no-sandbox','--disable-gpu'],
  cwd:root,
  env:{...process.env,NODE_ENV:'test',ARTISYS_QA:'1',OBRA_NA_MAO_DATA_DIR:dataDir,ELECTRON_DISABLE_SECURITY_WARNINGS:'true'},
  timeout:90000
 })
 const page=await launched.firstWindow({timeout:90000})
 const errs=[]
 page.on('pageerror',err=>errs.push(err.message))
 await page.waitForLoadState('domcontentloaded')
 await page.evaluate(()=>{location.hash='#/financeiro/bancos'})
 await page.getByText('Contas bancárias e extratos',{exact:true}).waitFor({state:'visible',timeout:30000})
 await page.getByText('Conta QA',{exact:true}).first().waitFor({state:'visible',timeout:30000})
 await page.getByText('Atualizar saldo manualmente — Conta QA',{exact:true}).waitFor({state:'visible',timeout:30000})
 await page.getByPlaceholder('Ex.: 10.500,00').fill('1.500,00')
 await page.getByPlaceholder('Ex.: Saldo conferido no aplicativo do banco').fill('QA: conferência de saldo')
 await page.getByRole('button',{name:'Confirmar saldo manual'}).click()
 try{
  await page.getByText(/Saldo de .* registrado em/).waitFor({state:'visible',timeout:12000})
 }catch(err){
  const detail=await page.locator('.bank-manual-balance').innerText().catch(e=>'Sem painel: '+e.message)
  await page.screenshot({path:path.join(screenshots,'00-diagnostico-saldo-manual.png'),fullPage:true})
  throw Error('Falha ao registrar saldo manual na interface: '+detail.slice(-1600)+' | '+err.message)
 }
 await page.screenshot({path:path.join(screenshots,'00-contas-e-saldo-manual.png'),fullPage:true})
 await page.getByRole('tab',{name:'Auditoria'}).click()
 await page.getByText('Auditoria e fechamento bancário',{exact:true}).waitFor({state:'visible',timeout:30000})
 await page.screenshot({path:path.join(screenshots,'01-bancos-e-auditoria.png'),fullPage:true})
 await page.setViewportSize({width:1024,height:768})
 // Aguarde a transição animada (200ms) da sidebar no breakpoint antes de fotografar.
 await page.waitForFunction(()=>{
  const side=document.querySelector('.command-sidebar')?.getBoundingClientRect()
  const title=document.querySelector('.page-header h1')?.getBoundingClientRect()
  return !!side&&!!title&&side.width<=80&&side.right<=title.left-8
 },null,{timeout:10000})

 const layout=await page.evaluate(()=>{
  const side=document.querySelector('.command-sidebar')?.getBoundingClientRect()
  const main=document.querySelector('.main-content')?.getBoundingClientRect()
  const h1=document.querySelector('.page-header h1')?.getBoundingClientRect()
  const shell=document.querySelector('.command-center-shell')
  return{viewport:window.innerWidth,media1100:matchMedia('(max-width:1100px)').matches,sidebarRight:side?.right,sidebarWidth:side?.width,mainLeft:main?.left,headingLeft:h1?.left,columns:shell?getComputedStyle(shell).gridTemplateColumns:null}
 })
 console.log('Electron sidebar layout 1024:',JSON.stringify(layout))
 if(layout.sidebarRight!==undefined && layout.headingLeft!==undefined && layout.sidebarRight>layout.headingLeft-8)throw Error('Menu lateral sobrepõe o cabeçalho do financeiro na resolução mínima.')

 const overflowBank=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+4)
 if(overflowBank)throw Error('Overflow horizontal no layout de Contas bancárias com largura mínima Desktop.')
 await page.screenshot({path:path.join(screenshots,'02-bancos-tela-minima.png'),fullPage:true})
 await page.evaluate(()=>{location.hash='#/financeiro/fluxo-caixa'})
 await page.getByRole('heading',{name:'Fluxo de caixa',exact:true}).waitFor({state:'visible',timeout:30000})
 await page.getByText('Relatório — previsto × realizado',{exact:true}).waitFor({state:'visible',timeout:30000})
 await page.getByText('Simulador de cenários financeiros',{exact:true}).waitFor({state:'visible',timeout:30000})
 const overflowFlow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+4)
 if(overflowFlow)throw Error('Overflow horizontal no layout de fluxo com largura mínima Desktop.')
 await page.screenshot({path:path.join(screenshots,'03-fluxo-relatorios-simulador.png'),fullPage:true})
 page.on('dialog',dialog=>dialog.accept())
 await page.getByRole('button',{name:'Guardar previsão atual'}).click()
 await page.getByText(/Previsão histórica #\d+ guardada/).waitFor({state:'visible',timeout:30000})
 await page.screenshot({path:path.join(screenshots,'04-previsao-congelada.png'),fullPage:true})
 if(errs.length)throw Error('Erros no renderer Electron: '+errs.join('; ').slice(0,1200))
 if(fs.readdirSync(screenshots).filter(x=>x.endsWith('.png')).length!==5)throw Error('Capturas não concluídas.')
 console.log('PASS Desktop Electron screenshots; stored at '+screenshots)
}finally{
 try{await launched?.close()}catch{}
 try{db.close()}catch{}
 fs.rmSync(dataDir,{recursive:true,force:true})
 }
}
main().catch(e=>{console.error(e);process.exitCode=1})
