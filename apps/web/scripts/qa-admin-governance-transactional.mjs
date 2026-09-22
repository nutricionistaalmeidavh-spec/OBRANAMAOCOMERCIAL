import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const today=new Date().toISOString().slice(0,10);
const baseState=()=>({
  version:7,
  project:{name:'Obra QA Governança',customer:'Cliente QA',startFloor:0,targetFloor:1},
  settings:{defaultWorkStart:'07:30',marginalEfficiency:.7,averageWeeklyAbsences:0,unassignedCompensationDays:0,attendanceTimesheetMode:'disabled'},
  employees:[{id:'emp-1',name:'Ana QA',frontKey:'',compensationDays:0}],
  floors:[0,1].map(number=>({number,stages:[]})),
  days:{[today]:{date:today,presentCount:0,absentCount:0,attendance:{},assignments:[],events:[],note:'',plans:[],sessions:[]}},
  checklistTemplates:{},issues:[],history:[],desktopBridge:{fronts:[],tasks:[],rdos:[],schedule:[]},
});
function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();const port=typeof address==='object'&&address?address.port:null;server.close(error=>error?reject(error):resolve(port))})})}
async function waitFor(url){for(let attempt=0;attempt<80;attempt++){try{const response=await fetch(url);if(response.ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,250))}throw new Error('Admin governance QA server did not become ready')}

const viewports=[{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}];
const port=await freePort();const base=`http://127.0.0.1:${port}`;const viteCli=path.join(root,'node_modules','vite','bin','vite.js');
const server=spawn(process.execPath,[viteCli,'preview','--host','127.0.0.1','--port',String(port)],{cwd:root,env:process.env,stdio:'inherit',shell:false});
const outDir=path.join(root,'qa-artifacts','admin-governance-transactional');await fs.mkdir(outDir,{recursive:true});
let browser;const allRequests=[];const screenshots=[];const savedMembers=[];const deviceMutations=[];
try{
  await waitFor(`${base}/obra.html`);browser=await chromium.launch({headless:true});
  for(const viewport of viewports){
    let state=baseState();
    const members=[{id:'m-owner',email:'qa.owner@example.test',role:'admin',userId:'qa-owner',modules:['obra360','rdo'],channels:['desktop','mobile']}];
    const devices=[
      {id:'device-1',name:'Notebook QA',platform:'win32',email:'qa.owner@example.test',status:'active',lastSeenAt:'2026-09-22T02:40:00.000Z',installationId:'install-qa-1'},
      {id:'device-2',name:'PC antigo',platform:'win32',email:'qa.owner@example.test',status:'revoked',lastSeenAt:'2026-09-20T12:00:00.000Z',installationId:'install-qa-2'},
    ];
    const syncStatus={serverRevision:18,desktopRevision:17,conflictCount:1,lastServerUpdateAt:'2026-09-22T02:45:00.000Z',lastDesktopSeenAt:'2026-09-22T02:40:00.000Z',activeDevices:1,revokedDevices:1,devices};
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},serviceWorkers:'block'});const page=await context.newPage();const requests=[];
    await page.context().addCookies([{name:'obn_auth',value:'1',domain:'127.0.0.1',path:'/'}]);
    await page.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url()),pathname=url.pathname;let body={};try{body=request.postDataJSON()||{}}catch{}
      const record={viewport:viewport.name,method:request.method(),pathname,body};requests.push(record);allRequests.push(record);const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
      if(pathname==='/api/auth/me')return json({user:{userId:'qa-owner',email:'qa.owner@example.test',name:'QA Owner'}});
      if(pathname==='/api/bootstrap')return json({needsClaim:false,isOwner:false,role:'admin',projectInitialized:true,user:{userId:'qa-owner',email:'qa.owner@example.test',name:'QA Owner'},company:{id:'company-qa',name:'Empresa QA'},project:{id:'project-qa',name:'Obra QA Governança',customer:'Cliente QA'},membership:{companyId:'company-qa',projectId:'project-qa',email:'qa.owner@example.test',role:'admin'},access:{licenseId:'lic-qa',modules:['obra360','rdo','documents'],channels:['desktop','mobile'],status:'active'}});
      if(pathname==='/api/project'&&request.method()==='GET')return json({state});
      if(pathname==='/api/project/state'&&request.method()==='PUT'){state=structuredClone(body.state);return json({ok:true,revision:19});}
      if(pathname==='/api/mobile/summary')return json({summary:{generatedAt:new Date().toISOString(),modules:{rdo:{open:0}}}});
      if(pathname==='/api/mobile/sync/conflicts')return json({conflicts:[]});
      if(pathname==='/api/members'&&request.method()==='GET')return json({members,companyAccess:{modules:['obra360','rdo','documents'],channels:['desktop','mobile']}});
      if(pathname==='/api/members'&&request.method()==='POST'){
        const member={id:`member-${members.length+1}`,email:String(body.email),role:String(body.role),employeeId:body.employeeId,joinCode:'QAJOIN01',modules:[...(body.modules||[])],channels:[...(body.channels||[])]};members.push(member);savedMembers.push({viewport:viewport.name,...body});return json({member});
      }
      if(pathname==='/api/mobile/admin/devices'&&request.method()==='GET')return json({devices});
      if(pathname.startsWith('/api/mobile/admin/devices/')&&request.method()==='PUT'){
        const id=pathname.split('/').at(-1),device=devices.find(item=>item.id===id);if(!device)return json({error:'Computador não encontrado.'},404);device.status=body.status==='active'?'active':'revoked';deviceMutations.push({viewport:viewport.name,id,status:device.status});return json({ok:true,status:device.status,device});
      }
      if(pathname==='/api/mobile/admin/sync-status'&&request.method()==='GET')return json(syncStatus);
      return json({error:`Unhandled governance QA route ${request.method()} ${pathname}`},404);
    });
    const shot=async name=>{const file=`${viewport.name}-${name}.png`;screenshots.push(file);await page.screenshot({path:path.join(outDir,file),fullPage:true})};

    await page.goto(`${base}/obra.html#obra`,{waitUntil:'domcontentloaded'});await page.locator('#newPlan').waitFor({state:'visible'});
    await page.locator('[data-screen="settings"]').first().click();
    await page.locator('#adminGovernanceCard').waitFor({state:'visible',timeout:7000});await shot('01-governance-card');

    await page.locator('#governancePermissionsBtn').click();await page.locator('#govMemberEmail').fill('encarregado.granular@example.test');await page.locator('#govMemberRole').selectOption('foreman');
    await page.locator('[data-gov-module="obra360"]').check();await page.locator('[data-gov-module="rdo"]').check();await page.locator('[data-gov-module="documents"]').uncheck();
    await page.locator('[data-gov-channel="mobile"]').check();await page.locator('[data-gov-channel="desktop"]').uncheck();
    await page.locator('#saveGovMemberBtn').click();await page.getByText('encarregado.granular@example.test').waitFor({state:'visible'});await page.getByText('Obra360').last().waitFor({state:'visible'});await page.getByText('RDO').last().waitFor({state:'visible'});await page.getByText('Mobile').last().waitFor({state:'visible'});await shot('02-granular-permissions');await page.locator('#sheet .close').click();

    await page.locator('#governanceDevicesBtn').click();const deviceRow=page.locator('[data-device-id="device-1"]');await deviceRow.waitFor({state:'visible'});await deviceRow.getByText('Notebook QA').waitFor({state:'visible'});await deviceRow.locator('[data-device-action="revoke"]').click();await deviceRow.getByText('Revogado').waitFor({state:'visible'});await deviceRow.locator('[data-device-action="activate"]').click();await deviceRow.getByText('Ativo').waitFor({state:'visible'});await shot('03-device-control');await page.locator('#sheet .close').click();

    await page.locator('#governanceSyncBtn').click();await page.getByText('Servidor 18').waitFor({state:'visible'});await page.getByText('Desktop 17').waitFor({state:'visible'});await page.getByText('1 revisão atrás').waitFor({state:'visible'});await page.getByText('1 conflito').waitFor({state:'visible'});await page.getByText('Notebook QA').waitFor({state:'visible'});await shot('04-sync-observability');

    const memberPost=requests.find(item=>item.method==='POST'&&item.pathname==='/api/members'&&item.body.email==='encarregado.granular@example.test');if(!memberPost)throw new Error(`${viewport.name}: granular member save was not sent`);
    if(JSON.stringify(memberPost.body.modules)!==JSON.stringify(['obra360','rdo']))throw new Error(`${viewport.name}: granular modules were not preserved: ${JSON.stringify(memberPost.body.modules)}`);
    if(JSON.stringify(memberPost.body.channels)!==JSON.stringify(['mobile']))throw new Error(`${viewport.name}: granular channels were not preserved: ${JSON.stringify(memberPost.body.channels)}`);
    if(!requests.some(item=>item.method==='GET'&&item.pathname==='/api/mobile/admin/devices'))throw new Error(`${viewport.name}: tenant device list was not requested`);
    if(!requests.some(item=>item.method==='PUT'&&item.pathname==='/api/mobile/admin/devices/device-1'&&item.body.status==='revoked'))throw new Error(`${viewport.name}: device revoke was not requested`);
    if(!requests.some(item=>item.method==='PUT'&&item.pathname==='/api/mobile/admin/devices/device-1'&&item.body.status==='active'))throw new Error(`${viewport.name}: device reactivation was not requested`);
    if(!requests.some(item=>item.method==='GET'&&item.pathname==='/api/mobile/admin/sync-status'))throw new Error(`${viewport.name}: sync observability endpoint was not requested`);
    if(requests.some(item=>item.pathname.startsWith('/api/owner/')||item.pathname.startsWith('/api/license/')))throw new Error(`${viewport.name}: client governance must not call owner/license APIs`);
    await context.close();
  }
  const report={schemaVersion:1,status:'passed',generatedAt:new Date().toISOString(),viewports:viewports.map(v=>v.name),granularPermissions:true,tenantDeviceControl:true,syncObservability:true,ownerApisTouched:false,savedMembers,deviceMutations,requests:allRequests,screenshots};await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');console.log(`ADMIN_GOVERNANCE_TRANSACTIONAL_QA=${path.join(outDir,'report.json')}`);
}finally{if(browser)await browser.close().catch(()=>{});server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,300))}
