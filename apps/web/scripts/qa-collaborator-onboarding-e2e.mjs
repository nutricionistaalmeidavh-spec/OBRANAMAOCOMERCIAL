import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const webRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const desktopRoot=path.resolve(webRoot,'../desktop');
const outDir=path.join(webRoot,'qa-artifacts','collaborator-onboarding-e2e');
await fs.mkdir(outDir,{recursive:true});

function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();const port=typeof address==='object'&&address?address.port:null;server.close(error=>error?reject(error):resolve(port))})})}
async function waitFor(url){for(let attempt=0;attempt<100;attempt++){try{const response=await fetch(url);if(response.ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,200))}throw new Error(`Preview did not become ready: ${url}`)}
const today=()=>new Date().toISOString().slice(0,10);

const webPort=await freePort(),desktopPort=await freePort();
const webBase=`http://127.0.0.1:${webPort}`,desktopBase=`http://127.0.0.1:${desktopPort}`;
const webVite=path.join(webRoot,'node_modules','vite','bin','vite.js');
const desktopVite=path.join(desktopRoot,'node_modules','vite','bin','vite.js');
const webServer=spawn(process.execPath,[webVite,'preview','--host','127.0.0.1','--port',String(webPort)],{cwd:webRoot,env:process.env,stdio:'inherit',shell:false});
const desktopServer=spawn(process.execPath,[desktopVite,'preview','--host','127.0.0.1','--port',String(desktopPort)],{cwd:desktopRoot,env:process.env,stdio:'inherit',shell:false});

const inviteCode='JOINQA01',serverId='server-company-qa';
const member={id:'member-joao',email:'joao.qa@example.test',name:'João QA',role:'employee',employeeId:'emp-1',status:'active',joinCode:null,userId:null,modules:['obra360'],channels:['mobile','desktop'],desktopStorage:{mode:'lan-server',serverId,autoEnroll:true}};
let inviteCreated=false,memberClaimed=false,commercialActivationTouched=false,memberRevoked=false;
const adminRequests=[],memberRequests=[];
let browser;

const adminState=()=>({
  version:7,
  project:{name:'Obra QA Onboarding',customer:'Cliente QA',startFloor:0,targetFloor:1},
  settings:{defaultWorkStart:'07:30',marginalEfficiency:.7,averageWeeklyAbsences:0,unassignedCompensationDays:0,attendanceTimesheetMode:'disabled'},
  employees:[{id:'emp-1',name:'João QA',frontKey:'',compensationDays:0}],
  floors:[{number:0,stages:[]},{number:1,stages:[]}],
  days:{[today()]:{date:today(),presentCount:0,absentCount:0,attendance:{},assignments:[],events:[],note:'',plans:[],sessions:[]}},
  checklistTemplates:{},issues:[],history:[],desktopBridge:{fronts:[],tasks:[],rdos:[],schedule:[]}
});

function adminBootstrap(){
  return{needsClaim:false,isOwner:true,role:'admin',projectInitialized:true,user:{userId:'owner-qa',email:'owner.qa@example.test',name:'Owner QA'},company:{id:'company-qa',name:'Empresa QA'},project:{id:'project-qa',name:'Obra QA Onboarding',customer:'Cliente QA'},membership:{id:'member-owner',companyId:'company-qa',projectId:'project-qa',email:'owner.qa@example.test',role:'admin',canonicalOwner:true},access:{licenseId:'license-qa',modules:['obra360','rdo','documents'],channels:['desktop','mobile'],status:'active'}}
}
function memberBootstrap(){
  if(memberRevoked||!memberClaimed)return{needsClaim:true,authorized:false,isOwner:false,user:{userId:'user-joao',email:member.email,name:'João QA'},license:null};
  return{needsClaim:false,isOwner:false,role:'employee',projectInitialized:true,user:{userId:'user-joao',email:member.email,name:'João QA'},company:{id:'company-qa',name:'Empresa QA'},project:{id:'project-qa',name:'Obra QA Onboarding',customer:'Cliente QA'},membership:{...member,companyId:'company-qa',projectId:'project-qa'},access:{licenseId:'license-qa',modules:['obra360'],channels:['mobile','desktop'],status:'active'}}
}

try{
  await Promise.all([waitFor(`${webBase}/obra.html`),waitFor(desktopBase)]);
  browser=await chromium.launch({headless:true});

  // A. Admin creates the canonical collaborator invitation in the Web/PWA.
  const adminContext=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
  await adminContext.addCookies([{name:'obn_auth',value:'1',domain:'127.0.0.1',path:'/'}]);
  const adminPage=await adminContext.newPage();
  let state=adminState();
  const members=[{id:'member-owner',email:'owner.qa@example.test',name:'Owner QA',role:'admin',status:'active',userId:'owner-qa',modules:['obra360','rdo'],channels:['desktop','mobile'],canonicalOwner:true}];
  await adminPage.route('**/api/**',async route=>{
    const request=route.request(),pathname=new URL(request.url()).pathname;let body={};try{body=request.postDataJSON()||{}}catch{}
    adminRequests.push({method:request.method(),pathname,body});
    const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
    if(pathname==='/api/auth/me')return json({user:adminBootstrap().user});
    if(pathname==='/api/bootstrap')return json(adminBootstrap());
    if(pathname==='/api/project'&&request.method()==='GET')return json({state});
    if(pathname==='/api/project/state'&&request.method()==='PUT'){state=structuredClone(body.state);return json({ok:true,revision:2})}
    if(pathname==='/api/mobile/summary')return json({summary:{generatedAt:new Date().toISOString(),modules:{rdo:{open:0}}}});
    if(pathname==='/api/mobile/sync/conflicts')return json({conflicts:[]});
    if(pathname==='/api/members'&&request.method()==='GET')return json({members,companyAccess:{modules:['obra360','rdo','documents'],channels:['desktop','mobile']},storageTopology:{mode:'lan-server',serverId}});
    if(pathname==='/api/members'&&request.method()==='POST'){
      inviteCreated=true;
      Object.assign(member,{role:String(body.role),employeeId:body.employeeId,status:'active',joinCode:inviteCode,modules:[...(body.modules||[])],channels:[...(body.channels||[])],desktopStorage:{mode:'lan-server',serverId,autoEnroll:true}});
      if(!members.some(item=>item.id===member.id))members.push(member);
      return json({member,storageTopology:{mode:'lan-server',serverId}});
    }
    const memberStatusMatch=pathname.match(/^\/api\/members\/([^/]+)\/status$/);
    if(memberStatusMatch&&request.method()==='PUT'){
      if(memberStatusMatch[1]!==member.id)return json({error:'Colaborador não encontrado.'},404);
      member.status=body.status==='revoked'?'revoked':'active';memberRevoked=member.status==='revoked';
      return json({member:{id:member.id,email:member.email,role:member.role,status:member.status}});
    }
    if(pathname==='/api/mobile/admin/devices'&&request.method()==='GET')return json({devices:[]});
    if(pathname==='/api/mobile/admin/sync-status'&&request.method()==='GET')return json({serverRevision:1,desktopRevision:1,conflictCount:0,lastServerUpdateAt:new Date().toISOString(),lastDesktopPushAt:null,lastDesktopSeenAt:null,activeDevices:0,revokedDevices:0,devices:[]});
    return json({error:`Unhandled admin onboarding route ${request.method()} ${pathname}`},404);
  });

  await adminPage.goto(`${webBase}/obra.html#obra`,{waitUntil:'domcontentloaded'});
  await adminPage.locator('#newPlan').waitFor({state:'visible'});
  await adminPage.locator('[data-screen="obra360"]').first().click();
  await adminPage.locator('[data-screen="more"]').first().click();
  await adminPage.locator('[data-screen="settings"]').first().click();
  await adminPage.locator('#adminGovernanceCard').waitFor({state:'visible',timeout:7000});
  await adminPage.locator('#governancePermissionsBtn').click();
  await adminPage.locator('#govMemberEmail').fill(member.email);
  await adminPage.locator('#govMemberRole').selectOption('employee');
  await adminPage.locator('#govMemberEmployee').selectOption('emp-1');
  const desktopChannel=adminPage.locator('[data-gov-channel="desktop"]');
  if(!await desktopChannel.isChecked())await desktopChannel.check();
  await adminPage.locator('#saveGovMemberBtn').click();
  await adminPage.getByText(member.email).waitFor({state:'visible'});
  await adminPage.getByText(new RegExp(inviteCode)).waitFor({state:'visible'});
  if(!inviteCreated||!member.channels.includes('desktop')||member.desktopStorage.serverId!==serverId)throw new Error('Admin did not create a Desktop invitation bound to the canonical company server.');
  await adminPage.screenshot({path:path.join(outDir,'01-admin-created-invite.png'),fullPage:true});
  await adminPage.locator('#sheet .close').click();

  // B. The invited collaborator claims the same invitation in Web/PWA.
  const memberContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await memberContext.addCookies([{name:'obn_auth',value:'1',domain:'127.0.0.1',path:'/'}]);
  const memberPage=await memberContext.newPage();
  await memberPage.route('**/api/**',async route=>{
    const request=route.request(),pathname=new URL(request.url()).pathname;let body={};try{body=request.postDataJSON()||{}}catch{}
    memberRequests.push({method:request.method(),pathname,body});
    const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
    if(pathname==='/api/auth/me')return json({user:{userId:'user-joao',email:member.email,name:'João QA'}});
    if(pathname==='/api/bootstrap')return json(memberBootstrap());
    if(pathname==='/api/access/claim'&&request.method()==='POST'){
      if(memberRevoked)return json({error:'Este convite foi revogado pelo administrador.'},403);
      if(String(body.code||'').toUpperCase()!==inviteCode)return json({error:'Código de acesso inválido.'},400);
      memberClaimed=true;member.userId='user-joao';member.joinCode=null;
      return json({role:member.role,membership:{...member,companyId:'company-qa',projectId:'project-qa'}});
    }
    if(pathname==='/api/license/claim'&&request.method()==='POST'){commercialActivationTouched=true;return json({error:'Convite de colaborador não é ativação comercial.'},409)}
    if(pathname==='/api/my-tasks'&&request.method()==='GET')return json({tasks:[{id:'task-1',date:today(),service:'afaq',floor:1,startTime:'07:30',note:'QA onboarding',source:'qa'}],employee:{name:'João QA'},project:{name:'Obra QA Onboarding'}});
    return json({error:`Unhandled member onboarding route ${request.method()} ${pathname}`},404);
  });

  await memberPage.goto(`${webBase}/obra.html#obra`,{waitUntil:'domcontentloaded'});
  await memberPage.getByRole('heading',{name:'Como você deseja começar?'}).waitFor({state:'visible'});
  await memberPage.getByLabel('Código de convite').fill(inviteCode);
  await memberPage.getByRole('button',{name:'Ativar meu acesso'}).click();
  await memberPage.getByRole('heading',{name:'Olá, João QA'}).waitFor({state:'visible'});
  await memberPage.getByText('QA onboarding',{exact:true}).waitFor({state:'visible'});
  if(commercialActivationTouched)throw new Error('Member invitation incorrectly touched commercial activation.');
  if(!memberRequests.some(item=>item.pathname==='/api/access/claim'&&item.body.code===inviteCode))throw new Error('PWA did not claim the member invitation.');
  await memberPage.screenshot({path:path.join(outDir,'02-member-pwa-claimed.png'),fullPage:true});

  // C/F. The exact same invitation path is accepted directly by Desktop,
  // inherits the canonical LAN server, completes storage, and Google remains available.
  const desktopContext=await browser.newContext({viewport:{width:1100,height:760},serviceWorkers:'block'});
  const desktopPage=await desktopContext.newPage();
  await desktopPage.addInitScript(({inviteCode,serverId,email})=>{
    const calls=[];window.__onboardingCalls=calls;
    const mark=(name,payload)=>{calls.push({name,payload:payload??null})};
    window.fluxoDre={
      app:{getLayout:async()=> 'classic'},
      conflicts:{onRevisionConflict:()=>()=>{}},
      online:{
        state:async()=>({linked:false,baseUrl:'https://obra.qa.example.test',pending:null,storageRequired:null}),
        passwordAuth:async input=>{
          mark('online.passwordAuth',input);
          if(input.email!==email||String(input.code||'').toUpperCase()!==inviteCode||input.accessPurpose!=='member-invitation')throw new Error('Convite Desktop divergente.');
          return{linked:false,needsSetup:false,company:{id:'company-qa',name:'Empresa QA'},project:{id:'project-qa',name:'Obra QA Onboarding'},storageRequired:{mode:'lan-server',serverId,autoEnroll:true},message:'Acesso confirmado. Conecte ao computador principal.'}
        },
        completeStorage:async address=>{mark('online.completeStorage',{address,serverId});return{linked:true,storageStatus:'connected',serverId,storageRequired:null}},
        start:async()=>{mark('online.start')},
        status:async()=>({linked:false,pending:{expiresAt:null}})
      }
    };
  },{inviteCode,serverId,email:member.email});

  await desktopPage.goto(desktopBase,{waitUntil:'domcontentloaded'});
  await desktopPage.getByRole('heading',{name:'Entre na sua empresa'}).waitFor({state:'visible'});
  await desktopPage.getByRole('button',{name:'Recebi um convite de uma empresa'}).click();
  await desktopPage.getByLabel('E-mail').fill(member.email);
  await desktopPage.getByLabel('Código de convite').fill(inviteCode);
  await desktopPage.getByLabel('Crie sua senha (mínimo 8 caracteres)').fill('senha-qa-123');
  await desktopPage.getByRole('button',{name:'Ativar meu acesso'}).click();
  await desktopPage.getByRole('heading',{name:'Conectar ao computador principal'}).waitFor({state:'visible'});
  await desktopPage.getByText('servidor local').waitFor({state:'visible'});
  await desktopPage.screenshot({path:path.join(outDir,'03-member-desktop-canonical-server.png'),fullPage:true});
  await desktopPage.getByRole('button',{name:'Encontrar e conectar automaticamente'}).click();
  await desktopPage.getByRole('heading',{name:'Entre na sua empresa'}).waitFor({state:'visible'});
  const desktopCalls=await desktopPage.evaluate(()=>window.__onboardingCalls||[]);
  const passwordCall=desktopCalls.find(item=>item.name==='online.passwordAuth')?.payload;
  const storageCall=desktopCalls.find(item=>item.name==='online.completeStorage')?.payload;
  if(passwordCall?.code!==inviteCode||passwordCall?.accessPurpose!=='member-invitation')throw new Error('Desktop did not use the member invitation purpose.');
  if(storageCall?.serverId!==serverId)throw new Error('Desktop did not inherit the canonical server id.');
  await desktopPage.getByRole('button',{name:'Continuar com Google'}).click();
  const afterGoogle=await desktopPage.evaluate(()=>window.__onboardingCalls||[]);
  if(!afterGoogle.some(item=>item.name==='online.start'))throw new Error('Google owner flow was not preserved.');

  // D. Revoking the canonical member cuts the PWA access without deleting/reusing the commercial license.
  await adminPage.locator('#governancePermissionsBtn').click();
  const memberRow=adminPage.locator(`div.governance-member[data-member-id="${member.id}"]`);
  await memberRow.waitFor({state:'visible'});
  await memberRow.getByRole('button',{name:'Revogar acesso'}).click();
  await memberRow.locator('.meta').filter({hasText:'Revogado'}).waitFor({state:'visible'});
  if(!memberRevoked)throw new Error('Admin revocation did not update the canonical member.');
  await memberPage.reload({waitUntil:'domcontentloaded'});
  await memberPage.getByRole('heading',{name:'Como você deseja começar?'}).waitFor({state:'visible'});
  if(await memberPage.getByRole('heading',{name:'Olá, João QA'}).count())throw new Error('Revoked member still rendered the operational PWA.');
  await adminPage.screenshot({path:path.join(outDir,'04-admin-revoked-member.png'),fullPage:true});

  const report={
    schemaVersion:1,status:'passed',generatedAt:new Date().toISOString(),
    inviteCodeReusedAcrossChannels:true,
    adminCreatedInvite:inviteCreated,
    webClaimUsedMemberEndpoint:memberRequests.some(item=>item.pathname==='/api/access/claim'),
    commercialActivationTouched,
    desktopInvitationPurpose:passwordCall?.accessPurpose||null,
    desktopCanonicalServerId:storageCall?.serverId||null,
    expectedServerId:serverId,
    googleAuthPreserved:afterGoogle.some(item=>item.name==='online.start'),
    canonicalRevocationCutsPwa:memberRevoked,
    screenshots:['01-admin-created-invite.png','02-member-pwa-claimed.png','03-member-desktop-canonical-server.png','04-admin-revoked-member.png'],
    adminRequests,memberRequests,desktopCalls:afterGoogle
  };
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');
  console.log(`COLLABORATOR_ONBOARDING_E2E=${path.join(outDir,'report.json')}`);
  await Promise.all([adminContext.close(),memberContext.close(),desktopContext.close()]);
}finally{
  if(browser)await browser.close().catch(()=>{});
  webServer.kill('SIGTERM');desktopServer.kill('SIGTERM');
  await new Promise(resolve=>setTimeout(resolve,300));
}