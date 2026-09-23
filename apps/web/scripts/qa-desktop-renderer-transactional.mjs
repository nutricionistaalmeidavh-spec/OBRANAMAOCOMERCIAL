import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const webRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const desktopRoot=path.resolve(webRoot,'../desktop');
const outDir=path.join(webRoot,'qa-artifacts','desktop-renderer-transactional');
await fs.mkdir(outDir,{recursive:true});

function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();const port=typeof address==='object'&&address?address.port:null;server.close(error=>error?reject(error):resolve(port))})})}
async function waitFor(url){for(let attempt=0;attempt<80;attempt++){try{const response=await fetch(url);if(response.ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,250))}throw new Error('Desktop renderer preview did not become ready')}

const port=await freePort(),base=`http://127.0.0.1:${port}`,viteCli=path.join(desktopRoot,'node_modules','vite','bin','vite.js');
const server=spawn(process.execPath,[viteCli,'preview','--host','127.0.0.1','--port',String(port)],{cwd:desktopRoot,env:process.env,stdio:'inherit',shell:false});
let browser;
try{
  await waitFor(base);browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});const page=await context.newPage();
  await page.addInitScript(()=>{
    const calls=[];window.__desktopQaCalls=calls;
    let onlineState={linked:true,pending:false,baseUrl:'https://obra.qa.example.test'};
    let syncState={configured:true,paused:false,running:false,pending:2,lastSyncAt:null,lastError:null,scope:{companyId:1,workId:10,companyName:'Empresa Local QA',workName:'Obra Local QA',baseUrl:'https://obra.qa.example.test',remoteProjectId:'project-qa'},conflicts:[{id:77,entity:'tarefas_obra',localId:101,localPayload:{status:'aberta'},remotePayload:{status:'concluida'}}]};
    const mark=(name,payload)=>{calls.push({name,payload:payload??null});return payload};
    window.fluxoDre={
      app:{getLayout:async()=> 'classic',setLayout:async layout=>mark('app.setLayout',layout),bootstrap:async()=>({version:'1.0.0-qa',databasePath:'/qa/obra.db',documentsPath:'/qa/documentos',layout:'classic',product:{edition:'empreiteira'}}),retryDatabase:async()=>true},
      online:{
        state:async()=>structuredClone(onlineState),setBaseUrl:async baseUrl=>{onlineState={linked:false,pending:false,baseUrl};mark('online.setBaseUrl',baseUrl)},start:async()=>{onlineState={...onlineState,linked:false,pending:true};mark('online.start')},status:async()=>structuredClone(onlineState),session:async()=>({authorized:true,company:{id:'company-qa',name:'Empresa QA'},project:{id:'project-qa',name:'Obra QA'}}),disconnect:async()=>{onlineState={...onlineState,linked:false,pending:false};mark('online.disconnect')},
        syncState:async()=>structuredClone(syncState),configureSync:async scope=>{syncState={...syncState,configured:true,scope:{...syncState.scope,...scope}};mark('online.configureSync',scope);return structuredClone(syncState)},syncNow:async()=>{syncState={...syncState,pending:0,lastSyncAt:'2026-09-22T04:30:00.000Z'};mark('online.syncNow');return structuredClone(syncState)},resolveLocalConflict:async(id,resolution)=>{syncState={...syncState,conflicts:syncState.conflicts.filter(item=>item.id!==id)};mark('online.resolveLocalConflict',{id,resolution});return structuredClone(syncState)},
        passwordAuth:async()=>({}),passwordSetup:async()=>({}),syncPull:async()=>({}),syncPush:async()=>({}),publishMobileSummary:async()=>({}),financeRead:async()=>({}),financeWrite:async()=>({}),publishFinanceReference:async()=>({}),aiAnalyze:async()=>({}),conflicts:async()=>[],resolveConflict:async()=>({})
      },
      empresas:{list:async()=>[{id:1,razao_social:'Empresa Local QA',nome_fantasia:'Empresa QA'}]},obras:{list:async()=>[{id:10,empresa_id:1,nome:'Obra Local QA'}]},
      catalogo:{list:async()=>({cargos:[],beneficios:[],links:[]}),saveCargo:async value=>value,saveBenefit:async value=>value,saveLink:async value=>value,deactivate:async()=>true},
      updater:{state:async()=>({status:'current',currentVersion:'1.0.0-qa',availableVersion:null,progress:null,error:null,supported:true}),check:async()=>({status:'current',currentVersion:'1.0.0-qa',availableVersion:null,progress:null,error:null,supported:true}),download:async()=>false,install:async()=>false,onStateChanged:()=>()=>{}},
      backup:{create:async()=>true,restore:async()=>true,openDataFolder:async()=>true},documentos:{chooseRoot:async()=>true,openFolder:async()=>true},product:{setEdition:async edition=>mark('product.setEdition',edition)},demo:{seed:async()=>true}
    };
  });

  await page.goto(`${base}/#/configuracoes`,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Configurações'}).waitFor({state:'visible'});
  await page.getByRole('heading',{name:'Conexão Obra na Mão'}).waitFor({state:'visible'});await page.getByText('Online vinculado').waitFor({state:'visible'});
  const syncCard=page.locator('#sync-settings');await syncCard.waitFor({state:'visible'});await syncCard.getByText('Sincronização desktop ↔ online').waitFor({state:'visible'});await syncCard.getByText('2 envio(s) pendente(s) · 1 conflito(s)').waitFor({state:'visible'});
  await page.screenshot({path:path.join(outDir,'01-electron-settings-sync.png'),fullPage:true});

  await page.getByRole('button',{name:'Testar conexão'}).click();await page.getByText('Conexão online ativa — Empresa QA.').waitFor({state:'visible'});
  await syncCard.getByLabel('Empresa local').selectOption('1');await syncCard.getByLabel('Obra local').selectOption('10');await syncCard.getByRole('button',{name:'Conferir vínculo e ativar'}).click();
  const publishDialog=page.getByRole('dialog',{name:'Confirmar publicação desta obra'});await publishDialog.waitFor({state:'visible'});await publishDialog.getByRole('button',{name:'Confirmar'}).click();await syncCard.getByText('Vínculo de sincronização configurado.').waitFor({state:'visible'});

  await syncCard.getByRole('button',{name:'Sincronizar agora'}).click();await syncCard.getByText('Tentativa concluída. Confira as pendências abaixo.').waitFor({state:'visible'});await syncCard.getByText('0 envio(s) pendente(s) · 1 conflito(s)').waitFor({state:'visible'});
  await syncCard.getByRole('button',{name:'Usar dados online'}).click();const conflictDialog=page.getByRole('dialog',{name:'Resolver divergência'});await conflictDialog.waitFor({state:'visible'});await conflictDialog.getByRole('button',{name:'Confirmar'}).click();await syncCard.getByText('Conflito revisado. Acompanhe a próxima sincronização.').waitFor({state:'visible'});await syncCard.getByText('0 envio(s) pendente(s) · 0 conflito(s)').waitFor({state:'visible'});
  await page.screenshot({path:path.join(outDir,'02-electron-sync-reconciled.png'),fullPage:true});

  const calls=await page.evaluate(()=>window.__desktopQaCalls||[]);
  const names=calls.map(item=>item.name);for(const required of ['online.configureSync','online.syncNow','online.resolveLocalConflict'])if(!names.includes(required))throw new Error(`Electron renderer did not call ${required}`);
  const resolution=calls.find(item=>item.name==='online.resolveLocalConflict')?.payload;if(resolution?.id!==77||resolution?.resolution!=='accept_remote')throw new Error(`Electron renderer conflict resolution mismatch: ${JSON.stringify(resolution)}`);
  const report={schemaVersion:1,status:'passed',generatedAt:new Date().toISOString(),surface:'electron-renderer',linkingVisible:true,syncObservabilityVisible:true,syncConfiguration:true,manualSync:true,conflictResolution:true,calls,screenshots:['01-electron-settings-sync.png','02-electron-sync-reconciled.png']};
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');console.log(`DESKTOP_RENDERER_TRANSACTIONAL_QA=${path.join(outDir,'report.json')}`);await context.close();
}finally{if(browser)await browser.close().catch(()=>{});server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,300))}
