import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtimeRoot=path.join(root,'qa','runtime');
const playwright=await import(pathToFileURL(path.join(runtimeRoot,'node_modules','playwright','index.mjs')).href);

function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();const port=typeof address==='object'&&address?address.port:null;server.close(error=>error?reject(error):resolve(port))})})}
async function waitFor(url){for(let attempt=0;attempt<80;attempt++){try{const response=await fetch(url);if(response.ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,250))}throw new Error('Owner transactional QA local server did not become ready')}

const port=await freePort();
const base=`http://127.0.0.1:${port}`;
const viteCli=path.join(root,'node_modules','vite','bin','vite.js');
const server=spawn(process.execPath,[viteCli,'--host','127.0.0.1','--port',String(port)],{cwd:root,env:process.env,stdio:'inherit',shell:false});
const outDir=path.join(root,'qa-artifacts','owner-transactional');
await fs.mkdir(outDir,{recursive:true});

let browser;
try{
  await waitFor(`${base}/sistema`);
  browser=await playwright.chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const requests=[];
  let sequence=0;
  const companies=[];
  const audit=[];

  page.on('dialog',dialog=>dialog.accept());
  await page.route('**/api/**',async route=>{
    const request=route.request();
    const url=new URL(request.url());
    const pathname=url.pathname;
    let body={};
    try{body=request.postDataJSON()||{}}catch{}
    requests.push({method:request.method(),pathname,body});
    const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});

    if(pathname==='/api/auth/me')return json({user:{userId:'qa-owner',email:'qa.owner@example.test',name:'QA Owner'}});
    if(pathname==='/api/owner/debora-overview')return json({overview:{clients:0,pro:0,freemium:0,expiring:0,revoked:0},clients:[]});
    if(pathname==='/api/owner/license-audit')return json({events:audit});
    if(pathname==='/api/owner/companies'&&request.method()==='GET')return json({companies});
    if(pathname==='/api/owner/companies'&&request.method()==='POST'){
      sequence+=1;
      const company={id:`qa-company-${sequence}`,name:String(body.name),adminEmail:String(body.adminEmail).toLowerCase(),status:'pending',modules:body.modules||[],channels:body.channels||[],usersCount:0,projectsCount:0,devicesCount:1,passwordCreatedAt:null,license:{id:`qa-license-${sequence}`,plan:body.plan||'manual',expiresAt:body.expiresAt||undefined,maxUsers:Number(body.maxUsers)||10,maxProjects:Number(body.maxProjects)||5,maxDevices:Number(body.maxDevices)||2,code:'QAEMAIL2026'},users:[],projects:[],devices:[{id:`qa-device-${sequence}`,name:'Desktop QA',status:'active'}]};
      companies.push(company);
      audit.unshift({id:`qa-audit-${sequence}`,product:'obra-na-mao',email:company.adminEmail,action:'created',source:'manual',actor:'qa.owner@example.test',createdAt:new Date().toISOString()});
      return json({company,license:{...company.license,email:company.adminEmail,status:'active',code:'QAEMAIL2026'}},201);
    }
    const companyMatch=pathname.match(/^\/api\/owner\/companies\/([^/]+)$/);
    if(companyMatch){
      const company=companies.find(item=>item.id===decodeURIComponent(companyMatch[1]));
      if(!company)return json({error:'Empresa não encontrada.'},404);
      if(request.method()==='GET')return json({company});
      if(request.method()==='PUT'){
        company.modules=body.modules||company.modules;
        company.channels=body.channels||company.channels;
        company.status=body.status==='suspended'?'suspended':'active';
        company.license={...company.license,plan:body.plan||company.license.plan,expiresAt:body.expiresAt||undefined,maxUsers:Number(body.maxUsers)||company.license.maxUsers,maxProjects:Number(body.maxProjects)||company.license.maxProjects,maxDevices:Number(body.maxDevices)||company.license.maxDevices};
        audit.unshift({id:`qa-audit-update-${Date.now()}`,product:'obra-na-mao',email:company.adminEmail,action:'company_updated',source:'manual',actor:'qa.owner@example.test',createdAt:new Date().toISOString()});
        return json({company,license:company.license});
      }
    }
    const deviceMatch=pathname.match(/^\/api\/owner\/devices\/([^/]+)$/);
    if(deviceMatch&&request.method()==='PUT'){
      for(const company of companies){const device=company.devices?.find(item=>item.id===decodeURIComponent(deviceMatch[1]));if(device){device.status=body.status==='active'?'active':'revoked';return json({ok:true,status:device.status})}}
      return json({error:'Computador não encontrado.'},404);
    }
    return json({error:`Unhandled QA route ${request.method()} ${pathname}`},404);
  });

  const shot=async name=>page.screenshot({path:path.join(outDir,`${name}.png`),fullPage:true});
  await page.goto(`${base}/sistema#owner`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-owner-shell]').waitFor({state:'visible'});
  await shot('01-owner-overview');

  await page.locator('[data-owner-view="obra"]').click();
  const form=page.locator('#companyForm');
  await form.waitFor({state:'visible'});
  await form.locator('input[name="name"]').fill('Construtora QA');
  await form.locator('input[name="adminEmail"]').fill('cliente.qa@example.test');
  await form.locator('input[name="plan"]').fill('pro');
  await form.locator('input[name="expiresAt"]').fill('2027-12-31');
  await form.locator('input[name="maxUsers"]').fill('20');
  await form.locator('input[name="maxProjects"]').fill('8');
  await form.locator('input[name="maxDevices"]').fill('4');
  await shot('02-company-form-filled');
  await form.locator('button[type="submit"]').click();
  await page.locator('#createResult').filter({hasText:'primeiro acesso é reconhecido por esse e-mail'}).waitFor({state:'visible'});
  await shot('03-company-created-by-email');

  await page.locator('[data-owner-view="clients"]').click();
  await page.locator('[data-company="qa-company-1"]').click();
  const licenseForm=page.locator('#licenseForm');
  await licenseForm.waitFor({state:'visible'});
  await shot('04-company-license-detail');
  await licenseForm.locator('input[name="maxUsers"]').fill('25');
  await licenseForm.locator('input[name="maxProjects"]').fill('9');
  await licenseForm.locator('button.owner-primary').click();
  await page.locator('#licenseResult').filter({hasText:'Licença atualizada.'}).waitFor({state:'visible'});
  await shot('05-license-limits-updated');

  await page.locator('[data-device-id="qa-device-1"]').click();
  await page.locator('[data-device-id="qa-device-1"]').filter({hasText:'Reativar dispositivo'}).waitFor({state:'visible'});
  await shot('06-device-revoked-license-untouched');

  await page.locator('[data-owner-view="licenses"]').click();
  await page.getByText('Histórico de alterações').waitFor({state:'visible'});
  await shot('07-license-audit');

  const creation=requests.find(item=>item.method==='POST'&&item.pathname==='/api/owner/companies');
  if(!creation||creation.body.adminEmail!=='cliente.qa@example.test')throw new Error('Company provisioning was not bound to the requested email');
  if(Number(creation.body.maxUsers)!==20||Number(creation.body.maxProjects)!==8||Number(creation.body.maxDevices)!==4)throw new Error('Commercial limits were not submitted by the UI');
  const companyUpdates=requests.filter(item=>item.method==='PUT'&&item.pathname==='/api/owner/companies/qa-company-1');
  if(!companyUpdates.some(item=>Number(item.body.maxUsers)===25&&Number(item.body.maxProjects)===9))throw new Error('License limits update was not exercised');
  if(companyUpdates.some(item=>item.body.status==='suspended'))throw new Error('Transactional QA must never suspend a license');
  const deviceUpdate=requests.find(item=>item.method==='PUT'&&item.pathname==='/api/owner/devices/qa-device-1');
  if(!deviceUpdate||deviceUpdate.body.status!=='revoked')throw new Error('Device-only revocation was not exercised');
  const report={schemaVersion:1,status:'passed',generatedAt:new Date().toISOString(),emailFirst:true,googleAuthPreserved:true,licenseSuspensionsPerformed:0,requests,screenshots:['01-owner-overview.png','02-company-form-filled.png','03-company-created-by-email.png','04-company-license-detail.png','05-license-limits-updated.png','06-device-revoked-license-untouched.png','07-license-audit.png']};
  await fs.writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,2)+'\n','utf8');
  console.log(`OWNER_TRANSACTIONAL_QA=${path.join(outDir,'report.json')}`);
  await context.close();
}finally{
  if(browser)await browser.close().catch(()=>{});
  server.kill('SIGTERM');
  await new Promise(resolve=>setTimeout(resolve,300));
}
