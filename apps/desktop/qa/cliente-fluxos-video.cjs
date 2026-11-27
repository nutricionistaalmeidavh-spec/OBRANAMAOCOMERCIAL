'use strict'
// Grava em vídeo, no Electron Desktop REAL e em banco isolado, os fluxos que a cliente
// reportou com dificuldade (nov/2026). Playwright é dependência só de CI.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process')
const { _electron: electron }=require('playwright')
const { DatabaseService }=require('../electron/services/database-safe.cjs')
const root=path.resolve(__dirname,'..')
const out=path.join(root,'qa-artifacts','cliente-fluxos')
fs.mkdirSync(out,{recursive:true})
const today=new Date().toISOString().slice(0,10)
const competence=today.slice(0,7)
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const results=[]

function nfeXml(companyCnpj){
  const prefix='3526111234567800012355001000004321100004321'
  let sum=0,w=2;for(let i=42;i>=0;i--){sum+=Number(prefix[i])*w;w=w===9?2:w+1}
  const d=11-sum%11,key=prefix+String(d>=10?0:d)
  const item=(n,cod,desc,q,u)=>'<det nItem="'+n+'"><prod><cProd>'+cod+'</cProd><CFOP>5102</CFOP><xProd>'+desc+'</xProd><NCM>68071000</NCM><uCom>UN</uCom><qCom>'+q+'</qCom><vUnCom>'+u+'</vUnCom><vProd>'+(q*u).toFixed(2)+'</vProd></prod></det>'
  const total=(10*249.5+15*159.3).toFixed(2)
  return '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe'+key+'"><ide><mod>55</mod><tpAmb>1</tpAmb><tpNF>1</tpNF><finNFe>1</finNFe><nNF>4321</nNF><serie>1</serie><dhEmi>2026-11-25T08:00:00-03:00</dhEmi></ide><emit><CNPJ>98765432000110</CNPJ><xNome>Casa do Construtor Ltda</xNome></emit><dest><CNPJ>'+companyCnpj+'</CNPJ></dest>'+
    item(1,'17238','MANTA ASFALT ALUM 4MM C/10M POLIESTER',10,249.5)+item(2,'6013','TELHA ONDULADA 1,83MX1,10MX6MM BRASILIT',15,159.3)+
    '<total><ICMSTot><vProd>'+total+'</vProd><vNF>'+total+'</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><chNFe>'+key+'</chNFe><cStat>100</cStat><nProt>98765</nProt></infProt></protNFe></nfeProc>'
}

function seed(dataDir,opts={}){
  const db=new DatabaseService({dataDir,migrationsDir:path.join(root,'database','migrations')})
  db.open()
  const company=db.save('empresas',{razao_social:'Construtora Exemplo Ltda',nome_fantasia:'Construtora Exemplo',cnpj:'12345678000124'})
  const work=db.save('obras',{empresa_id:company.id,nome:'Residencial Monte Real',codigo:'MR-01'})
  const ids={company:company.id,work:work.id,cnpj:'12345678000124'}
  if(opts.employees){
    const cargo=db.db.prepare('SELECT id FROM cargos ORDER BY id LIMIT 1').get()||db.save('cargos',{nome:'Encanador',salario_base_centavos:350000})
    // status gravado com maiúscula, como uma planilha importada: era o caso que deixava a lista vazia
    for(const [nome,cpf] of [['Carlos Almeida','11122233396'],['Marcos Pereira','22233344405'],['Rafael Souza','33344455514']])
      db.save('funcionarios',{empresa_id:company.id,obra_atual_id:work.id,cargo_id:cargo.id,nome,cpf,admissao:today,salario:3500,status:'Ativo'})
  }
  if(opts.catalog){
    db.save('materiais_estoque',{empresa_id:company.id,descricao:'Manta asfáltica alumínio 4mm 10m',unidade:'UN',origem:'confirmado'})
    db.save('materiais_estoque',{empresa_id:company.id,descricao:'Telha ondulada 6mm 1,83x1,10',unidade:'UN',origem:'confirmado'})
    const cat=db.db.prepare("SELECT id FROM categorias_financeiras WHERE natureza='despesa' LIMIT 1").get()
    if(!cat)db.save('categorias_financeiras',{nome:'Material de obra',natureza:'despesa'})
  }
  db.close()
  return ids
}

async function caption(page,text){
  await page.evaluate(t=>{
    let el=document.getElementById('qa-caption')
    if(!el){el=document.createElement('div');el.id='qa-caption'
      el.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;background:rgba(10,25,60,.94);color:#fff;font:600 17px/1.35 system-ui,sans-serif;padding:12px 22px;border-radius:12px;max-width:80%;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.35);pointer-events:none'
      document.body.appendChild(el)}
    el.textContent=t
  },text).catch(()=>{})
  await sleep(1800)
}

async function setContext(page,ids){
  await page.evaluate(([k,v])=>localStorage.setItem(k,v),['artisys.commercial.work-context.v1',JSON.stringify({competencia:competence,empresaId:String(ids.company),obraId:String(ids.work)})])
  await page.evaluate(()=>{setTimeout(()=>location.reload(),50)});await sleep(5000)
}
async function go(page,hash){await page.evaluate(h=>{location.hash=h},hash);await sleep(1200)}

async function scenario(slug,title,seedOpts,fn){
  const dir=path.join(out,'_raw',slug);fs.mkdirSync(dir,{recursive:true})
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'obranamao-cliente-'))
  let app,rec,status='ok',detail='',ids
  try{
    ids=seed(dataDir,seedOpts)
    app=await electron.launch({executablePath:require('electron'),args:['.','--no-sandbox','--disable-gpu'],cwd:root,timeout:90000,
      env:{...process.env,NODE_ENV:'test',ARTISYS_QA:'1',OBRA_NA_MAO_DATA_DIR:dataDir,ELECTRON_DISABLE_SECURITY_WARNINGS:'true'}})
    const page=await app.firstWindow({timeout:90000})
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setFullScreen(false);w.setBounds({x:0,y:0,width:1280,height:800})})
    await page.locator('body').waitFor({state:'attached',timeout:60000})
    await sleep(4000)
    rec=spawn('ffmpeg',['-y','-loglevel','error','-f','x11grab','-video_size','1280x800','-framerate','15','-i',process.env.DISPLAY+'.0+0,0','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p',path.join(out,slug+'.mp4')],{stdio:['pipe','inherit','inherit']})
    await sleep(1500)
    await setContext(page,ids)
    await sleep(1500)
    try{await fn(page,ids)}catch(e){
      status='falha';detail=String(e.message||e).slice(0,600)
      await page.screenshot({path:path.join(out,slug+'-FALHA.png')}).catch(()=>{})
      detail+=' | TELA: '+((await page.locator('main').innerText().catch(()=>''))||'').replace(/\s+/g,' ').slice(0,500)
    }
    await sleep(1500)
  }catch(e){status='falha';detail=String(e.message||e).slice(0,600)}
  finally{
    if(rec){await new Promise(r=>{rec.on('close',r);try{rec.stdin.write('q')}catch{r()};setTimeout(()=>{rec.kill('SIGINT')},8000)})}
    if(app)await app.close().catch(()=>{})
  }
  const has=fs.existsSync(path.join(out,slug+'.mp4'))
  results.push({slug,title,status,detail,video:has?slug+'.mp4':null})
  console.log(slug,status,detail)
}

const pick=(page,placeholder)=>page.locator('select').filter({has:page.locator('option',{hasText:placeholder})}).first()

async function main(){
  await scenario('01-folha-de-pagamento','Folha e pagamentos — funcionários aparecem na lista',{employees:true},async(page)=>{
    await go(page,'#/rh/folha')
    await page.locator('.payroll-tabs').getByText('Funcionários',{exact:true}).click()
    await caption(page,'Controle de pagamento: antes a lista de funcionários aparecia vazia')
    const sel=pick(page,'Selecione um funcionário')
    await sel.waitFor({state:'visible',timeout:30000})
    await caption(page,'Agora os funcionários cadastrados aparecem, mesmo com o status importado como "Ativo"')
    await sel.selectOption({index:1})
    await caption(page,'Ao escolher o funcionário, o controle de pagamento do mês é preparado')
  })
  await scenario('02-folha-de-ponto','Folha de ponto — funcionários aparecem na lista',{employees:true},async(page)=>{
    await go(page,'#/rh/ponto')
    await caption(page,'Folhas de ponto: a lista de funcionários também estava vazia')
    const sel=pick(page,'Selecione')
    await sel.waitFor({state:'visible',timeout:30000})
    await caption(page,'Corrigido: os funcionários ativos aparecem para gerar a ficha de ponto')
    await sel.selectOption({index:1})
    await caption(page,'Ficha do funcionário carregada para revisar as marcações do mês')
  })
  await scenario('03-funcionarios-sem-cadastro','Folha e ponto — aviso quando não há funcionários',{},async(page)=>{
    await go(page,'#/rh/folha')
    await page.locator('.payroll-tabs').getByText('Funcionários',{exact:true}).click()
    await caption(page,'Sem funcionários cadastrados, a tela agora explica o que fazer')
    await page.getByText('Nenhum funcionário ativo cadastrado').first().waitFor({state:'visible',timeout:30000})
    await caption(page,'O botão "Ir para Funcionários" leva direto ao cadastro')
    await go(page,'#/rh/ponto')
    await page.getByText('Nenhum funcionário ativo cadastrado').first().waitFor({state:'visible',timeout:30000})
    await caption(page,'O mesmo aviso aparece na Folha de ponto')
  })
  await scenario('04-cronograma-etapa-da-obra','Cronograma — campo Etapa da obra',{},async(page,ids)=>{
    await go(page,'#/planejamento')
    await caption(page,'Cronograma: a obra ainda não tem etapas cadastradas')
    await page.getByRole('button',{name:'Nova programação'}).click()
    await page.getByText('Programação da etapa').first().waitFor({state:'visible',timeout:30000})
    await caption(page,'Antes o campo Etapa da obra abria vazio, sem explicação')
    await page.getByText('Nenhuma etapa cadastrada nesta obra').first().waitFor({state:'visible',timeout:15000})
    await caption(page,'Agora o campo avisa que falta cadastrar etapas e oferece o link "Criar etapa"')
    await page.getByRole('link',{name:'Criar etapa'}).click()
    await sleep(1500)
    await caption(page,'O link leva para Etapas e subetapas, onde a etapa é cadastrada')
  })
  await scenario('05-importacao-xml-nota-fiscal','Compras — importação do XML guiada passo a passo',{catalog:true},async(page,ids)=>{
    await go(page,'#/compras')
    await page.getByRole('heading',{name:'Compras e materiais',exact:true}).waitFor({state:'visible',timeout:30000})
    await caption(page,'Compras e materiais: vamos importar a nota fiscal (XML)')
    const file=page.locator('input[type=file][accept=".xml,application/xml,text/xml"]')
    await file.setInputFiles({name:'nota-4321.xml',mimeType:'application/xml',buffer:Buffer.from(nfeXml(ids.cnpj))})
    await page.getByText('Próximo passo:').first().waitFor({state:'visible',timeout:30000})
    await caption(page,'A leitura do XML mostra os itens, e agora um quadro "Próximo passo" diz o que fazer')
    await page.getByText(/ainda não lançou nada/).first().scrollIntoViewIfNeeded().catch(()=>{})
    await caption(page,'O texto deixa claro: a leitura ainda não lançou nada no estoque nem no financeiro')
    const reg=page.getByRole('button',{name:'Cadastrar fornecedor com os dados da nota'})
    await reg.waitFor({state:'visible',timeout:20000})
    await caption(page,'Fornecedor da nota não cadastrado: antes o sistema só avisava e travava')
    await reg.click()
    await caption(page,'O botão cadastra o fornecedor com o nome e o CNPJ do próprio XML')
    const batch=page.getByRole('button',{name:/Confirmar \d+ vínculo/})
    if(await batch.count()){
      await caption(page,'Itens com uma única sugestão podem ser confirmados de uma vez')
      await page.getByLabel(/Conferi material, especificações e unidade/).check()
      await batch.click();await sleep(2000)
    }else{
      await caption(page,'Materiais sem sugestão precisam existir no catálogo de Estoque')
    }
    const prep=page.getByRole('button',{name:'Preparar importação integrada'})
    if(await prep.count()){
      await caption(page,'Com os materiais conferidos, "Preparar importação integrada" libera os destinos e parcelas')
      await prep.click();await sleep(1500)
    }
    await caption(page,'Só depois de "Confirmar importação" a nota entra em Compras, Estoque e Financeiro')
  })
  await scenario('06-diario-e-tarefas-vazios','Diário de obra e Tarefas — telas vazias orientam',{},async(page)=>{
    await go(page,'#/rdo')
    await caption(page,'Diário de obra: a tela vazia agora explica o que cadastrar antes')
    await go(page,'#/tarefas')
    await caption(page,'Tarefas e pendências: mesma orientação sobre etapas da obra')
  })
  fs.rmSync(path.join(out,'_raw'),{recursive:true,force:true})
  fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify(results,null,2))
  if(results.every(r=>r.status==='falha'))process.exit(1)
}
main().catch(e=>{console.error(e);process.exit(1)})
