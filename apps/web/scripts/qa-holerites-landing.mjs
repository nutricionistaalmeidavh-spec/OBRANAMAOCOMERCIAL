// Capturas e assertions da landing em navegador real, sem serviços pagos.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const port=4317;
const origin='http://127.0.0.1:'+port+'/gest%C3%A3oholerites/';
const directory=new URL('../qa-artifacts/holerites-landing/',import.meta.url);
await mkdir(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
server.stdout.on('data',b=>process.stdout.write('[preview] '+b));
server.stderr.on('data',b=>process.stderr.write('[preview] '+b));
let browser;
let failure;
const report=[];
try{
 let ready=false;
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)throw Error('Vite preview encerrou.');
  try {const r=await fetch(origin);if(r.ok){ready=true;break}}catch{}
  await sleep(200);
 }
 if(!ready)throw Error('Vite preview não respondeu.');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const [label,size] of Object.entries({desktop:{width:1440,height:960},mobile:{width:390,height:844}})){
  const page=await browser.newPage({viewport:size,deviceScaleFactor:1,reducedMotion:label==='mobile'?'reduce':'no-preference'});
  const exceptions=[];
  page.on('pageerror',e=>exceptions.push(e.message));
  const response=await page.goto(origin,{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200,label+' landing status');
  await page.locator('.laptop-screen img').waitFor();
  await page.waitForFunction(()=>document.documentElement.classList.contains('holerites-embla-ready'),null,{timeout:12000});
  assert.equal(await page.getByRole('heading',{level:1}).count(),1);
  const images=page.locator('main img');
  for(let i=0;i<await images.count();i++){
   await images.nth(i).scrollIntoViewIfNeeded();
   await images.nth(i).evaluate(el=>new Promise((resolve,reject)=>{
    if(el.complete){if(el.naturalWidth>0)resolve(true);else reject(new Error('Imagem inválida: '+el.src));return}
    el.addEventListener('load',()=>resolve(true),{once:true});
    el.addEventListener('error',()=>reject(new Error('Imagem não carregou: '+el.src)),{once:true});
   }));
  }
  const inspected=await page.locator('main img').evaluateAll(nodes=>nodes.map(img=>{
    const el=img;
    const style=getComputedStyle(el);
    return {name:el.getAttribute('src')?.split('/').pop(),natural:[el.naturalWidth,el.naturalHeight],attrs:[Number(el.getAttribute('width')),Number(el.getAttribute('height'))],fit:style.objectFit};
  }));
  for(const image of inspected){
   assert.ok(image.natural[0]>0 && image.natural[1]>0,'Imagem inválida: '+image.name);
   assert.deepEqual(image.attrs,image.natural,'Dimensões intrínsecas divergentes: '+image.name);
   assert.equal(image.fit,'contain','Screenshot deve ser preservado: '+image.name);
  }
  const width=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(width.scroll<=width.client+3,label+' overflow horizontal: '+JSON.stringify(width));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:new URL(label+'-full.png',directory).pathname,fullPage:true,animations:'disabled'});
  await page.locator('#telas').scrollIntoViewIfNeeded();
  const next=page.getByRole('button',{name:'Próxima imagem'});
  assert.equal(await next.isDisabled(),false,'Embla deve permitir avanço.');
  const transformBefore=await page.locator('.screen-container').evaluate(e=>getComputedStyle(e).transform);
  await next.click();
  await page.waitForTimeout(700);
  const transformAfter=await page.locator('.screen-container').evaluate(e=>getComputedStyle(e).transform);
  assert.notEqual(transformBefore,transformAfter,'Embla avançou');
  assert.deepEqual(exceptions,[],label+' sem erros JS');
  report.push({viewport:label,imagesVerified:inspected.length,overflow:false,embla:true,consoleErrors:exceptions});
  await page.close();
 }
 await writeFile(new URL('report.json',directory),JSON.stringify({status:'passed',report},null,2));
 console.log('Holerites QA aprovado:',JSON.stringify(report));
}catch(error){
 failure=error;
 await writeFile(new URL('report.json',directory),JSON.stringify({status:'failed',error:String(error?.stack||error),report},null,2));
 console.error('Holerites QA falhou:',error);
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
if(failure)process.exitCode=1;
