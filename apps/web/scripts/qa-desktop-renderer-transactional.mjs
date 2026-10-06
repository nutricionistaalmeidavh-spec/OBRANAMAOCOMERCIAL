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
        state:async()=>structuredClone(onlineState),setBaseUrl:async baseUrl=>{onlineState={linked:false,pending:false,baseUrl};mark('online.setBaseUrl',baseUrl)},start:async()=>{onlineState={...onlineState,linked:false,pending:true};mark('online.start')},status:async()=>structuredClone(onlineState),session:async()=>({authorized:true,role:'admin',company:{id:'company-qa',name:'Empresa QA'},project:{id:'project-qa',name:'Obra QA'}}),membersList:async()=>({members:[{id:'m-admin',email:'admin@qa.local',name:'Admin QA',role:'admin',userId:'admin-user',status:'active',modules:['obra360','rdo','finance','rh'],channels:['desktop','mobile'],permissions:null},{id:'m-joao',email:'joao@qa.local',role:'foreman',joinCode:'JOINQA01',status:'active',modules:['obra360','rdo'],channels:['desktop','mobile'],desktopStorage:{mode:'lan-server',serverId:'srv-qa',autoEnroll:true}}],companyAccess:{modules:['obra360','rdo','finance','rh'],channels:['desktop','mobile']},storageTopology:{mode:'lan-server',serverId:'srv-qa'}}),memberSave:async input=>{mark('online.memberSave',input);return{member:{id:'m-new',...input,status:'active',joinCode:'NEWQA001',desktopStorage:input.channels?.includes('desktop')?{mode:'lan-server',serverId:'srv-qa',autoEnroll:true}:null}}},memberStatus:async(memberId,status)=>{mark('online.memberStatus',{memberId,status});return{member:{id:memberId,status}}},companyDevices:async()=>({devices:[{id:'device-qa',name:'PC QA',email:'joao@qa.local',status:'active',platform:'win32'}]}),revokeCompanyDevice:async deviceId=>{mark('online.revokeCompanyDevice',deviceId);return{ok:true}},disconnect:async()=>{onlineState={...onlineState,linked:false,pending:false};mark('online.disconnect')},
        syncState:async()=>structuredClone(syncState),onSyncStateChanged:()=>()=>{},configureSync:async scope=>{syncState={...syncState,configured:true,scope:{...syncState.scope,...scope}};mark('online.configureSync',scope);return structuredClone(syncState)},syncNow:async()=>{syncState={...syncState,pending:0,lastSyncAt:'2026-09-22T04:30:00.000Z'};mark('online.syncNow');return structuredClone(syncState)},resolveLocalConflict:async(id,resolution)=>{syncState={...syncState,conflicts:syncState.conflicts.filter(item=>item.id!==id)};mark('online.resolveLocalConflict',{id,resolution});return structuredClone(syncState)},
        passwordAuth:async()=>({}),passwordSetup:async()=>({}),syncPull:async()=>({}),syncPush:async()=>({}),publishMobileSummary:async()=>({}),financeRead:async()=>({}),financeWrite:async()=>({}),publishFinanceReference:async()=>({}),aiAnalyze:async()=>({}),conflicts:async()=>[],resolveConflict:async()=>({})
      },
      conflicts:{onRevisionConflict:()=>()=>{}},
      empresas:{list:async()=>[{id:1,razao_social:'Empresa Local QA',nome_fantasia:'Empresa QA',status:'ativa'}]},
      obras:{list:async()=>[{id:10,empresa_id:1,nome:'Obra Local QA'}]},
      cargos:{list:async()=>[{id:201,nome:'Encanador',salario_base_centavos:300000}]},
      funcionarios:{list:async()=>[{id:101,empresa_id:1,obra_atual_id:10,cargo_id:201,nome:'João QA',cpf:'12345678901',status:'ativo',salario_centavos:0}]},
      categorias:{list:async()=>[{id:301,nome:'Folha de pagamento',natureza:'despesa',grupo_dre:'pessoal'},{id:302,nome:'Impostos',natureza:'despesa',grupo_dre:'tributos'}]},
      contas:{list:async()=>[{id:401,tipo:'pagar',empresa_id:1,obra_id:10,categoria_id:301,descricao:'Folha 2026-10',competencia:'2026-10',vencimento:'2026-10-05',valor_centavos:318000,pago_centavos:200000,status:'parcialmente_pago'},{id:402,tipo:'pagar',empresa_id:1,obra_id:10,categoria_id:302,descricao:'DAS Simples Nacional',competencia:'2026-10',vencimento:'2026-10-20',valor_centavos:435000,pago_centavos:0,status:'pendente'}],save:async value=>value,payment:async()=>({})},
      folha:{
        overview:async()=>({contract_version:1,employees:[{funcionario_id:101,funcionario_nome:'João QA',cargo_nome:'Encanador',remuneracao:{salario_centavos:300000,vale_adiantamento_centavos:0,diarias_centavos:0,empreitas_centavos:0,outros_centavos:0},beneficios:{alimentacao_centavos:18000,transporte_centavos:0,outros_centavos:0},descontos:{faltas_centavos:0,outros_centavos:0},encargos:{inss_centavos:0,fgts_centavos:0,outros_centavos:0},total_funcionario_centavos:318000,custo_empresa_centavos:318000,sources:{'remuneracao.salario':[{kind:'folha_lancamento',id:501,origem:'cargo'}],'beneficios.alimentacao':[{kind:'folha_lancamento',id:502,origem:'cargo'}]}}],company_expenses:[{id:402,descricao:'DAS Simples Nacional',categoria_nome:'Impostos',valor_centavos:435000,sources:[{kind:'conta',id:402,origem:'finance'}]}],totals:{by_column_centavos:{'remuneracao.salario':300000,'beneficios.alimentacao':18000},total_funcionarios_centavos:318000,custo_competencia_centavos:753000}}),
        pending:async()=>[],employee:async()=>null,saveVariable:async value=>value,removeVariable:async()=>true,confirm:async()=>({}),exportOverview:async()=>({canceled:true})
      },
      relatorios:{dashboard:async()=>({}),dre:async()=>[{competencia:'2026-10',tipo:'pagar',grupo:'pessoal',categoria:'Folha de pagamento',valor:318000,valor_realizado:200000},{competencia:'2026-10',tipo:'pagar',grupo:'tributos',categoria:'Impostos',valor:435000,valor_realizado:0}]},
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
  await page.getByRole('heading',{name:'Equipe e acessos',level:2,exact:true}).waitFor({state:'visible'});await page.getByRole('button',{name:'Adicionar colaborador'}).waitFor({state:'visible'});await page.getByText('JOINQA01').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Adicionar colaborador'}).click();
  const teamDialog=page.getByRole('dialog',{name:'Adicionar colaborador'});await teamDialog.waitFor({state:'visible'});
  await teamDialog.getByLabel('E-mail').fill('novo.qa@example.test');await teamDialog.getByLabel('Perfil').selectOption('foreman');
  const desktopAccess=teamDialog.locator('[data-team-channel="desktop"]');if(!await desktopAccess.isChecked())await desktopAccess.check();
  await teamDialog.getByRole('button',{name:'Salvar e gerar convite'}).click();
  await page.getByText(/Código de convite: NEWQA001/).waitFor({state:'visible'});
  const syncCard=page.locator('#sync-settings');await syncCard.waitFor({state:'visible'});await syncCard.getByText('Sincronização da obra').waitFor({state:'visible'});await syncCard.getByText('2 alteração(ões) aguardando envio · 1 conflito(s)').waitFor({state:'visible'});
  await page.screenshot({path:path.join(outDir,'01-electron-settings-sync.png'),fullPage:true});

  await page.getByRole('button',{name:'Testar conexão'}).click();await page.getByText('Conexão online ativa — Empresa QA.').waitFor({state:'visible'});
  await syncCard.getByLabel('Empresa local').selectOption('1');await syncCard.getByLabel('Obra local').selectOption('10');await syncCard.getByRole('button',{name:'Conferir vínculo e ativar'}).click();
  const publishDialog=page.getByRole('dialog',{name:'Confirmar publicação desta obra'});await publishDialog.waitFor({state:'visible'});await publishDialog.getByRole('button',{name:'Confirmar'}).click();await syncCard.getByText('Vínculo de sincronização configurado.').waitFor({state:'visible'});

  await syncCard.getByRole('button',{name:'Sincronizar agora'}).click();await syncCard.getByText('Tentativa concluída. Confira as pendências abaixo.').waitFor({state:'visible'});await syncCard.getByText('0 alteração(ões) aguardando envio · 1 conflito(s)').waitFor({state:'visible'});
  await syncCard.getByRole('button',{name:'Usar versão do Obra360'}).click();const conflictDialog=page.getByRole('dialog',{name:'Resolver divergência'});await conflictDialog.waitFor({state:'visible'});await conflictDialog.getByRole('button',{name:'Confirmar'}).click();await syncCard.getByText('Conflito revisado. Acompanhe a próxima sincronização.').waitFor({state:'visible'});await syncCard.getByText('0 alteração(ões) aguardando envio · 0 conflito(s)').waitFor({state:'visible'});
  await page.screenshot({path:path.join(outDir,'02-electron-sync-reconciled.png'),fullPage:true});

  const calls=await page.evaluate(()=>window.__desktopQaCalls||[]);
  const names=calls.map(item=>item.name);for(const required of ['online.configureSync','online.syncNow','online.resolveLocalConflict','online.memberSave'])if(!names.includes(required))throw new Error(`Electron renderer did not call ${required}`);
  const resolution=calls.find(item=>item.name==='online.resolveLocalConflict')?.payload;if(resolution?.id!==77||resolution?.resolution!=='accept_remote')throw new Error(`Electron renderer conflict resolution mismatch: ${JSON.stringify(resolution)}`);
  await page.goto(`${base}/#/rh/folha`,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Controle de pagamento',exact:true}).waitFor({state:'visible'});await page.getByText('Visão geral da competência').waitFor({state:'visible'});await page.screenshot({path:path.join(outDir,'03-electron-rh-payroll.png'),fullPage:true});
  await page.goto(`${base}/#/financeiro?tipo=pagar`,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Contas',exact:true}).waitFor({state:'visible'});await page.getByText('Total previsto na competência').waitFor({state:'visible'});await page.screenshot({path:path.join(outDir,'04-electron-finance-competence.png'),fullPage:true});
  await page.goto(`${base}/#/dre`,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Demonstrativo de resultado',exact:true}).waitFor({state:'visible'});await page.getByText('Realizado',{exact:true}).first().waitFor({state:'visible'});await page.screenshot({path:path.join(outDir,'05-electron-dre-competence-realized.png'),fullPage:true});
  const report={schemaVersion:2,status:'passed',generatedAt:new Date().toISOString(),surface:'electron-renderer',linkingVisible:true,syncObservabilityVisible:true,syncConfiguration:true,manualSync:true,conflictResolution:true,canonicalFinanceParity:true,calls,screenshots:['00-electron-settings-hub-command-center.png','01-electron-settings-sync.png','02-electron-sync-reconciled.png','03-electron-rh-payroll.png','04-electron-finance-competence.png','05-electron-dre-competence-realized.png']};
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');console.log(`DESKTOP_RENDERER_TRANSACTIONAL_QA=${path.join(outDir,'report.json')}`);await context.close();
}finally{if(browser)await browser.close().catch(()=>{});server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,300))}
