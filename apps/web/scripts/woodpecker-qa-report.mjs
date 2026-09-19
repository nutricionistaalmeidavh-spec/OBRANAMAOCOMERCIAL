import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function normalizeStatus(value){
  const text=String(value||'').toLowerCase();
  if(['pass','passed','success','ok'].includes(text))return 'pass';
  if(['fail','failed','failure','error'].includes(text))return 'fail';
  return text||'unknown';
}

export function convertProductSummary(summary={},sourceSummary='QA-SUMMARY.json'){
  const checks=Array.isArray(summary.checks)?summary.checks:[];
  const steps=checks.map(check=>{
    const status=normalizeStatus(check.status);
    return {id:String(check.name||check.id||'check'),status,exitCode:status==='fail'?1:0,command:null,stdout:null,stderr:check.error?String(check.error):null,durationMs:Number.isFinite(Number(check.durationMs))?Number(check.durationMs):null};
  });
  const blockers=Array.isArray(summary.gate?.blockers)?summary.gate.blockers:[];
  for(const blocker of blockers)steps.push({id:'gate:'+String(blocker?.type||'blocker'),status:'fail',exitCode:1,command:null,stdout:null,stderr:JSON.stringify(blocker),durationMs:null});
  const passed=String(summary.status||'').toUpperCase()==='PASS'&&summary.gate?.allowed===true;
  const failed=steps.find(step=>step.status==='fail')||null;
  return {schemaVersion:1,status:passed?'pass':'fail',failedStep:passed?null:(failed?.id||'qa:p2'),steps,sourceSummary:String(sourceSummary),productStatus:summary.status||null,gateAllowed:summary.gate?.allowed===true,blockers,generatedAt:new Date().toISOString()};
}

async function walk(dir,out=[]){
  let entries=[];try{entries=await fs.readdir(dir,{withFileTypes:true})}catch{return out}
  for(const entry of entries){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full,out);else if(entry.isFile()&&entry.name==='QA-SUMMARY.json'){const stat=await fs.stat(full);out.push({file:full,mtimeMs:stat.mtimeMs})}}
  return out;
}
export async function findLatestQaSummary(workspace=process.cwd()){
  const files=await walk(path.join(workspace,'qa-delivery-artifacts'),[]);files.sort((a,b)=>b.mtimeMs-a.mtimeMs);return files[0]?.file||null;
}
export async function writeWoodpeckerQaReport({workspace=process.cwd(),summaryPath=null,outputPath=null}={}){
  const summaryFile=summaryPath||await findLatestQaSummary(workspace);if(!summaryFile)throw new Error('QA-SUMMARY.json nao encontrado em qa-delivery-artifacts');
  const summary=JSON.parse(await fs.readFile(summaryFile,'utf8'));const relative=path.relative(workspace,summaryFile).split(path.sep).join('/');const report=convertProductSummary(summary,relative);
  const target=outputPath||path.join(workspace,'artifacts','woodpecker-qa-report.json');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(report,null,2)+'\n','utf8');return {summaryPath:summaryFile,outputPath:target,report};
}
function parseArgs(argv){const out={};for(let i=0;i<argv.length;i++){if(argv[i]==='--summary')out.summaryPath=argv[++i];else if(argv[i]==='--output')out.outputPath=argv[++i];else if(argv[i]==='--workspace')out.workspace=argv[++i]}return out}
async function main(){const result=await writeWoodpeckerQaReport(parseArgs(process.argv.slice(2)));console.log('ARTISYS_WOODPECKER_QA_REPORT='+result.outputPath);console.log(JSON.stringify({status:result.report.status,failedStep:result.report.failedStep,sourceSummary:result.report.sourceSummary},null,2));if(result.report.status!=='pass')process.exitCode=1}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
