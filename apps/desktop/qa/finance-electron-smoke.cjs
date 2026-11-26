'use strict'
// Smoke visual REAL do Electron Desktop, isolado de banco e contas dos clientes.
// Requires Playwright via dev-only CI workflow, never a runtime product dependency.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const { _electron: electron }=require('playwright')
const { DatabaseService }=require('../electron/services/database-safe.cjs')
const { BankFinanceService }=require('../../lan-server/src/bank-finance.cjs')
const { confirmMaterialAlias }=require('../../../packages/domain-core/index.cjs')
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
 const company=db.save('empresas',{razao_social:'Empresa QA — Financeiro Desktop',nome_fantasia:'Obra QA',cnpj:'12345678000124'})
 const work=db.save('obras',{empresa_id:company.id,nome:'Obra Demonstrativa',codigo:'QA-P2'})
 db.save('contas',{empresa_id:company.id,obra_id:work.id,tipo:'pagar',descricao:'Material planejado',competencia:today.slice(0,7),vencimento:today,valor_centavos:24500,status:'pendente'})
 const supplier=db.save('fornecedores',{empresa_id:company.id,nome:'Fornecedor fiscal QA',documento:'12345678000123'})
 const material=db.save('materiais_estoque',{empresa_id:company.id,descricao:'Tubo QA',unidade:'m',origem:'confirmado'})
 confirmMaterialAlias(db.db,(table,data)=>db.save(table,data),{empresa_id:company.id,fornecedor_id:supplier.id,material_id:material.id,codigo:'A',unidade_comercial:'UN',descricao_origem:'Tubo QA',fator_num:2,fator_den:1},'qa')
 const category=db.db.prepare("SELECT id FROM categorias_financeiras WHERE natureza='despesa' LIMIT 1").get()?.id||db.save('categorias_financeiras',{nome:'Material QA',natureza:'despesa'}).id
 const prefix='3526111234567800012355001000001234100001234'
 let sum=0,w=2;for(let i=42;i>=0;i--){sum+=Number(prefix[i])*w;w=w===9?2:w+1}
 const digit=11-sum%11,key=prefix+String(digit>=10?0:digit)
 const xml='<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe'+key+'"><ide><mod>55</mod><tpAmb>1</tpAmb><tpNF>1</tpNF><finNFe>1</finNFe><nNF>1234</nNF><serie>1</serie><dhEmi>2026-11-25T08:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000123</CNPJ><xNome>Fornecedor fiscal QA</xNome></emit><dest><CNPJ>12345678000124</CNPJ></dest><det nItem="1"><prod><cProd>A</cProd><CFOP>5102</CFOP><xProd>Tubo QA</xProd><uCom>UN</uCom><qCom>10.0000</qCom><vUnCom>12.45</vUnCom><vProd>124.50</vProd></prod></det><total><ICMSTot><vProd>124.50</vProd><vNF>124.50</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>'+key+'</chNFe><cStat>100</cStat><nProt>12345</nProt></infProt></protNFe></nfeProc>'
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
 // Exercise the real renderer -> preload -> IPC -> SQLite fiscal path.
 await page.setViewportSize({width:1440,height:1000})
 await page.evaluate(id=>{location.hash='#/compras?obra='+id},work.id)
 await page.getByRole('heading',{name:'Compras e materiais',exact:true}).waitFor({state:'visible',timeout:30000})
 const file=page.locator('input[type=file][accept=".xml,application/xml,text/xml"]')
 const upload=()=>file.setInputFiles({name:'qa-nfe.xml',mimeType:'application/xml',buffer:Buffer.from(xml)})
 await upload()
 await page.getByRole('button',{name:'Preparar importação integrada'}).waitFor({state:'visible',timeout:30000})
 await file.setInputFiles({name:'qa-invalido.xml',mimeType:'application/xml',buffer:Buffer.from('<NFe>')})
 await page.getByText(/Selecione um XML válido para continuar/).waitFor({state:'visible',timeout:10000})
 if(await page.getByRole('button',{name:'Preparar importação integrada'}).count())throw Error('Prévia anterior continua autorizada após XML inválido.')
 await upload()
 await page.getByRole('button',{name:'Preparar importação integrada'}).click()
 await page.getByLabel('Categoria financeira').selectOption(String(category))
 await page.getByLabel('Data de recebimento físico').fill(today)
 await page.getByLabel('Quantidade recebida (UN)').fill('4')
 await page.getByLabel('Vencimento',{exact:true}).fill(today)
 await page.getByLabel(/Conferi destinos, recebimentos/).check()
 await page.getByRole('button',{name:'Confirmar importação',exact:true}).click()
 await page.getByRole('button',{name:'Recebimentos e estorno'}).waitFor({state:'visible',timeout:30000})
 await page.screenshot({path:path.join(screenshots,'05-nfe-integrada.png'),fullPage:true})
 await page.getByRole('button',{name:'Recebimentos e estorno'}).click()
 const modal=page.getByRole('dialog',{name:'Nota integrada — recebimentos e estorno'})
 await modal.getByText('Nota 1234. Quantidades abaixo em unidade original da nota.').waitFor({state:'visible'})
 await modal.getByLabel('Destino').selectOption({label:'Tubo QA — Obra Demonstrativa'})
 await modal.getByLabel('Quantidade adicional (unidade fiscal)').fill('6')
 await modal.getByLabel('Confirmo a operação selecionada.').check()
 await modal.getByRole('button',{name:'Registrar recebimento'}).click()
 await modal.getByText('Operação confirmada.').waitFor({state:'visible'})
 await modal.getByLabel('Motivo do estorno').fill('Estorno QA fictício')
 await modal.getByLabel('Confirmo a operação selecionada.').check()
 await modal.getByRole('button',{name:'Estornar integração'}).click()
 await modal.waitFor({state:'hidden',timeout:30000})
 await page.screenshot({path:path.join(screenshots,'06-nfe-estornada.png'),fullPage:true})
 // Manual purchase uses the same real Electron IPC and SQLite lifecycle.
 await page.getByRole('button',{name:'Cadastrar nota recebida',exact:true}).click()
 const entry=page.getByRole('dialog',{name:'Cadastrar nota recebida'})
 await entry.getByLabel('Tipo de cadastro').selectOption('integrada')
 await entry.getByLabel('Fornecedor').selectOption(String(supplier.id))
 await entry.getByLabel('Número da nota').fill('MANUAL-QA-1')
 await entry.getByLabel('Material canônico').selectOption(String(material.id))
 await entry.getByLabel('Quantidade',{exact:false}).fill('10')
 await entry.getByLabel('Preço unitário (R$)').fill('12,45')
 await entry.getByRole('button',{name:'Conferir integração'}).click()
 const review=page.getByRole('dialog',{name:'Conferir compra manual integrada'})
 await review.getByLabel('Categoria financeira').selectOption(String(category))
 await review.getByLabel('Data de recebimento físico').fill(today)
 await review.getByLabel('Quantidade recebida (m)').fill('4')
 await review.getByLabel('Vencimento',{exact:true}).fill(today)
 await review.getByLabel(/Conferi destinos, recebimentos/).check()
 await review.getByRole('button',{name:'Confirmar importação',exact:true}).click()
 await page.getByText('Nota manual integrada. Recebimentos e contas registrados conforme conferência.').waitFor({state:'visible',timeout:30000})
 await page.screenshot({path:path.join(screenshots,'07-nota-manual-integrada.png'),fullPage:true})
 await page.getByRole('row').filter({hasText:'MANUAL-QA-1'}).getByRole('button',{name:'Recebimentos e estorno'}).click()
 await modal.getByLabel('Destino').selectOption({label:'Tubo QA — Obra Demonstrativa'})
 await modal.getByLabel('Quantidade adicional (unidade fiscal)').fill('6')
 await modal.getByLabel('Confirmo a operação selecionada.').check()
 await modal.getByRole('button',{name:'Registrar recebimento'}).click()
 await modal.getByText('Operação confirmada.').waitFor({state:'visible'})
 await modal.getByLabel('Motivo do estorno').fill('Estorno manual QA')
 await modal.getByLabel('Confirmo a operação selecionada.').check()
 await modal.getByRole('button',{name:'Estornar integração'}).click()
 await modal.waitFor({state:'hidden',timeout:30000})
 await page.screenshot({path:path.join(screenshots,'08-nota-manual-estornada.png'),fullPage:true})
 await launched.close();launched=null
 db.open()
 const fiscal=db.db.prepare('SELECT status_integracao FROM notas_recebidas WHERE numero=?').get('1234')
 if(fiscal?.status_integracao!=='estornada')throw Error('Estorno não persistido: '+JSON.stringify(fiscal))
 const manual=db.db.prepare('SELECT chave_acesso,status_integracao FROM notas_recebidas WHERE numero=?').get('MANUAL-QA-1')
 if(manual?.status_integracao!=='estornada'||manual.chave_acesso!==null)throw Error('Estorno manual não persistido ou chave indevida: '+JSON.stringify(manual))
 const balance=db.db.prepare("SELECT COALESCE(SUM(CASE WHEN tipo='saida' THEN -quantidade ELSE quantidade END),0) total FROM movimentacoes_estoque WHERE material_id=?").get(material.id).total
 if(balance!==0)throw Error('Saldo fiscal não revertido: '+balance)
 if(db.db.prepare('SELECT COUNT(*) n FROM nota_recebida_xml').get().n!==1)throw Error('XML fiscal não preservado.')
 db.close()
 if(errs.length)throw Error('Erros no renderer Electron: '+errs.join('; ').slice(0,1200))
 if(fs.readdirSync(screenshots).filter(x=>x.endsWith('.png')).length!==9)throw Error('Capturas não concluídas.')
 console.log('PASS Desktop Electron screenshots; stored at '+screenshots)
}finally{
 try{await launched?.close()}catch{}
 try{db.close()}catch{}
 fs.rmSync(dataDir,{recursive:true,force:true})
 }
}
main().catch(e=>{console.error(e);process.exitCode=1})
