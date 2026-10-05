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
      app:{getLayout:async()=> 'command-center',setLayout:async layout=>mark('app.setLayout',layout),bootstrap:async()=>({version:'2.0.0-qa',databasePath:'/qa/obra.db',documentsPath:'/qa/documentos',layout:'command-center',product:{edition:'empreiteira'}}),retryDatabase:async()=>true},
      online:{
        state:async()=>structuredClone(onlineState),setBaseUrl:async baseUrl=>{onlineState={linked:false,pending:false,baseUrl};mark('online.setBaseUrl',baseUrl)},start:async()=>{onlineState={...onlineState,linked:false,pending:true};mark('online.start')},status:async()=>structuredClone(onlineState),session:async()=>({authorized:true,company:{id:'company-qa',name:'Empresa QA'},project:{id:'project-qa',name:'Obra QA'}}),disconnect:async()=>{onlineState={...onlineState,linked:false,pending:false};mark('online.disconnect')},
        syncState:async()=>structuredClone(syncState),onSyncStateChanged:()=>()=>{},configureSync:async scope=>{syncState={...syncState,configured:true,scope:{...syncState.scope,...scope}};mark('online.configureSync',scope);return structuredClone(syncState)},syncNow:async()=>{syncState={...syncState,pending:0,lastSyncAt:'2026-09-22T04:30:00.000Z'};mark('online.syncNow');return structuredClone(syncState)},resolveLocalConflict:async(id,resolution)=>{syncState={...syncState,conflicts:syncState.conflicts.filter(item=>item.id!==id)};mark('online.resolveLocalConflict',{id,resolution});return structuredClone(syncState)},
        passwordAuth:async()=>({}),passwordSetup:async()=>({}),syncPull:async()=>({}),syncPush:async()=>({}),publishMobileSummary:async()=>({}),financeRead:async()=>({}),financeWrite:async()=>({}),publishFinanceReference:async()=>({}),aiAnalyze:async()=>({}),conflicts:async()=>[],resolveConflict:async()=>({})
      },
      conflicts:{onRevisionConflict:()=>()=>{}},
      empresas:{list:async()=>[{id:1,razao_social:'Empresa Local QA',nome_fantasia:'Empresa QA'}]},obras:{list:async()=>[{id:10,empresa_id:1,nome:'Obra Local QA'}]},
      catalogo:{list:async()=>({cargos:[],beneficios:[],links:[]}),saveCargo:async value=>value,saveCompensationPolicy:async value=>value,saveBenefit:async value=>value,saveLink:async value=>value,deactivate:async()=>true},
      updater:{state:async()=>({status:'current',currentVersion:'1.0.0-qa',availableVersion:null,progress:null,error:null,supported:true}),check:async()=>({status:'current',currentVersion:'1.0.0-qa',availableVersion:null,progress:null,error:null,supported:true}),download:async()=>false,install:async()=>false,onStateChanged:()=>()=>{}},
      backup:{create:async()=>true,restore:async()=>true,openDataFolder:async()=>true},documentos:{chooseRoot:async()=>true,openFolder:async()=>true},product:{setEdition:async edition=>mark('product.setEdition',edition)},demo:{seed:async()=>true},
      storage:{
        state:async()=>({mode:'local',operationalMode:'local',host:'127.0.0.1',port:4732,baseUrl:'http://127.0.0.1:4732'}),
        configure:async input=>({mode:input.operationalMode==='local'?'local':'server',operationalMode:input.operationalMode,host:input.host,port:input.port,baseUrl:`http://${input.host}:${input.port}`}),
        testConnection:async()=>({ok:true,baseUrl:'http://127.0.0.1:4732',latencyMs:7,health:{status:'ok',product:'Obra na Mão',apiVersion:'1'}}),
        discoverServers:async()=>[],
        probeAddress:async address=>({ok:true,baseUrl:address,serverId:'srv-qa',latencyMs:7,health:{status:'ok',product:'Obra na Mão',apiVersion:'1'},readiness:{ready:true}}),
        connectAddress:async(address,operationalMode='lan-client')=>({state:{mode:'server',operationalMode,scheme:address.startsWith('https:')?'https':'http',host:'server.qa',port:address.startsWith('https:')?443:4732,baseUrl:address,serverId:'srv-qa',transport:address.startsWith('https:')?'https':'local-network'},server:{ok:true,baseUrl:address,serverId:'srv-qa',latencyMs:7}}),
        moduleState:async module=>({module,state:'local',localRecords:0}),
        refreshModuleCapabilities:async()=>Object.fromEntries(['core','operation','planning','finance','rh'].map(module=>[module,{module,state:'local',localRecords:0}])),
        migrationPreflight:async()=>({canMigrate:true,dependencies:{}}),
        migrationStatus:async()=>({attempt:null}),
        migrateModule:async()=>({status:'committed'}),
        rollbackModuleMigration:async()=>({status:'rolled_back'})
      },
      lan:{
        hostState:async()=>({running:true,setupCodeAvailable:true,lastError:null}),
        startHost:async()=>({running:true}),stopHost:async()=>({running:false}),
        status:async()=>({serverId:'srv-qa',claimed:false,credential:{paired:false,member:null}}),
        claimHost:async()=>({company:{name:'Empresa QA'}}),pair:async()=>({paired:true}),disconnect:async()=>({paired:false}),
        adminStatus:async()=>({stale:false,deviceCount:0}),createPairing:async()=>({code:'QA123-45678',expiresAt:'2026-10-01T21:00:00.000Z'}),
        listDevices:async()=>[],setDeviceStatus:async()=>({ok:true}),refreshIdentity:async()=>({ok:true}),reconnect:async()=>({status:'connected',serverId:'srv-qa',endpointChanged:false,reusedCredential:true}),
        operationsStatus:async()=>({server:{version:'0.3.0',apiVersion:'1',serverId:'srv-qa',runtime:{mode:'lan',transport:'local-network'}},readiness:{ready:true,status:'ready'},storage:{accessible:true,integrity:'ok',schemaVersion:6,maintenance:false},backup:{policy:{enabled:true,running:true,intervalHours:24,retentionCount:7,nextRunAt:null},lastBackup:null},devices:{total:0,active:0,revoked:0},authority:{company:{id:'company-qa',name:'Empresa QA'},revision:'r1',lastCloudRefreshAt:null,stale:false},sync:{authorityRevision:'r1',lastCloudRefreshAt:null,stale:false},capabilities:{version:1,modules:['core','operation','planning','finance','rh'],bridgeEntities:[],features:[]}}),
        listBackups:async()=>[],createBackup:async()=>({backupId:'qa-backup'}),testBackup:async backupId=>({restorable:true,backupId,integrity:'ok'}),preUpgradeBackup:async()=>({backup:{backupId:'qa-pre-upgrade'},verified:true}),restoreBackup:async backupId=>({restored:true,backupId}),
        startAtLoginState:async()=>({enabled:false}),setStartAtLogin:async enabled=>({enabled})
      }
    };
  });

  await page.goto(`${base}/#/configuracoes`,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Configurações',exact:true}).waitFor({state:'visible'});
  await page.getByAltText('ArtiSys').waitFor({state:'visible'});
  const legacyBrand=page.getByText('Fluxo DRE',{exact:true});if(await legacyBrand.count()&&await legacyBrand.first().isVisible())throw new Error('QA renderer must use the command-center shell');
  await page.screenshot({path:path.join(outDir,'00-electron-settings-hub-command-center.png'),fullPage:true});
  await page.getByRole('link',{name:'Configurações do sistema'}).click();await page.getByRole('heading',{name:'Configurações',exact:true}).waitFor({state:'visible'});
  await page.getByRole('heading',{name:'Como sua empresa usa o Obra na Mão?'}).waitFor({state:'visible'});
  const storageMode=page.getByLabel('Cenário de uso');await storageMode.waitFor({state:'visible'});
  await page.getByRole('button',{name:'Salvar configuração'}).waitFor({state:'visible'});
  await storageMode.selectOption('lan-host');
  await page.getByRole('button',{name:'Configurar uso compartilhado'}).waitFor({state:'visible'});
  await page.getByText('Avançado e diagnóstico').waitFor({state:'visible'});
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
  const report={schemaVersion:1,status:'passed',generatedAt:new Date().toISOString(),surface:'electron-renderer',linkingVisible:true,syncObservabilityVisible:true,syncConfiguration:true,manualSync:true,conflictResolution:true,calls,screenshots:['00-electron-settings-hub-command-center.png','01-electron-settings-sync.png','02-electron-sync-reconciled.png']};
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');console.log(`DESKTOP_RENDERER_TRANSACTIONAL_QA=${path.join(outDir,'report.json')}`);await context.close();
}finally{if(browser)await browser.close().catch(()=>{});server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,300))}
