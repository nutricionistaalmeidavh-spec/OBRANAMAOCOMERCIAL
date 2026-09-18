import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtimeRoot=path.join(root,'qa','runtime');
const { buildProductQaSummary, writeProductQaBundle }=await import(pathToFileURL(path.join(runtimeRoot,'src','product-report.js')).href);
const npmCommand=process.platform==='win32'?'npm.cmd':'npm';

function run(name,command,args,{env=process.env}={}){
  const started=Date.now();
  const result=spawnSync(command,args,{cwd:root,env,stdio:'inherit',shell:false});
  return {
    name,
    category:name.startsWith('native:')?'native':name.startsWith('cross:')?'cross-system':'p1',
    status:result.status===0?'passed':'failed',
    critical:true,
    durationMs:Date.now()-started,
    error:result.error?.message||(result.status===0?null:'exit '+String(result.status)),
  };
}
async function readJson(file,fallback=null){
  try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}
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

const summary=buildProductQaSummary({
  systemId:'artisys-central-owner',
  profile:'release-p2',
  checks,coverage,endpoints,consoleErrors,networkErrors,findings,
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
  summary,coverage,endpoints,consoleErrors,networkErrors,findings,
});
console.log('ARTISYS_QA_P2_BUNDLE='+bundle.outputDir);
console.log(JSON.stringify({status:summary.status,counts:summary.counts,gate:summary.gate.allowed,blockers:summary.gate.blockers},null,2));
if(!summary.gate.allowed)process.exitCode=1;
