import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveCommandInvocation } from './qa-command.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtimeRoot=path.join(root,'qa','runtime');
const { buildProductQaSummary, writeProductQaBundle }=await import(pathToFileURL(path.join(runtimeRoot,'src','product-report.js')).href);
const npmCommand=process.platform==='win32'?'npm.cmd':'npm';
const p2StartedAt=Date.now();

function tail(value,max=6000){
  const text=String(value||'').trim();
  return text.length>max?text.slice(text.length-max):text;
}

function run(name,command,args,{env=process.env}={}){
  const started=Date.now();
  const resolved=resolveCommandInvocation(command,args,process.platform,env);
  const result=spawnSync(resolved.command,resolved.args,{
    cwd:root,
    env,
    encoding:'utf8',
    shell:resolved.shell,
    windowsHide:true,
    maxBuffer:16*1024*1024,
  });
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.stderr)process.stderr.write(result.stderr);
  const output=[result.stderr,result.stdout].filter(Boolean).join('\n');
  return {
    name,
    category:name.startsWith('native:')?'native':name.startsWith('cross:')?'cross-system':'p1',
    status:result.status===0?'passed':'failed',
    critical:true,
    durationMs:Date.now()-started,
    error:result.error?.message||(result.status===0?null:(tail(output)||'exit '+String(result.status))),
  };
}
async function readJson(file,fallback=null){
  try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}
}

async function collectEvidence(dir,sinceMs,limit=1000){
  const out=[];
  async function walk(current){
    if(out.length>=limit)return;
    let entries=[];
    try{entries=await fs.readdir(current,{withFileTypes:true})}catch{return}
    for(const entry of entries){
      if(out.length>=limit)break;
      const full=path.join(current,entry.name);
      if(entry.isDirectory()){await walk(full);continue}
      if(!entry.isFile())continue;
      let stat;try{stat=await fs.stat(full)}catch{continue}
      if(stat.mtimeMs<sinceMs)continue;
      const lower=entry.name.toLowerCase();
      let type='artifact';
      if(/\.(png|jpg|jpeg|webp)$/.test(lower))type='screenshot';
      else if(/\.(webm|mp4)$/.test(lower))type='video';
      else if(lower==='trace.zip')type='trace';
      else if(lower==='telemetry.json')type='telemetry';
      else if(lower.endsWith('.json'))type='json';
      out.push({type,path:path.relative(root,full).split(path.sep).join('/'),size:stat.size,modifiedAt:new Date(stat.mtimeMs).toISOString()});
    }
  }
  await walk(dir);
  return out;
}

const checks=[];
checks.push(run('native:test',npmCommand,['test']));
checks.push(run('native:build',npmCommand,['run','build']));
checks.push(run('native:ux-verify',npmCommand,['run','ux:verify']));
checks.push(run('p1:security',npmCommand,['run','qa:p1:security']));
checks.push(run('p1:sweep',process.execPath,[path.join(root,'scripts','qa-p1-sweep.mjs')]));
checks.push(run('p1:matrix',process.execPath,[path.join(root,'scripts','qa-p1-matrix.mjs')]));
const readOnlyEnv={...process.env,LOJAONLINE_LICENSE_SERVICE_SECRET:''};
checks.push(run('cross:read-only',process.execPath,[path.join(root,'scripts','qa-cross-system.mjs')],{env:readOnlyEnv}));

const manifest=await readJson(path.join(root,'qa','artisys-qa.config.json'),{flows:{},qaProfiles:{release:{flows:[],criticalFlows:[]}}});
const declared=Object.keys(manifest.flows||{});
const releaseFlows=new Set(manifest.qaProfiles?.release?.flows||[]);
const critical=new Set(manifest.qaProfiles?.release?.criticalFlows||[]);
const uncovered=declared.filter(name=>!releaseFlows.has(name));
const coverage={
  basis:'declared-release-flows',
  discovered:declared.length,
  covered:declared.length-uncovered.length,
  uncovered:uncovered.length,
  uncoveredItems:uncovered,
  uncoveredCritical:uncovered.filter(name=>critical.has(name)).length,
};

const sweep=await readJson(path.join(root,'qa-artifacts','p1-sweep','report.json'),{});
const matrix=await readJson(path.join(root,'qa-artifacts','p1-matrix','report.json'),{});
const endpoints=(sweep.api?.results||[]).map(item=>({
  name:item.name,method:item.method,path:item.path,status:item.status,expectedStatus:item.expectedStatus,passed:item.passed,
}));
const consoleErrors=sweep.ui?.consoleErrors||[];
const networkErrors=[
  ...(sweep.ui?.requestFailures||[]).map(item=>({...item,type:'requestfailed'})),
  ...(sweep.ui?.httpErrors||[]).map(item=>({...item,type:'http'})),
];
const findings=[];
for(const page of sweep.ui?.pages||[]){
  for(const item of page.suspiciousLinks||[])findings.push({severity:'warning',type:'suspicious-link',page:page.url,href:item.href,text:item.text});
  for(const item of page.unlabeledControls||[])findings.push({severity:'warning',type:'unlabeled-control',page:page.url,name:item.name,controlType:item.type});
}
if(matrix.status&&matrix.status!=='passed')findings.push({severity:'critical',type:'viewport-matrix',name:'viewport matrix failed'});
const evidence=await collectEvidence(path.join(root,'qa-artifacts'),p2StartedAt-2000);

const summary=buildProductQaSummary({
  systemId:'artisys-central-owner',
  profile:'release-p2',
  checks,coverage,endpoints,consoleErrors,networkErrors,findings,evidence,
  metadata:{
    qaRuntime:'2.6.0',
    p2:true,
    crossSystemReleaseMode:'read-only',
    p1SweepStatus:sweep.status||null,
    p1MatrixStatus:matrix.status||null,
  },
  policy:{maxHttp5xx:0,maxRequestFailures:0,maxConsoleErrors:0,maxUncoveredCritical:0},
});
const bundle=await writeProductQaBundle({
  outputRoot:path.join(root,'qa-delivery-artifacts'),
  summary,coverage,endpoints,consoleErrors,networkErrors,findings,evidence,
});
console.log('ARTISYS_QA_P2_BUNDLE='+bundle.outputDir);
console.log(JSON.stringify({status:summary.status,counts:summary.counts,gate:summary.gate.allowed,blockers:summary.gate.blockers},null,2));
if(!summary.gate.allowed)process.exitCode=1;
