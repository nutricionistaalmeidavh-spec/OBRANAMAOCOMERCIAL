import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium, webkit} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'qa-artifacts','p0-navigation-performance');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=await new Promise((resolve,reject)=>{
  const socket=net.createServer();
  socket.once('error',reject);
  socket.listen(0,'127.0.0.1',()=>{
    const value=socket.address().port;
    socket.close(error=>error?reject(error):resolve(value));
  });
});
const origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'node_modules','vite','bin','vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'inherit'});
const results=[];
const browsers=[];
const now=()=>Number(process.hrtime.bigint())/1e6;
const viewport={width:390,height:844};
const services=['corte','fixacao','chumbamento','afaq','esgoto','dreno'];
const day=new Date().toISOString().slice(0,10);
const project=()=>({
  version:7,project:{name:'Obra QA P0',customer:'Teste de regressão',startFloor:0,targetFloor:1},
  settings:{defaultWorkStart:'07:30',marginalEfficiency:.7,averageWeeklyAbsences:0,unassignedCompensationDays:0},
  employees:[{id:'e1',name:'Colaboradora QA',frontKey:'afaq:0',compensationDays:0}],
  floors:[0,1].map(number=>({number,stages:services.map(service=>({service,label:service,status:'not_started',targetDate:null,checklist:[]}))})),
  days:{[day]:{date:day,presentCount:1,absentCount:0,attendance:{e1:'present'},assignments:[],events:[],note:'',plans:[],sessions:[],rdoStatus:'draft',rdoDraft:null}},
  checklistTemplates:Object.fromEntries(services.map(service=>[service,[]])),
  issues:[],history:[],desktopBridge:{fronts:[],tasks:[],rdos:[],schedule:[]}
});
const access={modules:['obra360','rdo','rh','dre','contracts','documents','measurements'],channels:['desktop','mobile'],status:'active'};
const bootstrap={
  needsClaim:false,role:'admin',isOwner:false,projectInitialized:true,
  company:{id:'c1',name:'Empresa QA'},project:{id:'p1',name:'Obra QA P0'},
  membership:{companyId:'c1',projectId:'p1',email:'qa@example.test',role:'admin'},
  access,platformAccess:{status:'active',systems:{gestao:{enabled:true,role:'admin'},obra360:{enabled:true,role:'admin'},universidade:{enabled:true,role:'colaborador'}}}
};
const desktopSummary={generatedAt:new Date().toISOString(),scope:{period:'Histórico da obra'},modules:{
  dre:{revenue:1000000,expense:500000,result:500000},documents:{expiring30d:2},rdo:{total:1,pending:1,finalized:0}
}};
function median(values){const sorted=[...values].sort((a,b)=>a-b);return Math.round(sorted[Math.floor(sorted.length/2)]);}
function ensureUnder(actual,max,label){assert.ok(actual<max,`${label}: ${Math.round(actual)} ms >= ${max} ms`);}
function record(name,engine,elapsed,extra={}){results.push({name,engine,ms:Math.round(elapsed),...extra});console.log(`P0_BROWSER_METRIC ${name} ${engine}: ${Math.round(elapsed)} ms`);}
async function setup(engine,authenticated=false,slowAuxiliary=false){
  const context=await engine.newContext({viewport,deviceScaleFactor:3,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();
  const tracker={authenticated,requests:[],badPages:[],errors:[]};
  page.on('pageerror',error=>tracker.errors.push(error.message));
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())tracker.badPages.push(new URL(frame.url()).pathname);});
  if(authenticated)await context.addCookies([{name:'obn_auth',value:'1',domain:'127.0.0.1',path:'/'}]);
  await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({status:200,contentType:'text/javascript',body:`
    window.google={accounts:{id:{
      initialize(o){window.__qaDeliverGoogleCredential=(v)=>o.callback({credential:v})},
      prompt(){},renderButton(element){element.textContent='Google QA'}
    }}};
  `}));
  await page.route('**/api/**',async route=>{
    const pathName=new URL(route.request().url()).pathname;
    tracker.requests.push(pathName);
    const isAuxiliary=['/api/field/rdo/receipts','/api/field/rdo/catalog','/api/mobile/summary','/api/mobile/sync/conflicts','/api/portal/overview'].includes(pathName);
    await sleep(slowAuxiliary&&isAuxiliary?3800:180);
    const json=(body,status=200,headers={})=>route.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(body)}).catch(()=>{});
    if(pathName==='/api/auth/me')return tracker.authenticated?json({user:{userId:'qa',email:'qa@example.test',name:'Pessoa QA'}}):json({error:'Não autenticado'},401);
    if(pathName==='/api/central/access')return json({role:'regular'});
    if(pathName==='/api/bootstrap')return json(bootstrap);
    if(pathName==='/api/auth/config')return json({googleClientId:'qa-client.apps.googleusercontent.com'});
    if(pathName==='/api/auth/google-credential'){
      tracker.authenticated=true;
      return json({ok:true},200,{'set-cookie':'obn_auth=1; Path=/; SameSite=Lax'});
    }
    if(pathName==='/api/edu/login')return json({token:'test-password-token',participant:{id:'p1',name:'Colaborador QA',jobRole:'Encarregado'}});
    if(pathName==='/api/edu/me')return json({participant:{id:'p1',name:'Colaborador QA',jobRole:'Encarregado'}});
    if(pathName==='/api/phone/bootstrap')return json({company:{name:'Empresa QA'},access:{modules:['obra360']}});
    if(pathName==='/api/project')return json({state:project()});
    if(pathName==='/api/field/rdo/receipts')return json({receipts:{}});
    if(pathName==='/api/field/rdo/catalog')return json({catalog:{materials:[],fronts:[],services:[]}});
    if(pathName==='/api/mobile/summary')return json({summary:desktopSummary});
    if(pathName==='/api/mobile/sync/conflicts')return json({conflicts:[]});
    if(pathName==='/api/portal/overview')return json({updatedAt:new Date().toISOString(),metrics:[],attention:[]});
    if(pathName==='/api/project/state')return json({ok:true});
    return json({error:`Unhandled P0 QA request ${pathName}`},404);
  });
  return {page,context,tracker};
}
async function screenshots(page,name){await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});}
async function assertNoMarketing(tracker){assert.ok(!tracker.badPages.some(value=>value==='/'||value==='/index.html'),`Unexpected landing page navigation: ${tracker.badPages.join(', ')}`);}
async function testGoogle(engine,name){
  const {page,context,tracker}=await setup(engine);
  try{
    await page.goto(origin+'/sistema.html#portal',{waitUntil:'domcontentloaded'});
    await page.locator('#googleLogin').waitFor({timeout:12000});
    assert.equal(await page.locator('.cp-startup').count(),0);
    const start=now();
    await page.locator('#googleLogin').click();
    await page.waitForFunction(()=>typeof window.__qaDeliverGoogleCredential==='function');
    await page.evaluate(()=>window.__qaDeliverGoogleCredential('qa-test-credential'));
    await page.locator('.cp-dashboard h1').waitFor({timeout:12000});
    const elapsed=now()-start;
    ensureUnder(elapsed,6500,'Google-login-to-usable-panel');
    assert.equal(tracker.requests.filter(v=>v==='/api/bootstrap').length,1);
    await assertNoMarketing(tracker);
    assert.ok(!tracker.errors.length,`Google console: ${tracker.errors.join('; ')}`);
    record('google-credential-to-panel',name,elapsed,{mockedAuthentication:true});
    await screenshots(page,name+'-google-login-panel');
  }finally{await context.close();}
}
async function testPassword(engine,name){
  const {page,context,tracker}=await setup(engine);
  try{
    await page.goto(origin+'/sistema.html#colaborador',{waitUntil:'domcontentloaded'});
    await page.locator('#phoneLogin').waitFor({timeout:12000});
    await page.locator('#phoneIdentity').fill('16999990000');
    await page.locator('#phonePassword').fill('senha-de-teste');
    const start=now();
    await page.locator('#phoneSubmit').click();
    await page.locator('.cp-dashboard h1').waitFor({timeout:12000});
    const elapsed=now()-start;
    ensureUnder(elapsed,4500,'Password-login-to-usable-panel');
    assert.ok(await page.locator('[data-resource="obra"]').isVisible());
    assert.ok(!tracker.errors.length,`Password console: ${tracker.errors.join('; ')}`);
    record('collaborator-password-to-panel',name,elapsed,{mockedAuthentication:true});
    await screenshots(page,name+'-collaborator-login-panel');
  }finally{await context.close();}
}
async function testNavigation(engine,name){
  const {page,context,tracker}=await setup(engine,true,true);
  try{
    const start=now();
    await page.goto(origin+'/sistema.html#portal',{waitUntil:'domcontentloaded'});
    await page.locator('.cp-dashboard h1').waitFor({timeout:14000});
    const portalMs=now()-start;
    ensureUnder(portalMs,4500,'Corporate portal load');
    record('existing-session-to-panel',name,portalMs,{mockedAuthentication:true});
    await page.locator('.cp-overview-skeleton').waitFor({state:'visible',timeout:2500});
    assert.ok(await page.locator('[data-resource="obra"]').isVisible(),'Module navigation must remain usable while overview loads');
    const obraStart=now();
    await page.locator('[data-resource="obra"]').click();
    await page.locator('#reviewRdo').waitFor({state:'visible',timeout:14000});
    const obraMs=now()-obraStart;
    ensureUnder(obraMs,3500,'Obra with auxiliary endpoints delayed 3800ms');
    assert.ok(await page.locator('.nav button[data-screen="today"]').isVisible());
    assert.equal(await page.locator('.field-startup').count(),0);
    assert.ok(!tracker.badPages.some(v=>v==='/index.html'));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=2,`Horizontal overflow in ${name}: ${overflow}px`);
    record('portal-to-obra-with-slow-auxiliary',name,obraMs,{auxiliaryDelayMs:3800,horizontalOverflowPx:overflow});
    const navGeometry=await page.evaluate(()=>{const bar=document.querySelector('nav.nav'),button=bar?.querySelector('button');if(!bar||!button)return null;const b=bar.getBoundingClientRect();return {bottom:Math.round(window.innerHeight-b.bottom),minHeight:Math.round(button.getBoundingClientRect().height),fontSize:parseFloat(getComputedStyle(button).fontSize)}});
    assert.ok(navGeometry&&navGeometry.bottom<=2&&navGeometry.minHeight>=44&&navGeometry.fontSize>=12,`Mobile navigation not readable or flush to viewport: ${JSON.stringify(navGeometry)}`);
    await page.locator('.nav button[data-screen="obra360"]').click();
    const settingsAction=page.locator('.quick-action[data-screen="settings"]');
    await settingsAction.waitFor({state:'visible',timeout:5000});
    assert.ok((await settingsAction.textContent()).includes('Configurações'),'Obra360 shortcut label does not match its destination');
    await settingsAction.click();
    await page.locator('#defaultStart').waitFor({state:'visible',timeout:5000});
    assert.equal(await page.locator('#content').evaluate(element=>getComputedStyle(element).visibility),'visible','Premium screen remained hidden after route change');
    await page.locator('.nav button[data-screen="today"]').click();
    await page.locator('#reviewRdo').waitFor({state:'visible',timeout:5000});
    assert.equal(await page.locator('#content').evaluate(element=>getComputedStyle(element).visibility),'visible','Dias remained hidden after route change');
    await page.locator('#reviewRdo').scrollIntoViewIfNeeded();
    await page.locator('#reviewRdo').click({timeout:4000});
    await page.locator('#prepareRdo').waitFor({state:'visible',timeout:4000});
    await page.locator('#sheet .close').first().click();
    await screenshots(page,name+'-obra-mobile-rdo');
    await page.locator('.hero-back').first().click();
    await page.locator('.cp-dashboard h1').waitFor({timeout:13000});
    assert.ok(page.url().includes('/sistema.html#portal'));
    const gestaoStart=now();
    await page.locator('[data-resource="gestao"]').click();
    await page.locator('.management-hero').waitFor({state:'visible',timeout:14000});
    const gestaoMs=now()-gestaoStart;
    ensureUnder(gestaoMs,3500,'Management shell while summary API is delayed 3800ms');
    assert.equal(await page.locator('#content').getAttribute('aria-busy'),'true','Expected reserved KPI skeleton during slow summary');
    assert.equal(await page.locator('.management-kpi').count(),3);
    const readKpiPosition=()=>page.locator('.management-kpis').evaluate(element=>element.getBoundingClientRect().top+window.scrollY);
    const beforeKpi=await readKpiPosition();
    await page.waitForFunction(()=>document.querySelector('#content')?.getAttribute('aria-busy')==='false',null,{timeout:10000});
    const afterKpi=await readKpiPosition();
    const shift=Math.abs(beforeKpi-afterKpi);
    assert.ok(shift<3,`${name}: KPI document position moved ${Math.round(shift)}px (before=${Math.round(beforeKpi)}, after=${Math.round(afterKpi)})`);
    record('portal-to-gestao',name,gestaoMs,{summaryDelayMs:3800,kpiShiftPx:Math.round(shift)});
    await screenshots(page,name+'-gestao-loaded');
    await page.locator('.management-hero .hero-back').click();
    await page.locator('.cp-dashboard h1').waitFor({timeout:12000});
    await assertNoMarketing(tracker);
    assert.ok(!tracker.errors.length,`Navigation browser exceptions: ${tracker.errors.join('; ')}`);
    await screenshots(page,name+'-back-to-portal');
  }finally{await context.close();}
}
await fs.mkdir(out,{recursive:true});
try{
  let alive=false;
  for(let attempt=0;attempt<100;attempt++){
    try{const res=await fetch(origin+'/sistema.html');if(res.ok){alive=true;break;}}catch{}
    await sleep(200);
  }
  assert.ok(alive,'Vite preview did not become ready. Run npm run build first.');
  const chrome=await chromium.launch({headless:true});browsers.push(chrome);
  const safari=await webkit.launch({headless:true});browsers.push(safari);
  await testGoogle(chrome,'chromium-mobile');
  await testPassword(chrome,'chromium-mobile');
  await testNavigation(chrome,'chromium-mobile');
  await testNavigation(safari,'webkit-ios-emulation');
  const summary={
    schemaVersion:1,status:'passed',generatedAt:new Date().toISOString(),
    environment:'local Vite production preview; mocked network and authentication; no real Google provider',
    viewport,metrics:results,
    medianMsByScenario:Object.fromEntries([...new Set(results.map(x=>x.name))].map(name=>[name,median(results.filter(x=>x.name===name).map(x=>x.ms))])),
    observations:'This is a controlled browser regression test, not a measurement of actual production login on an iPhone.'
  };
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(summary,null,2)+'\n','utf8');
  console.log('P0_BROWSER_QA='+path.join(out,'report.json'));
  console.log('P0_BROWSER_SUMMARY='+JSON.stringify(summary));
}catch(error){
  await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({status:'failed',message:String(error),metrics:results},null,2)+'\n','utf8');
  console.error('P0_BROWSER_QA_FAILED',error);
  process.exitCode=1;
}finally{
  for(const browser of browsers)await browser.close().catch(()=>{});
  server.kill('SIGTERM');
}
