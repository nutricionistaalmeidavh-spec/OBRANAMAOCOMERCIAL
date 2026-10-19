import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const today=new Date().toISOString().slice(0,10);
const services=['corte','fixacao','chumbamento','afaq','esgoto','dreno'];
const labels={corte:'Corte',fixacao:'Fixação',chumbamento:'Chumbamento',afaq:'AF/AQ',esgoto:'Esgoto aéreo',dreno:'Dreno'};
const stage=(service,status='not_started')=>({service,label:labels[service],status,targetDate:null,checklist:[{id:`${service}-qa`,label:`Checklist ${labels[service]}`,required:true,checked:false}]});
const baseState=()=>({
  version:7,
  project:{name:'Obra QA Integrada',customer:'Cliente QA',startFloor:0,targetFloor:5},
  settings:{defaultWorkStart:'07:30',marginalEfficiency:.7,averageWeeklyAbsences:0,unassignedCompensationDays:0,attendanceTimesheetMode:'disabled'},
  employees:[
    {id:'emp-1',name:'Ana QA',phone:'16999990001',frontKey:'afaq:0',compensationDays:0},
    {id:'emp-2',name:'Bruno QA',phone:'16999990002',frontKey:'afaq:0',compensationDays:0},
    {id:'emp-3',name:'Carla QA',phone:'16999990003',frontKey:'esgoto:1',compensationDays:1},
    {id:'emp-4',name:'Diego QA',phone:'16999990004',frontKey:'fixacao:2',compensationDays:0},
    {id:'emp-5',name:'Elisa QA',phone:'16999990005',frontKey:'afaq:3',compensationDays:2},
    {id:'emp-6',name:'Fabio QA',phone:'16999990006',frontKey:'dreno:4',compensationDays:0},
    {id:'emp-7',name:'Giovana QA',phone:'16999990007',frontKey:'chumbamento:5',compensationDays:0},
    {id:'emp-8',name:'Henrique QA',phone:'16999990008',frontKey:'corte:2',compensationDays:0},
  ],
  floors:[0,1,2,3,4,5].map(number=>({number,stages:services.map(service=>stage(service,service==='afaq'&&number===0?'in_progress':'not_started'))})),
  days:{[today]:{date:today,presentCount:0,absentCount:0,attendance:{},assignments:[{service:'afaq',label:'AF/AQ',floor:0,crew:2,status:'in_progress',note:'Fixture QA'},
      {service:'esgoto',label:'Esgoto aéreo',floor:1,crew:2,status:'planned',note:'Instalação DN100'},
      {service:'fixacao',label:'Fixação',floor:2,crew:2,status:'planned',note:'Suportes de tubulação'}],events:[],note:'',plans:[],sessions:[],rdoStatus:'draft',rdoDraft:null}},
  checklistTemplates:Object.fromEntries(services.map(service=>[service,[{id:`${service}-qa`,label:`Checklist ${labels[service]}`,required:true}]])),
  issues:[],history:[],
  desktopBridge:{fronts:[],tasks:[{entity:'tarefas_obra',localId:101,sourceDeviceId:'desktop-qa',deleted:false,mobileRevision:0,payload:{titulo:'Instalar prumada QA',status:'aberta',responsavel:'Equipe A'}}],rdos:[],schedule:[]},
});
function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();const port=typeof address==='object'&&address?address.port:null;server.close(error=>error?reject(error):resolve(port))})})}
async function waitFor(url){for(let attempt=0;attempt<80;attempt++){try{const response=await fetch(url);if(response.ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,250))}throw new Error('Field transactional QA server did not become ready')}

const viewports=[{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}];
const port=await freePort();const base=`http://127.0.0.1:${port}`;const viteCli=path.join(root,'node_modules','vite','bin','vite.js');
const server=spawn(process.execPath,[viteCli,'preview','--host','127.0.0.1','--port',String(port)],{cwd:root,env:process.env,stdio:'inherit',shell:false});
const outDir=path.join(root,'qa-artifacts','field-transactional');await fs.mkdir(outDir,{recursive:true});
let browser;const allRequests=[];const screenshots=[];
try{
  await waitFor(`${base}/obra.html`);browser=await chromium.launch({headless:true});
  for(const viewport of viewports){
    let state=baseState();const members=[{id:'m-owner',email:'qa.owner@example.test',role:'admin',userId:'qa-owner',modules:['obra360','rdo'],channels:['desktop','mobile']}];
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},serviceWorkers:'block'});const page=await context.newPage();const requests=[];
    await page.context().addCookies([{name:'obn_auth',value:'1',domain:'127.0.0.1',path:'/'}]);
    await page.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url()),pathname=url.pathname;let body={};try{body=request.postDataJSON()||{}}catch{}
      const record={viewport:viewport.name,method:request.method(),pathname,body};requests.push(record);allRequests.push(record);const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
      if(pathname==='/api/auth/me')return json({user:{userId:'qa-owner',email:'qa.owner@example.test',name:'QA Owner'}});
      if(pathname==='/api/bootstrap')return json({needsClaim:false,isOwner:true,role:'admin',platformRole:'superadmin',projectInitialized:true,user:{userId:'qa-owner',email:'qa.owner@example.test',name:'QA Owner'},company:{id:'company-qa',name:'Empresa QA'},project:{id:'project-qa',name:'Obra QA Integrada',customer:'Cliente QA'},membership:{companyId:'company-qa',projectId:'project-qa',email:'qa.owner@example.test',role:'admin'},access:{licenseId:'owner',modules:['finance','rh','contracts','rdo','obra360','dre','procurement','measurements','documents','universidade','ai'],channels:['desktop','mobile'],status:'active'}});
      if(pathname==='/api/project'&&request.method()==='GET')return json({state});
      if(pathname==='/api/project/state'&&request.method()==='PUT'){state=structuredClone(body.state);return json({ok:true,state});}
      if(pathname==='/api/mobile/summary')return json({summary:{generatedAt:new Date().toISOString(),scope:{period:'Competência 2026-10 · dados fictícios'},modules:{
        obra360:{physicalProgress:38.5,activeStages:11,overdueStages:2,productiveHours:1480,completedProduction:23},
        rdo:{total:19,pending:3,finalized:16},
        documents:{total:37,expiring30d:4},
        dre:{competenceRevenue:12000000,competenceExpense:8500000,competenceResult:3500000,revenue:10500000,expense:7200000,result:3300000,budget:3750000,variance:-250000},
        rh:{activeEmployees:8,openPayrolls:1,pendingPayments:3},
        contracts:{active:5,totalValue:42000000,addenda:2},
        procurement:{requestsOpen:7,ordersOpen:4,committed:2860000},
        measurements:{total:12,open:3,netValue:9850000}
      }}});
      if(pathname==='/api/mobile/sync/conflicts')return json({conflicts:[]});
      if(pathname==='/api/attendance'&&request.method()==='POST'){
        const day=state.days[today];day.attendance=day.attendance||{};day.attendance[body.employeeId]=body.status;day.presentCount=Object.values(day.attendance).filter(value=>value==='present').length;day.absentCount=Object.values(day.attendance).filter(value=>value==='absent').length;const employee=state.employees.find(item=>item.id===body.employeeId);if(employee)employee.attendance=body.status;return json({day,employee});
      }
      if(pathname==='/api/members'&&request.method()==='GET')return json({members,companyAccess:{modules:['finance','rh','contracts','rdo','obra360','dre','procurement','measurements','documents','universidade','ai'],channels:['desktop','mobile']}});
      if(pathname==='/api/members'&&request.method()==='POST'){const member={id:`member-${members.length+1}`,email:String(body.email),role:String(body.role),employeeId:body.employeeId,joinCode:'QAJOIN01',modules:[...(body.modules||[])],channels:[...(body.channels||[])]};members.push(member);return json({member});}
      if(pathname==='/api/mobile/bridge/update'&&request.method()==='POST'){
        const item=state.desktopBridge.tasks.find(task=>Number(task.localId)===Number(body.localId)&&task.sourceDeviceId===body.sourceDeviceId);if(!item)return json({error:'Item não encontrado.'},404);item.payload={...item.payload,...body.patch};item.mobileRevision=Number(item.mobileRevision||0)+1;return json({ok:true,item});
      }
      return json({error:`Unhandled field QA route ${request.method()} ${pathname}`},404);
    });
    const shot=async (name,{fullPage=true}={})=>{const file=`${viewport.name}-${name}.png`;screenshots.push(file);await page.screenshot({path:path.join(outDir,file),fullPage})};
    const waitForSnapshotSync=async(label,promise)=>{try{return await promise}catch(error){const syncText=await page.locator('#fieldSyncStatus').textContent().catch(()=>null);throw new Error(`${viewport.name}: ${label} did not autosync through PUT /api/project/state${syncText?` (${syncText.trim()})`:''}; ${error instanceof Error?error.message:String(error)}`)}};
    const nextSnapshotSync=()=>page.waitForRequest(request=>request.method()==='PUT'&&new URL(request.url()).pathname==='/api/project/state',{timeout:7000});

    await page.goto(`${base}/obra.html#obra`,{waitUntil:'domcontentloaded'});await page.locator('#newPlan').waitFor({state:'visible'});
    if(!(await page.title()).includes('Obra QA Integrada'))throw new Error(`${viewport.name}: project identity was not loaded from remote bootstrap`);await page.getByText('Fixture QA').waitFor({state:'visible'});await shot('01-day-remote-state');

    await page.locator('#newPlan').click();await page.locator('#pservice').selectOption('afaq');await page.locator('#pfloor').selectOption('0');await page.locator('#pcrew').fill('2');await page.locator('#planEmployees input[value="emp-1"]').check();await page.locator('#planEmployees input[value="emp-2"]').check();await page.locator('#pnote').fill('Planejamento QA');await shot('02-planejamento-formulario');const planSync=nextSnapshotSync();await page.locator('#savePlan').click();await page.locator('.plan-card').filter({hasText:'AF/AQ'}).waitFor({state:'visible'});await waitForSnapshotSync('plan creation',planSync);await shot('02-plan-created');

    await page.locator('.plan-card').filter({hasText:'AF/AQ'}).locator('.plan-start').click();await page.locator('#createSession').waitFor({state:'visible'});const crewChecks=page.locator('#sessionCrew input');if(await crewChecks.count()>=2){await crewChecks.nth(0).check();await crewChecks.nth(1).check()}await page.locator('#sstart').fill('00:01');await shot('04-iniciar-apontamento-formulario');await page.locator('#createSession').click();await page.locator('.session-card').waitFor({state:'visible'});await shot('03-session-running');
    await page.locator('.session-card .session-pause').click();await page.locator('.session-card .session-resume').waitFor({state:'visible'});await page.locator('.session-card .session-resume').click();await page.locator('.session-card .session-finish').waitFor({state:'visible'});await page.locator('.session-card .session-finish').click();await page.locator('#sresult').selectOption('completed');await page.locator('#snote').fill('Execução concluída QA');await shot('06-finalizar-apontamento-formulario');const sessionSync=nextSnapshotSync();await page.locator('#finishSession').click();await page.locator('.session-card').filter({hasText:'Sessão concluída'}).waitFor({state:'visible'});await waitForSnapshotSync('session completion',sessionSync);await shot('04-session-finished');

    await page.locator('[data-screen="team"]').first().click();await page.locator('h2').filter({hasText:'Equipe'}).first().waitFor({state:'visible'});await shot('08-equipe-visao-geral');const attendanceSync=nextSnapshotSync();await page.locator('.att[data-id="emp-1"]').click();await page.locator('.att[data-id="emp-1"]').filter({hasText:'Presente'}).waitFor({state:'visible'});await waitForSnapshotSync('authoritative attendance reconciliation',attendanceSync);await shot('05-team-attendance');

    await page.locator('[data-screen="today"]').first().click();await page.locator('#reviewRdo').click();await page.locator('#prepareRdo').waitFor({state:'visible'});await shot('06-rdo-review');await page.locator('#prepareRdo').click();

    await page.locator('[data-screen="issues"]').first().click();await shot('11-pendencias-visao-geral');await page.locator('#newIssue').click();await page.locator('#itype').selectOption('blocked');await page.locator('#ititle').fill('Material pendente QA');await page.locator('#ireason').fill('Aguardando material de teste');await shot('12-pendencia-formulario');const issueSync=nextSnapshotSync();await page.locator('#saveIssue').click();await page.getByText('Material pendente QA').waitFor({state:'visible'});await waitForSnapshotSync('issue creation',issueSync);await shot('07-issue-created');

    await page.locator('[data-screen="obra360"]').first().click();await shot('14-obra360-visao-geral');await page.locator('[data-screen="more"]').first().click();await shot('15-planejamento-e-produtividade');await page.locator('[data-screen="settings"]').first().click();await shot('16-configuracoes');await page.locator('#defaultStart').fill('08:00');const settingsSync=nextSnapshotSync();await page.locator('#saveDefaultStart').click();await waitForSnapshotSync('settings update',settingsSync);await page.locator('#governancePermissionsBtn').waitFor({state:'visible'});await page.locator('#governancePermissionsBtn').click();await shot('17-governanca-permissoes');await page.locator('#addGovMember').click();await page.locator('#govMemberEmail').fill('encarregado.qa@example.test');await page.locator('#govMemberRole').selectOption('foreman');await shot('18-novo-usuario-formulario');await page.locator('#saveGovMemberBtn').click();await page.getByText('encarregado.qa@example.test').waitFor({state:'visible'});await shot('08-user-created');await page.locator('#sheet .close').click();

    await page.locator('[data-screen="obra360"]').first().click();await page.getByText('Instalar prumada QA').waitFor({state:'visible'});await page.locator('.bridge-action').click();await page.getByText('concluida').waitFor({state:'visible'});await shot('09-desktop-bridge-updated');

    await page.goto(`${base}/gestao.html#gestao/dre`,{waitUntil:'domcontentloaded'});await page.locator('#management-dre').waitFor({state:'visible'});await page.getByText('Despesas · Competência',{exact:true}).waitFor({state:'visible'});await page.getByText('Despesas · Caixa realizado',{exact:true}).waitFor({state:'visible'});await shot('10-management-dre-basis');


    // Captura complementar de rotas da Gestao sem alterar dados de producao.
    for(const [alias,hash,expectedSelector] of [
      ['21-gestao-visao-geral','#gestao','#content'],
      ['21-gestao-producao','#gestao/obra360','#management-obra360'],
      ['22-gestao-rdo','#gestao/rdo','#management-rdo'],
      ['23-gestao-rh','#gestao/rh','#management-rh'],
      ['24-gestao-financeiro','#gestao/dre','#management-dre'],
      ['25-gestao-contratos','#gestao/contracts','#management-contracts'],
      ['26-gestao-compras','#gestao/procurement','#management-procurement'],
      ['27-gestao-medicoes','#gestao/measurements','#management-measurements'],
      ['28-gestao-documentos','#gestao/documents','#management-documents']
    ]){
      try{
        await page.goto(base+'/gestao.html'+hash,{waitUntil:'domcontentloaded'});
        await page.locator(expectedSelector).waitFor({state:'visible',timeout:4500});
        await page.waitForTimeout(350);
        const visibleText=await page.locator('#content').innerText().catch(()=> '');
        if(visibleText.trim().length>40){
          if(hash!=='#gestao')await page.locator(expectedSelector).scrollIntoViewIfNeeded();
          await shot(alias,{fullPage:hash==='#gestao'});
        }
      }catch(error){
        console.warn('Optional management capture unavailable '+alias+': '+String(error?.message||error).slice(0,140));
      }
    }

    const required=[['PUT','/api/project/state'],['POST','/api/attendance'],['POST','/api/members'],['POST','/api/mobile/bridge/update']];for(const [method,pathname] of required)if(!requests.some(item=>item.method===method&&item.pathname===pathname))throw new Error(`${viewport.name}: missing ${method} ${pathname}`);
    const snapshotWrites=requests.filter(item=>item.method==='PUT'&&item.pathname==='/api/project/state');if(snapshotWrites.length<5)throw new Error(`${viewport.name}: expected at least 5 snapshot autosync writes, received ${snapshotWrites.length}`);
    if(requests.some(item=>item.pathname.startsWith('/api/owner/licenses')||item.pathname.startsWith('/api/owner/companies')))throw new Error(`${viewport.name}: field QA must not mutate commercial licensing`);
    if(!state.employees.some(item=>item.name==='Ana QA'))throw new Error(`${viewport.name}: remote project fixture was lost`);
    if(state.desktopBridge.tasks[0]?.payload?.status!=='concluida')throw new Error(`${viewport.name}: Desktop-origin task update was not preserved after autosync checkpoints`);
    await context.close();
  }
  const report={schemaVersion:2,status:'passed',generatedAt:new Date().toISOString(),remoteStateRendered:true,licenseMutationsPerformed:0,viewports:viewports.map(v=>v.name),requests:allRequests,screenshots,fixture:{employees:8,floors:6,assignments:3,source:'simulated-local-qa'},captureType:'actual-Chromium-screenshot'};await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');console.log(`FIELD_TRANSACTIONAL_QA=${path.join(outDir,'report.json')}`);
}finally{if(browser)await browser.close().catch(()=>{});server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,300))}
