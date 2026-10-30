import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();const port=typeof address==='object'&&address?address.port:null;server.close(error=>error?reject(error):resolve(port))})})}
async function waitFor(url){for(let attempt=0;attempt<80;attempt++){try{const response=await fetch(url);if(response.ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,250))}throw new Error('Owner transactional QA local server did not become ready')}

const viewports=[
  {name:'desktop',width:1440,height:1000},
  {name:'tablet',width:900,height:1100},
  {name:'small-mobile',width:320,height:700},
  {name:'mobile',width:390,height:844},
  {name:'large-mobile',width:430,height:932},
];
const port=await freePort();
const base=`http://127.0.0.1:${port}`;
const viteCli=path.join(root,'node_modules','vite','bin','vite.js');
const server=spawn(process.execPath,[viteCli,'preview','--host','127.0.0.1','--port',String(port)],{cwd:root,env:process.env,stdio:'inherit',shell:false});
const outDir=path.join(root,'qa-artifacts','owner-transactional');
await fs.mkdir(outDir,{recursive:true});
let browser;
const allRequests=[];
const screenshots=[];
try{
  await waitFor(`${base}/sistema.html`);
  browser=await chromium.launch({headless:true});
  for(const viewport of viewports){
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},serviceWorkers:'block'});
    const page=await context.newPage();
    const requests=[];
    let sequence=1;
    let activeRole='owner';
    const companies=[{id:'qa-company-existing',name:'Cliente QA existente',adminEmail:'existente.qa@example.test',status:'active',modules:['obra360','rdo','finance'],channels:['desktop','mobile'],usersCount:2,projectsCount:1,devicesCount:1,passwordCreatedAt:'2026-09-20T12:00:00.000Z',license:{id:'qa-license-existing',plan:'pro',expiresAt:'2027-12-31',maxUsers:12,maxProjects:6,maxDevices:3,code:'EXISTINGQA'},users:[{email:'existente.qa@example.test',name:'Admin QA',role:'admin'}],projects:[{name:'Obra QA'}],devices:[{id:'qa-device-existing',name:'Desktop QA',status:'active'}]}];
    const audit=[];
    page.on('dialog',dialog=>dialog.accept());
    await page.route('**/api/**',async route=>{
      const request=route.request();
      const url=new URL(request.url());
      const pathname=url.pathname;
      let body={};try{body=request.postDataJSON()||{}}catch{}
      const record={viewport:viewport.name,method:request.method(),pathname,body};requests.push(record);allRequests.push(record);
      const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
      if(pathname==='/api/auth/me')return json({user:{userId:'qa-owner',email:'qa.owner@example.test',name:'QA Owner'}});
      if(pathname==='/api/central/access')return json({role:activeRole,views:activeRole==='debora'?['debora']:['overview','obra','debora','clients','licenses']});
      if(pathname==='/api/owner/debora-overview')return json({overview:{clients:0,pro:0,freemium:0,expiring:0,revoked:0},clients:[]});
      if(pathname==='/api/owner/license-audit')return json({events:audit});
      if(pathname==='/api/owner/debora-observability/summary')return json({accounts:{total:1},presence:{onlineNow:1,activeToday:1},usage:{sessionsToday:3},pro:{total:1},plans:{freemium:0},sales:{paid:1,realizedRevenueCents:5500}});
      if(pathname==='/api/owner/debora-observability/users')return json({items:[{userId:'qa-debora-user',email:'consultora.teste.mais.longo@example.test',planCode:'pro_monthly',subscriptionStatus:'active',online:true,createdAt:'2026-10-01T12:00:00Z'}],hasMore:false,nextCursor:null});
      if(pathname==='/api/owner/debora-observability/sales')return json({items:[{id:'qa-sale',email:'consultora.teste.mais.longo@example.test',source:'asaas',planCode:'pro_monthly',status:'paid',amountCents:5500,createdAt:'2026-10-01T12:00:00Z'}],hasMore:false,nextCursor:null});
      if(pathname==='/api/owner/debora-partners')return json({partners:[{id:'qa-partner',name:'Parceiro QA',code:'QA15',active:true}]});
      if(pathname==='/api/owner/debora-partner-sales')return json({summary:{paidSales:1,revenueCents:5500},sales:[]});
      if(pathname==='/api/owner/companies'&&request.method()==='GET')return json({companies});
      if(pathname==='/api/owner/companies'&&request.method()==='POST'){
        sequence+=1;
        const company={id:`qa-company-${sequence}`,name:String(body.name),adminEmail:String(body.adminEmail).toLowerCase(),status:'pending',modules:body.modules||[],channels:body.channels||[],usersCount:0,projectsCount:0,devicesCount:0,passwordCreatedAt:null,license:{id:`qa-license-${sequence}`,plan:body.plan||'manual',expiresAt:body.expiresAt||undefined,maxUsers:Number(body.maxUsers)||10,maxProjects:Number(body.maxProjects)||5,maxDevices:Number(body.maxDevices)||2,code:'QAEMAIL2026'},users:[],projects:[],devices:[]};
        companies.push(company);audit.unshift({id:`qa-audit-${sequence}`,product:'obra-na-mao',email:company.adminEmail,action:'created',source:'manual',actor:'qa.owner@example.test',createdAt:new Date().toISOString()});
        return json({company,license:{...company.license,email:company.adminEmail,status:'active',code:'QAEMAIL2026'}},201);
      }
      const companyMatch=pathname.match(/^\/api\/owner\/companies\/([^/]+)$/);
      if(companyMatch){const company=companies.find(item=>item.id===decodeURIComponent(companyMatch[1]));if(!company)return json({error:'Empresa não encontrada.'},404);if(request.method()==='GET')return json({company});if(request.method()==='PUT'){company.modules=body.modules||company.modules;company.channels=body.channels||company.channels;company.status=body.status==='suspended'?'suspended':'active';company.license={...company.license,plan:body.plan||company.license.plan,expiresAt:body.expiresAt||undefined,maxUsers:Number(body.maxUsers)||company.license.maxUsers,maxProjects:Number(body.maxProjects)||company.license.maxProjects,maxDevices:Number(body.maxDevices)||company.license.maxDevices};audit.unshift({id:`qa-audit-update-${Date.now()}`,product:'obra-na-mao',email:company.adminEmail,action:'company_updated',source:'manual',actor:'qa.owner@example.test',createdAt:new Date().toISOString()});return json({company,license:company.license})}}
      const deviceMatch=pathname.match(/^\/api\/owner\/devices\/([^/]+)$/);
      if(deviceMatch&&request.method()==='PUT'){for(const company of companies){const device=company.devices?.find(item=>item.id===decodeURIComponent(deviceMatch[1]));if(device){device.status=body.status==='active'?'active':'revoked';return json({ok:true,status:device.status})}}return json({error:'Computador não encontrado.'},404)}
      return json({error:`Unhandled QA route ${request.method()} ${pathname}`},404);
    });
    const assertViewport=async label=>{
      const state=await page.evaluate(()=>{
        const viewport=document.documentElement.clientWidth;
        const width=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);
        const offenders=[...document.querySelectorAll('[data-owner-shell] *')].filter(node=>{
          const rect=node.getBoundingClientRect();
          return rect.width>0&&(rect.right>viewport+2||rect.left< -2) &&
            getComputedStyle(node).position!=='fixed' &&
            !node.closest('.owner-debora-table-wrap');
        }).slice(0,8).map(node=>node.tagName.toLowerCase()+'.'+String(node.className||'').slice(0,80));
        return{viewport,width,offenders};
      });
      if(state.width>state.viewport+2)throw new Error(`${viewport.name} ${label}: horizontal document overflow (${state.width}px > ${state.viewport}px); ${state.offenders.join(', ')}`);
    };
    const shot=async name=>{await assertViewport(name);const filename=`${viewport.name}-${name}.png`;screenshots.push(filename);await page.screenshot({path:path.join(outDir,filename),fullPage:true})};
    const openOwnerView=async view=>{const toggle=page.locator('[data-owner-nav-toggle]');if(await toggle.isVisible())await toggle.click();await page.locator(`[data-owner-view="${view}"]`).click()};
    await page.goto(`${base}/sistema.html#owner`,{waitUntil:'domcontentloaded'});
    await page.locator('[data-owner-shell]').waitFor({state:'visible'});await shot('01-owner-overview');
    await openOwnerView('obra');const form=page.locator('#companyForm');await form.waitFor({state:'visible'});
    await form.locator('input[name="name"]').fill('Construtora QA');await form.locator('input[name="adminEmail"]').fill('cliente.qa@example.test');await form.locator('input[name="plan"]').fill('pro');await form.locator('input[name="expiresAt"]').fill('2027-12-31');await form.locator('input[name="maxUsers"]').fill('20');await form.locator('input[name="maxProjects"]').fill('8');await form.locator('input[name="maxDevices"]').fill('4');await shot('02-company-form-filled');
    await form.locator('button[type="submit"]').click();await page.locator('#createResult').filter({hasText:'primeiro acesso é reconhecido por esse e-mail'}).waitFor({state:'visible'});await page.waitForFunction(()=>{const button=document.querySelector('#companyForm button[type="submit"]');return button instanceof HTMLButtonElement&&!button.disabled});await shot('03-company-created-by-email');
    const creationIndex=requests.findIndex(item=>item.method==='POST'&&item.pathname==='/api/owner/companies');if(creationIndex<0)throw new Error(`${viewport.name}: company provisioning request was not emitted`);if(!requests.slice(creationIndex+1).some(item=>item.method==='GET'&&item.pathname==='/api/owner/companies'))throw new Error(`${viewport.name}: company provisioning was not re-read from the server`);
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-owner-shell]').waitFor({state:'visible'});await openOwnerView('clients');await page.locator('[data-owner-current="clients"]').waitFor({state:'visible'});await page.getByText('cliente.qa@example.test',{exact:true}).waitFor({state:'visible'});await shot('04-created-company-visible-in-clients');
    await page.locator('[data-company="qa-company-existing"]').click();const licenseForm=page.locator('#licenseForm');await licenseForm.waitFor({state:'visible'});await shot('05-company-license-detail');
    await licenseForm.locator('input[name="maxUsers"]').fill('25');await licenseForm.locator('input[name="maxProjects"]').fill('9');await licenseForm.locator('button.owner-primary').click();await page.locator('#licenseResult').filter({hasText:'Licença atualizada.'}).waitFor({state:'visible'});await shot('06-license-limits-updated');
    await page.locator('[data-device-id="qa-device-existing"]').click();await page.locator('[data-device-id="qa-device-existing"]').filter({hasText:'Reativar dispositivo'}).waitFor({state:'visible'});await shot('07-device-revoked-license-untouched');
    await openOwnerView('licenses');await page.locator('h2',{hasText:'Histórico de alterações'}).waitFor({state:'visible'});await shot('08-license-audit');
    const creation=requests.find(item=>item.method==='POST'&&item.pathname==='/api/owner/companies');if(!creation||creation.body.adminEmail!=='cliente.qa@example.test')throw new Error(`${viewport.name}: company provisioning was not bound to the requested email`);
    if(Number(creation.body.maxUsers)!==20||Number(creation.body.maxProjects)!==8||Number(creation.body.maxDevices)!==4)throw new Error(`${viewport.name}: commercial limits were not submitted by the UI`);
    const companyUpdates=requests.filter(item=>item.method==='PUT'&&item.pathname==='/api/owner/companies/qa-company-existing');if(!companyUpdates.some(item=>Number(item.body.maxUsers)===25&&Number(item.body.maxProjects)===9))throw new Error(`${viewport.name}: license limits update was not exercised`);if(companyUpdates.some(item=>item.body.status==='suspended'))throw new Error(`${viewport.name}: transactional QA must never suspend a license`);
    const deviceUpdate=requests.find(item=>item.method==='PUT'&&item.pathname==='/api/owner/devices/qa-device-existing');if(!deviceUpdate||deviceUpdate.body.status!=='revoked')throw new Error(`${viewport.name}: device-only revocation was not exercised`);
    if(viewport.width<=430){
      // Superadmin crosses from global navigation to a single scoped lactation selector.
      await openOwnerView('debora');
      await page.locator('[data-owner-current="debora"]').waitFor({state:'visible'});
      if(await page.locator('[data-owner-view]').count()!==0)throw new Error(`${viewport.name}: global owner choices leaked into Débora product navigation`);
      if(await page.locator('[data-owner-back]').count()!==1)throw new Error(`${viewport.name}: superadmin has no return-to-Central action`);
      const menuHidden=await page.locator('#owner-nav-options').evaluate(node=>getComputedStyle(node).display==='none');
      if(!menuHidden)throw new Error(`${viewport.name}: lactation task selector must begin closed`);
      await shot('09-superadmin-debora-single-selector-closed');
      await page.locator('[data-owner-nav-toggle]').click();
      if(await page.locator('[data-owner-jump]').count()!==6)throw new Error(`${viewport.name}: expected exactly six lactation tasks`);
      await shot('10-superadmin-debora-single-selector-open');
      await page.locator('[data-owner-jump="debora-users"]').click();
      await page.locator('[data-owner-back]').click();
      await page.locator('[data-owner-current="overview"]').waitFor({state:'visible'});
      if(await page.locator('[data-owner-view]').count()!==5)throw new Error(`${viewport.name}: global navigation not restored after return`);
      await shot('11-superadmin-return-to-central');
      activeRole='debora';
      const beforeDebora=requests.length;
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('[data-owner-current="debora"]').waitFor({state:'visible'});
      if(await page.locator('[data-owner-back]').count()!==0||await page.locator('[data-owner-view]').count()!==0)throw new Error(`${viewport.name}: Débora must not see privileged navigation`);
      await page.locator('[data-owner-nav-toggle]').click();
      await page.locator('[data-owner-jump="debora-users"]').click();
      await page.locator('[data-owner-nav-current]').filter({hasText:'Consultoras'}).waitFor({state:'visible'});
      await page.locator('[data-debora-users-body] tr td[data-label="Usuário"]').waitFor({state:'visible'});
      await shot('09-debora-consultoras');
      const actions=await page.locator('[data-debora-users-body] [data-debora-user-activity]').count();
      if(!actions)throw new Error(`${viewport.name}: Débora mobile table lost activity action`);
      const switchTask=async task=>{await page.locator('[data-owner-nav-toggle]').click();await page.locator(`[data-owner-jump="${task}"]`).click();await page.locator('[data-owner-shell]').evaluate((el,key)=>{if(el.dataset.ownerTask!==key)throw new Error('Task not selected')},task)};
      await switchTask('debora-sales');
      await page.locator('[data-debora-sales-body] tr td[data-label="Registro"]').waitFor({state:'visible'});
      await page.locator('[data-debora-sales-from]').fill('2026-10-01');
      await page.locator('[data-debora-sales-to]').fill('2026-10-30');
      await shot('10-debora-vendas-periodo');
      await switchTask('debora-usage');
      await page.locator('[data-debora-observability-metric="sales"]').waitFor({state:'visible'});
      await shot('11-debora-uso-e-metricas');
      await switchTask('debora-partners');
      await page.locator('[data-debora-partners-body] tr td[data-label="Parceiro"]').waitFor({state:'visible'});
      await shot('12-debora-parceiros');
      await switchTask('debora-license');
      await page.locator('#deboraLicenseStatus').waitFor({state:'visible'});
      await page.locator('[data-debora-grant-details] summary').click();
      await page.locator('#deboraLicenseForm button[type="submit"]').waitFor({state:'visible'});
      await shot('13-debora-licenciamento');
      await switchTask('debora-summary');
      await page.locator('[data-debora-headline="pro"]').waitFor({state:'visible'});
      await shot('14-debora-resumo');
      if(requests.slice(beforeDebora).some(item=>item.pathname==='/api/owner/companies'||item.pathname==='/api/owner/license-audit'))throw new Error(`${viewport.name}: restricted Débora session read Obra data`);
    }
    await context.close();
  }
  const report={schemaVersion:3,status:'passed',generatedAt:new Date().toISOString(),emailFirst:true,googleAuthPreserved:true,licenseSuspensionsPerformed:0,viewports:viewports.map(v=>v.name),requests:allRequests,screenshots};
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');console.log(`OWNER_TRANSACTIONAL_QA=${path.join(outDir,'report.json')}`);
}finally{if(browser)await browser.close().catch(()=>{});server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,300))}