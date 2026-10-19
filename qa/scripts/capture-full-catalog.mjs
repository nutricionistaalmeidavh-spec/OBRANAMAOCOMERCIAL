#!/usr/bin/env node
// QA visual isolado: captures reais do Electron e PDF sem servicos pagos.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../..');
const desktop=path.join(repo,'apps/desktop');
const requireQA=createRequire(path.join(repo,'qa/runtime/package.json'));
const requireDesktop=createRequire(path.join(desktop,'package.json'));
const {_electron:electron}=requireQA('playwright');
const {PDFDocument,StandardFonts,rgb}=requireDesktop('pdf-lib');
const out=path.resolve(process.env.QA_VISUAL_OUT||path.join(repo,'qa-artifacts','visual-catalog'));
const captures=path.join(out,'telas');
const dataDir=process.env.OBRA_NA_MAO_DATA_DIR;
if(process.env.ARTISYS_QA!=='1'||process.env.NODE_ENV!=='test'||!dataDir||!path.isAbsolute(dataDir)||!dataDir.includes('qa-visual-')){
  throw Error('Refusing to run without explicitly isolated QA environment and data directory');
}
await fs.mkdir(captures,{recursive:true});
const entries=[];
const failures=[];
const routes=[
 ['Painel','/'],
 ['Assistente IA','/assistente-ia'],
 ['DRE','/dre'],
 ['Contas e financeiro','/financeiro'],
 ['Orcamento','/orcamento'],
 ['Medicoes','/medicoes'],
 ['Compras e contratos','/compras-contratos'],
 ['Compras','/compras'],
 ['Contratos','/contratos'],
 ['Clientes e empresas','/cadastros'],
 ['Obras','/obras'],
 ['Frentes de servico','/frentes'],
 ['Planejamento','/planejamento'],
 ['Diario de obra','/rdo'],
 ['Tarefas','/tarefas'],
 ['RH - Visao geral','/rh'],
 ['Funcionarios','/rh/funcionarios'],
 ['Admissoes','/rh/admissoes'],
 ['Remuneracao','/rh/remuneracao'],
 ['Folha de pagamentos','/rh/folha'],
 ['Folhas de ponto','/rh/ponto'],
 ['Modelos RH','/rh/modelos'],
 ['Documentos','/documentos'],
 ['Importacao','/importacao'],
 ['Configuracoes','/configuracoes'],
 ['Configuracoes do sistema','/configuracoes/sistema']
];
const slug=(s)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
let app,page,seed=null,extra=null;
async function snap(title,route,group='Rota'){
  const idx=String(entries.length+1).padStart(2,'0');
  const file=idx+'-'+slug(title)+'.png';
  const pathname=path.join(captures,file);
  await page.screenshot({path:pathname,fullPage:false,animations:'disabled'});
  const details=await page.evaluate(()=>({
    hash:location.hash,
    heading:document.querySelector('h1')?.textContent?.trim()||document.querySelector('h2')?.textContent?.trim()||'',
    text:(document.body?.innerText||'').slice(0,400),
    loading:Boolean(document.querySelector('.app-loading')),
  }));
  const status=details.loading||/erro ao carregar|ocorreu um erro|falha inesperada/i.test(details.text)?'revisar':'capturada';
  entries.push({num:idx,title,route,group,file,status,heading:details.heading,hash:details.hash,excerpt:details.text});
  if(status!=='capturada')failures.push(title+': possivel erro de interface');
}
async function navigate(route){
  await page.evaluate((hash)=>{location.hash=hash},'#'+route);
  await page.waitForTimeout(650);
  await page.locator('body').waitFor({state:'visible'});
}
try{
  app=await electron.launch({
    args:[desktop],
    executablePath:path.join(desktop,'node_modules','electron','dist','electron'),
    cwd:repo,
    env:{...process.env,NODE_ENV:'test',ARTISYS_QA:'1',OBRA_NA_MAO_DATA_DIR:dataDir},
    timeout:45000
  });
  page=await app.firstWindow();
  await page.setViewportSize({width:1600,height:1000}).catch(()=>{});
  await page.locator('.artisys-desktop-shell').waitFor({state:'visible',timeout:35000});
  await page.waitForTimeout(750);
  seed=await page.evaluate(async()=>await window.fluxoDre.demo.seed());
  await page.waitForTimeout(400);
  // Dados adicionais criados apenas no banco de QA para enriquecer RH, Financeiro e DRE.
  extra=await page.evaluate(async({seed})=>{
    const api=window.fluxoDre;
    const errors=[];
    const created={cargos:0,funcionarios:0,categorias:0,contas:0};
    const e=(label,err)=>errors.push(label+': '+String(err?.message||err));
    const companies=await api.empresas.list();
    const company=companies.find(x=>String(x.cnpj||'')==='00.000.000/0001-00')||companies.find(x=>/Demo/.test(x.razao_social||''))||companies[0];
    if(!company)throw Error('Demo company was not created');
    const workId=seed.obra_id;
    const cargos=[
      ['Encanador',360000],['Auxiliar hidraulico',240000],['Lider de equipe',520000],
      ['Eletricista',380000],['Administrativo',320000]
    ];
    const jobs=[];
    for(const [name,cents] of cargos){
      try{const row=await api.cargos.save({empresa_id:company.id,nome:name,salario_base_centavos:cents,ativo:1});jobs.push(row);created.cargos++;}
      catch(err){e('cargo '+name,err);}
    }
    const people=[
      ['Marina Costa',0,510000],['Carlos Lima',2,520000],['Joao Martins',0,360000],
      ['Ana Ribeiro',1,240000],['Paulo Mendes',0,360000],['Luciana Santos',3,380000],
      ['Felipe Andrade',1,240000],['Beatriz Oliveira',4,320000]
    ];
    for(let i=0;i<people.length;i++){
      const [name,jobIndex,salary]=people[i];
      try{
        await api.funcionarios.save({
          empresa_id:company.id,obra_atual_id:workId,
          cargo_id:jobs[jobIndex]?.id||null,nome:name,
          matricula:'QA-'+String(i+1).padStart(3,'0'),
          salario_centavos:salary,status:'ativo',tipo_contrato:'clt',
          data_admissao:'2026-07-'+String(1+(i%20)).padStart(2,'0')
        });created.funcionarios++;
      }catch(err){e('funcionario '+name,err);}
    }
    const categoryIds={};
    for(const [name,nature,group] of [
      ['Material hidraulico','despesa','custos_diretos'],
      ['Salarios de equipe','despesa','pessoal'],
      ['Impostos da empresa','despesa','tributos'],
      ['Administracao','despesa','despesas_operacionais'],
      ['Servicos faturados','receita','receita_operacional']
    ]){
      try{let cat=await api.categorias.save({nome:name,natureza:nature,grupo_dre:group,ativa:1});categoryIds[name]=cat.id;created.categorias++;}
      catch(err){e('categoria '+name,err);}
    }
    const txs=[
      ['Compra de tubos PPR','pagar','Material hidraulico',228040,0],
      ['Conexoes e registros','pagar','Material hidraulico',86500,86500],
      ['Folha da equipe - outubro','pagar','Salarios de equipe',2530000,900000],
      ['DAS Simples Nacional','pagar','Impostos da empresa',437800,0],
      ['Energia e telecomunicacoes','pagar','Administracao',54260,54260],
      ['Aluguel almoxarifado','pagar','Administracao',210000,210000],
      ['Medicao Torre A - setembro','receber','Servicos faturados',7790000,7790000],
      ['Medicao Torre A - outubro','receber','Servicos faturados',11800000,0]
    ];
    for(const [description,type,category,amount,paid] of txs){
      try{
        const row=await api.contas.save({
          empresa_id:company.id,obra_id:workId,categoria_id:categoryIds[category]||null,
          descricao:description,tipo:type,competencia:'2026-10',
          vencimento:'2026-10-25',valor_centavos:amount,
          valor_bruto_centavos:amount,pago_centavos:paid,
          status:paid>=amount?'pago':paid?'parcialmente_pago':'pendente'
        });created.contas++;
      }catch(err){e('conta '+description,err);}
    }
    const counts={
      companies:(await api.empresas.list()).length,
      works:(await api.obras.list()).length,
      employees:(await api.funcionarios.list()).length,
      accounts:(await api.contas.list()).length
    };
    return {created,counts,errors,companyName:company.nome_fantasia||company.razao_social,workId};
  },{seed});
  routes.splice(11,0,['Detalhes da obra','/obras/'+seed.obra_id]);
  for(const [title,route] of routes){
    try{
      await navigate(route);
      await snap(title,route);
    }catch(err){
      failures.push(title+': '+String(err?.message||err));
    }
  }
  // Capturas de telas adicionais por interacao nao destrutiva.
  for(const [title,route,button] of [
    ['Financeiro - novo lancamento','/financeiro',/Nova conta|Novo lancamento|Adicionar conta/i],
    ['Funcionarios - formulario','/rh/funcionarios',/Novo funcionario|Adicionar funcionario|Cadastrar funcionario/i],
    ['Obras - formulario','/obras',/Nova obra|Adicionar obra/i],
    ['RH - folha','/rh/folha',/Controle de pagamentos|Visao geral/i]
  ]){
    try{
      await navigate(route);
      const target=page.getByRole('button',{name:button}).first();
      if(await target.count()===0)continue;
      await target.click({timeout:2500});
      await page.waitForTimeout(400);
      await snap(title,route,'Interacao');
      await page.keyboard.press('Escape');
    }catch(err){failures.push(title+': '+String(err?.message||err));}
  }
}catch(err){
  failures.push('Inicializacao ou seed: '+String(err?.stack||err));
}finally{
  await app?.close().catch(()=>{});
}
const summary={
  title:'Obra na Mao Comercial - Catalogo visual QA',
  executedAt:new Date().toISOString(),
  environment:'Electron local isolado - dados 100% ficticios',
  source:'GitHub Actions',
  expectedRoutes:routes.length,
  screenshotCount:entries.length,
  seed,
  enrich:extra,
  screens:entries,
  failures
};
await fs.writeFile(path.join(out,'resultado.json'),JSON.stringify(summary,null,2)+'\n','utf8');
const pdf=await PDFDocument.create();
const normal=await pdf.embedFont(StandardFonts.Helvetica);
const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
const bg=rgb(0.97,0.98,0.99),ink=rgb(0.10,0.16,0.24),muted=rgb(0.36,0.42,0.49);
const cover=pdf.addPage([960,620]);
cover.drawRectangle({x:0,y:0,width:960,height:620,color:bg});
cover.drawText('OBRA NA MAO  |  QA VISUAL',{x:52,y:540,size:14,font:bold,color:muted});
cover.drawText('Catalogo de telas e fluxos',{x:52,y:484,size:33,font:bold,color:ink});
cover.drawText('Capturas reais do aplicativo Electron - ambiente de testes isolado',{x:52,y:440,size:16,font:normal,color:ink});
cover.drawText('Data UTC: '+summary.executedAt,{x:52,y:360,size:13,font:normal,color:muted});
cover.drawText('Rotas previstas: '+routes.length+'   |   Capturas: '+entries.length+'   |   Alertas: '+failures.length,{x:52,y:325,size:15,font:bold,color:ink});
cover.drawText('Base ficticia: '+(extra?.companyName||'nao carregada'),{x:52,y:285,size:14,font:normal,color:ink});
cover.drawText('Nao representa homologacao da PWA nem ambiente de cliente.',{x:52,y:200,size:12,font:normal,color:muted});
for(const entry of entries){
  try{
    const bytes=await fs.readFile(path.join(captures,entry.file));
    const im=await pdf.embedPng(bytes);
    const w=960,h=620,p=pdf.addPage([w,h]);
    p.drawRectangle({x:0,y:0,width:w,height:h,color:bg});
    p.drawText(entry.num+'  '+entry.title,{x:25,y:585,size:18,font:bold,color:ink});
    p.drawText(entry.group+' | '+entry.route+' | '+entry.status,{x:25,y:561,size:10,font:normal,color:muted});
    const maxW=w-50,maxH=535,ratio=Math.min(maxW/im.width,maxH/im.height);
    const dw=im.width*ratio,dh=im.height*ratio;
    p.drawImage(im,{x:(w-dw)/2,y:10+(maxH-dh)/2,width:dw,height:dh});
  }catch(err){failures.push('PDF '+entry.file+': '+String(err.message||err));}
}
const last=pdf.addPage([960,620]);
last.drawText('Relatorio de cobertura e alertas',{x:40,y:565,size:23,font:bold,color:ink});
const lines=[
  'Rotas previstas: '+routes.length,
  'Capturas geradas: '+entries.length,
  'Funcionarios ficticios no banco: '+String(extra?.counts?.employees??'n/d'),
  'Contas ficticias no banco: '+String(extra?.counts?.accounts??'n/d'),
  'Erros ao adicionar dados de demonstracao: '+String(extra?.errors?.length??'n/d'),
  'Alertas de navegacao e captura: '+failures.length,
  'PWA: fora do escopo desta rodada. Fluxos transacionais exigem QA separado.',
  ...failures.slice(0,12).map(x=>x.slice(0,135))
];
let y=525;
for(const line of lines){
  if(y<40)break;
  last.drawText(line.replace(/[^\x20-\x7e]/g,'?').slice(0,145),{x:40,y,size:12,font:normal,color:muted});
  y-=28;
}
const pdfPath=path.join(out,'Obra-na-Mao-QA-Catalogo-Visual.pdf');
await fs.writeFile(pdfPath,await pdf.save());
console.log(JSON.stringify({pdfPath,screenshotCount:entries.length,expectedRoutes:routes.length,failures:failures.slice(0,20),fixtures:extra?.counts||null},null,2));
if(entries.length<routes.length)process.exitCode=1;
