/**
 * P2 QA of the built Web/PWA using real Chromium/WebKit browser engines.
 * Google Identity Services and API responses are synthetic fixtures.
 * Does NOT authenticate a real Google account, grant licenses or touch production D1.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'qa-artifacts','google-customer-auth-e2e');
await fs.mkdir(output,{recursive:true});
const profiles=[
  {name:'iphone-webkit',engine:'WebKit',browser:webkit,device:devices['iPhone 13']},
  {name:'android-chromium',engine:'Chromium',browser:chromium,device:devices['Pixel 7']},
  {name:'desktop-chromium',engine:'Chromium',browser:chromium,device:{viewport:{width:1440,height:900},deviceScaleFactor:1}}
];
const scenarios=['licensed-active','licensed-unclaimed','no-license','desktop-only','blocked','pending','forbidden','google-denied'];
const googleJs=[
  'window.__qaGoogleProviderStubbed=true;',
  'window.google={accounts:{id:{',
  ' initialize:function(opts){window.__qaGoogleCallback=opts.callback;},',
  ' prompt:function(cb){if(cb)cb({isNotDisplayed:function(){return true;},isSkippedMoment:function(){return false;}});},',
  ' renderButton:function(target){var b=document.createElement("button");b.id="qa-google-select";b.type="button";b.textContent="Conta Google de teste";b.onclick=function(){window.__qaGoogleCallback({credential:"synthetic-id-token-never-production"});};target.appendChild(b);}',
  '}}};'
].join('\n');
const fixtures={
  'licensed-active':()=>({
    needsClaim:false,authorized:true,isOwner:false,platformRole:'user',role:'admin',
    company:{id:'company-a',name:'Construtora A QA'},project:{id:'obra-a',name:'Obra A QA'},
    access:{channels:['mobile'],modules:['obra360','rdo','rh','documents','dre','contracts']},
    platformAccess:{status:'active',platformRole:'user',systems:{
      gestao:{enabled:true,role:'admin'},obra360:{enabled:true,role:'admin'},
      universidade:{enabled:false,role:'colaborador'},finance:{enabled:false,role:'consulta'}
    }}
  }),
  'licensed-unclaimed':()=>({
    needsClaim:true,authorized:true,isOwner:false,platformRole:'user',
    license:{licenseId:'lic-a',status:'active',modules:['obra360'],channels:['mobile']}
  }),
  'no-license':()=>({needsClaim:true,authorized:false,isOwner:false,platformRole:'user',license:null}),
  'desktop-only':()=>({
    needsClaim:true,authorized:false,isOwner:false,platformRole:'user',
    license:{licenseId:'lic-desktop',status:'active',modules:['obra360'],channels:['desktop']}
  }),
  'blocked':()=>({needsClaim:false,isOwner:false,platformRole:'user',platformAccess:{status:'blocked',systems:{}}}),
  'pending':()=>({needsClaim:false,isOwner:false,platformRole:'user',platformAccess:{status:'pending',systems:{}}})
};
async function freePort(){
  return new Promise((resolve,reject)=>{
    const server=net.createServer();
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      const addr=server.address(),port=typeof addr==='object'&&addr?addr.port:null;
      server.close(e=>e?reject(e):resolve(port));
    });
  });
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(url){
  for(let i=0;i<90;i++){
    try{const r=await fetch(url);if(r.ok)return}catch{}
    await sleep(200);
  }
  throw new Error('Preview did not start: '+url);
}
function overflow(width,content,scenario,profile){
  assert.ok(content<=width+2,profile+'/'+scenario+': horizontal overflow: '+content+' / '+width);
}
const checks=[],screenshots=[];
async function exercise(browser,profile,base,scenario){
  const context=await browser.newContext({...profile.device,locale:'pt-BR',reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const requests=[],state={authenticated:false,attempts:0,logouts:0};
  const shot=async suffix=>{const name=profile.name+'-'+suffix+'.png';await page.screenshot({path:path.join(output,name),fullPage:true});screenshots.push(name)};
  try{
    await page.route('https://accounts.google.com/gsi/client',r=>r.fulfill({status:200,contentType:'text/javascript',body:googleJs}));
    await page.route('**/api/**',async r=>{
      const request=r.request(),url=new URL(request.url()),p=url.pathname;
      requests.push(request.method()+' '+p);
      const result=(data,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'cache-control':'no-store'}});
      if(p==='/api/auth/me')return result(state.authenticated?{user:{userId:'canonical-client-1',email:'cliente.qa@example.test',name:'Cliente QA'}}:{error:'Sessão não encontrada.'},state.authenticated?200:401);
      if(p==='/api/auth/config')return result({googleClientId:'synthetic-client-id'});
      if(p==='/api/auth/google-credential'&&request.method()==='POST'){
        state.attempts++;
        assert.equal(request.postDataJSON().credential,'synthetic-id-token-never-production');
        if(scenario==='google-denied')return result({error:'Acesso bloqueado. Procure o administrador.'},403);
        state.authenticated=true;
        return result({ok:true,user:{userId:'canonical-client-1',email:'cliente.qa@example.test',name:'Cliente QA'}});
      }
      if(p==='/api/auth/logout'){state.logouts++;state.authenticated=false;return result({ok:true})}
      if(p==='/api/central/access')return result({error:'Acesso negado'},403);
      if(p==='/api/bootstrap'&&scenario==='forbidden')return result({error:'Sua conta não possui acesso Mobile/PWA.'},403);
      if(p==='/api/bootstrap'&&fixtures[scenario])return result(fixtures[scenario]());
      if(p==='/api/portal/overview')return result({updatedAt:'2026-11-22T13:00:00Z',metrics:[],attention:[]});
      return result({error:'Unsupported QA route '+p},404);
    });
    await page.goto(base+'/sistema.html#portal',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Acesse sua operação'}).waitFor({state:'visible'});
    assert.equal(await page.locator('#googleLogin').isVisible(),true);
    assert.equal(await page.locator('#phoneLogin').count(),0);
    const before=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));
    overflow(before.w,before.s,scenario,profile.name);
    if(scenario==='licensed-active')await shot('login');
    await page.locator('#googleLogin').click();
    await page.locator('#qa-google-select').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.__qaGoogleProviderStubbed),true);
    await page.locator('#qa-google-select').click();
    if(scenario==='google-denied'){
      await page.locator('#loginFeedback').waitFor({state:'visible'});
      assert.match(await page.locator('#loginFeedback').innerText(),/bloqueado/i);
      assert.equal(await page.locator('#googleLogin').isEnabled(),true);
      assert.equal(state.authenticated,false);
      await page.locator('#googleLogin').click();
      await page.locator('#qa-google-select').waitFor({state:'visible'});
      await page.getByRole('button',{name:'Cancelar'}).click();
      await page.locator('#loginFeedback').waitFor({state:'visible'});
      assert.match(await page.locator('#loginFeedback').innerText(),/cancelado/i);
      assert.equal(await page.locator('#googleLogin').isEnabled(),true);
      await shot('denied');
    }else{
      const expected={
        'licensed-active':'Visão geral','licensed-unclaimed':'Licença ativa',
        'no-license':'Nenhuma licença vinculada','desktop-only':'Acesso Web não liberado',
        'blocked':'Acesso bloqueado','pending':'Liberação pendente','forbidden':'Acesso não liberado'
      }[scenario];
      await page.getByRole('heading',{name:expected,exact:true}).waitFor({state:'visible'});
      assert.equal(state.authenticated,true);
      if(scenario==='licensed-active'){
        assert.equal(await page.locator('[data-resource="obra"]').isVisible(),true);
        assert.equal(await page.locator('[data-resource="gestao"]').isVisible(),true);
        assert.equal(await page.locator('[data-resource="acessos"]').count(),0);
        assert.equal(await page.locator('.cp-context span').innerText(),'Construtora A QA');
        await shot('licensed');
        await page.locator('#logoutBtn').click();
        await page.getByRole('heading',{name:'Acesse sua operação'}).waitFor({state:'visible'});
        assert.equal(state.authenticated,false);
        assert.equal(state.logouts,1);
      }else if(scenario==='licensed-unclaimed'){
        assert.equal(await page.locator('[data-resource="ativar"]').isVisible(),true);
        assert.equal(await page.locator('a[href*="#planos"]').count(),0);
      }else if(scenario==='no-license'){
        assert.equal(await page.locator('a[href*="#planos"]').isVisible(),true);
        assert.equal(await page.locator('[data-resource="ativar"]').count(),0);
      }else if(scenario==='desktop-only'){
        assert.equal(await page.locator('[data-resource="obra"]').count(),0);
        assert.equal(await page.locator('#logoutBtn').isVisible(),true);
      }else if(scenario==='blocked'){
        assert.equal(await page.locator('[data-resource="obra"]').count(),0);
        assert.equal(await page.locator('[data-resource="gestao"]').count(),0);
      }else if(scenario==='pending'){
        assert.equal(await page.locator('#platformCode').isVisible(),true);
        assert.equal(await page.locator('[data-resource="gestao"]').count(),0);
      }else if(scenario==='forbidden'){
        assert.match(await page.locator('main').innerText(),/não possui acesso Mobile\/PWA/i);
        assert.equal(await page.locator('#logoutBtn').isVisible(),true);
      }
    }
    const after=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));
    overflow(after.w,after.s,scenario,profile.name);
    assert.equal(requests.filter(x=>/\/api\/owner\/|\/api\/license\/claim|\/api\/bootstrap\/claim/.test(x)).length,0,'Login caused privileged/activation call');
    assert.equal(state.attempts,1,'Expected exactly one token exchange');
    checks.push({id:profile.name+'/'+scenario,status:'passed',engine:profile.engine});
  }catch(e){
    try{await shot(scenario+'-failed')}catch{}
    checks.push({id:profile.name+'/'+scenario,status:'failed',error:String(e?.stack||e)});
  }finally{await context.close()}
}
let server,opened=[];
try{
  const port=await freePort(),base='http://127.0.0.1:'+port;
  server=spawn(process.execPath,[path.join(root,'node_modules','vite','bin','vite.js'),'preview','--host','127.0.0.1','--strictPort','--port',String(port)],{cwd:root,stdio:'inherit',shell:false});
  await waitFor(base+'/sistema.html');
  let chrome,apple;
  for(const profile of profiles){
    const browser=profile.engine==='WebKit'?(apple ||= await webkit.launch({headless:true})):(chrome ||= await chromium.launch({headless:true}));
    if(!opened.includes(browser))opened.push(browser);
    for(const scenario of scenarios)await exercise(browser,profile,base,scenario);
  }
}finally{
  for(const browser of opened)try{await browser.close()}catch{}
  if(server)server.kill('SIGTERM');
}
const failures=checks.filter(x=>x.status!=='passed');
const report={
  schemaVersion:1,generatedAt:new Date().toISOString(),
  status:failures.length===0&&checks.length===profiles.length*scenarios.length?'passed':'failed',
  providerMocked:true,realExternalGoogleAccountVerified:false,
  browserProfilesAreEmulations:true,
  scope:'Vite production build with Chromium/WebKit, synthetic Google provider and API response fixtures',
  testedProfiles:profiles.map(({name,engine})=>({name,engine})),
  scenarios,checks,failures,screenshots
};
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log('GOOGLE_CUSTOMER_P2_REPORT='+path.join(output,'report.json'));
console.log(JSON.stringify({status:report.status,checked:checks.length,passed:checks.length-failures.length,failures:failures.map(x=>x.id)},null,2));
if(report.status!=='passed')process.exitCode=1;
