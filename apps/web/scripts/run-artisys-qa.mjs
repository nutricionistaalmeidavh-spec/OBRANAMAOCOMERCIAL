import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const profile=String(process.argv[2]||'quick').toLowerCase();
if(!['quick','full','release'].includes(profile))throw new Error(`Unknown QA profile: ${profile}`);
const runtimeCli=path.join(root,'qa','runtime','artisys-qa.mjs');
if(!fs.existsSync(runtimeCli))throw new Error('ArtiSys QA runtime not prepared. Run npm run qa:prepare first.');

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
async function waitForServer(url){
  for(let attempt=0;attempt<80;attempt++){
    try{const response=await fetch(url);if(response.ok)return}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`Central QA local não respondeu em ${url}`);
}

const requestedEnvironment=process.env.ARTISYS_QA_ENVIRONMENT||'local';
let server=null;
let tempConfig=null;
let environment=requestedEnvironment;
let configPath=path.join(root,'qa','artisys-qa.config.json');

try{
  if(requestedEnvironment==='local'){
    const port=await freePort();
    const base=`http://127.0.0.1:${port}`;
    const viteCli=path.join(root,'node_modules','vite','bin','vite.js');
    if(!fs.existsSync(viteCli))throw new Error('Vite não instalado. Rode npm install em apps/web.');
    server=spawn(process.execPath,[viteCli,'--host','127.0.0.1','--port',String(port)],{cwd:root,env:process.env,stdio:'inherit',shell:false});
    await waitForServer(`${base}/sistema`);
    const manifest=JSON.parse(fs.readFileSync(configPath,'utf8'));
    manifest.environments.local={baseURL:`${base}/sistema#owner`};
    tempConfig=path.join(root,'qa',`.runtime-config-${process.pid}.json`);
    fs.writeFileSync(tempConfig,`${JSON.stringify(manifest,null,2)}\n`,'utf8');
    configPath=tempConfig;
    environment='local';
  }

  const args=[runtimeCli,profile,'--config',configPath,'--environment',environment,'--viewport',process.env.ARTISYS_QA_VIEWPORT||'desktop','--output',path.join(root,'qa-artifacts')];
  const result=spawnSync(process.execPath,args,{cwd:root,env:process.env,stdio:'inherit',shell:false});
  if(result.error)console.error(result.error);
  process.exitCode=Number.isInteger(result.status)?result.status:1;
}finally{
  if(server){server.kill('SIGTERM');await new Promise(resolve=>setTimeout(resolve,300))}
  if(tempConfig)fs.rmSync(tempConfig,{force:true});
}
