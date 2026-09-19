import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtimeRoot=path.join(root,'qa','runtime');
const playwright=await import(pathToFileURL(path.join(runtimeRoot,'node_modules','playwright','index.mjs')).href);
const { runUiSweep }=await import(pathToFileURL(path.join(runtimeRoot,'src','ui-sweep.js')).href);
const { runApiSweep }=await import(pathToFileURL(path.join(runtimeRoot,'src','api-sweep.js')).href);

function freePort(){
  return new Promise((resolve,reject)=>{
    const server=net.createServer();
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      const address=server.address();
      const port=typeof address==='object'&&address?address.port:null;
      server.close(error=>error?reject(error):resolve(port));
    });
  });
}
async function waitFor(url){
  for(let attempt=0;attempt<80;attempt++){
    try{const response=await fetch(url);if(response.ok)return}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('Central P1 local server did not become ready');
}

const port=await freePort();
const localBase='http://127.0.0.1:'+port;
const productionBase=String(process.env.ARTISYS_CENTRAL_BASE_URL||'https://artisys.dev').replace(/\/$/,'');
const viteCli=path.join(root,'node_modules','vite','bin','vite.js');
const server=spawn(process.execPath,[viteCli,'--host','127.0.0.1','--port',String(port)],{
  cwd:root,env:process.env,stdio:'inherit',shell:false,
});
let browser=null;
try{
  await waitFor(localBase+'/sistema');
  browser=await playwright.chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();

  const ui=await runUiSweep({
    page,
    baseURL:localBase,
    startPaths:['/sistema','/sistema#owner','/sistema#portal','/sistema#login'],
    preserveHashRoutes:true,
    maxPages:40,
    failOnHttp5xx:true,
    failOnPageError:true,
    failOnRequestFailure:true,
  });

  const api=await runApiSweep({
    baseURL:productionBase,
    endpoints:[
      {name:'central-shell',path:'/sistema',expectedStatus:200},
      {name:'owner-overview-protected',path:'/api/owner/loja-online/overview',expectedStatus:[401,403],expectJson:true},
      {name:'owner-companies-protected',path:'/api/owner/loja-online/companies',expectedStatus:[401,403],expectJson:true},
      {name:'owner-audit-protected',path:'/api/owner/loja-online/license-audit',expectedStatus:[401,403],expectJson:true},
    ],
  });

  const report={
    schemaVersion:1,
    status:ui.status==='passed'&&api.status==='passed'?'passed':'failed',
    generatedAt:new Date().toISOString(),
    targets:{local:localBase,production:productionBase},
    ui,
    api,
  };
  const outDir=path.join(root,'qa-artifacts','p1-sweep');
  await fs.mkdir(outDir,{recursive:true});
  const outFile=path.join(outDir,'report.json');
  await fs.writeFile(outFile,JSON.stringify(report,null,2)+'\n','utf8');
  console.log('ARTISYS_QA_P1_SWEEP='+outFile);
  console.log(JSON.stringify({status:report.status,pages:ui.pages.length,apiPassed:api.passed,apiFailed:api.failed},null,2));
  if(report.status!=='passed')process.exitCode=1;
  await context.close();
}finally{
  if(browser)await browser.close().catch(()=>{});
  server.kill('SIGTERM');
  await new Promise(resolve=>setTimeout(resolve,300));
}
