import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveCommandInvocation } from './qa-command.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const npmCommand=process.platform==='win32'?'npm.cmd':'npm';
const startedAt=Date.now();
function tail(value,max=6000){const text=String(value||'').trim();return text.length>max?text.slice(text.length-max):text}
function run(name,command,args,{env=process.env,critical=true}={}){
  const started=Date.now();const resolved=resolveCommandInvocation(command,args,process.platform,env);
  const result=spawnSync(resolved.command,resolved.args,{cwd:root,env,encoding:'utf8',shell:resolved.shell,windowsHide:true,maxBuffer:32*1024*1024});
  if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
  const output=[result.stderr,result.stdout].filter(Boolean).join('\n');
  return{name,status:result.status===0?'passed':'failed',critical,durationMs:Date.now()-started,error:result.error?.message||(result.status===0?null:(tail(output)||'exit '+String(result.status)))};
}
async function readJson(file,fallback=null){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}}
async function collectEvidence(dir,sinceMs,limit=1000){const out=[];async function walk(current){if(out.length>=limit)return;let entries=[];try{entries=await fs.readdir(current,{withFileTypes:true})}catch{return}for(const entry of entries){if(out.length>=limit)break;const full=path.join(current,entry.name);if(entry.isDirectory()){await walk(full);continue}if(!entry.isFile())continue;let stat;try{stat=await fs.stat(full)}catch{continue}if(stat.mtimeMs<sinceMs)continue;const lower=entry.name.toLowerCase();let type='artifact';if(/\.(png|jpg|jpeg|webp)$/.test(lower))type='screenshot';else if(/\.(webm|mp4)$/.test(lower))type='video';else if(lower==='trace.zip')type='trace';else if(lower.endsWith('.json'))type='json';out.push({type,path:path.relative(root,full).split(path.sep).join('/'),size:stat.size,modifiedAt:new Date(stat.mtimeMs).toISOString()})}}await walk(dir);return out}

const checks=[];
checks.push(run('native:test',npmCommand,['test']));
checks.push(run('native:build',npmCommand,['run','build']));
checks.push(run('native:ux-verify',npmCommand,['run','ux:verify']));
checks.push(run('p1:security',npmCommand,['run','qa:p1:security']));
checks.push(run('p1:owner-transactional',process.execPath,[path.join(root,'scripts','qa-owner-transactional.mjs')]));
checks.push(run('p1:field-transactional',process.execPath,[path.join(root,'scripts','qa-field-transactional.mjs')]));
checks.push(run('p1:admin-governance-transactional',process.execPath,[path.join(root,'scripts','qa-admin-governance-transactional.mjs')]));
checks.push(run('cross:read-only',process.execPath,[path.join(root,'scripts','qa-cross-system.mjs')],{env:{...process.env,LOJAONLINE_LICENSE_SERVICE_SECRET:''},critical:false}));

const capabilityManifest=await readJson(path.join(root,'qa','business-capabilities.json'),{capabilities:[]});
const statusByCheck=new Map(checks.map(check=>[check.name,check.status]));
const capabilities=(capabilityManifest.capabilities||[]).map(item=>{const required=Array.isArray(item.checks)?item.checks:[];const missing=required.filter(name=>statusByCheck.get(name)!=='passed');return{...item,passed:missing.length===0,missingChecks:missing}});
const uncovered=capabilities.filter(item=>!item.passed);
const coverage={basis:'business-capabilities',discovered:capabilities.length,covered:capabilities.length-uncovered.length,uncovered:uncovered.length,uncoveredItems:uncovered.map(item=>item.id),uncoveredCritical:uncovered.filter(item=>item.critical).length,capabilities};
const ownerTransactional=await readJson(path.join(root,'qa-artifacts','owner-transactional','report.json'),{});
const fieldTransactional=await readJson(path.join(root,'qa-artifacts','field-transactional','report.json'),{});
const governanceTransactional=await readJson(path.join(root,'qa-artifacts','admin-governance-transactional','report.json'),{});
const invariantErrors=[];
const ownerReportPassed=ownerTransactional.status==='passed';
if(!ownerReportPassed)invariantErrors.push('owner transactional report not passed');
if(ownerTransactional.emailFirst!==true)invariantErrors.push('email-first provisioning was not proven');
if(ownerTransactional.googleAuthPreserved!==true)invariantErrors.push('Google auth preservation was not proven');
if(ownerReportPassed&&Number(ownerTransactional.licenseSuspensionsPerformed)>0)invariantErrors.push('transactional owner QA suspended a license');
else if(!ownerReportPassed||ownerTransactional.licenseSuspensionsPerformed===undefined)invariantErrors.push('owner license-suspension isolation invariant was not proven');
const expectedViewports=['desktop','tablet','mobile'];const actualViewports=Array.isArray(ownerTransactional.viewports)?ownerTransactional.viewports:[];for(const viewport of expectedViewports)if(!actualViewports.includes(viewport))invariantErrors.push(`missing ${viewport} owner browser coverage`);
const fieldReportPassed=fieldTransactional.status==='passed';
if(!fieldReportPassed)invariantErrors.push('field transactional report not passed');
if(fieldTransactional.remoteStateRendered!==true)invariantErrors.push('Obra360 did not prove canonical remote state rendering');
if(fieldReportPassed&&Number(fieldTransactional.licenseMutationsPerformed)>0)invariantErrors.push('field transactional QA touched commercial licensing');
else if(!fieldReportPassed||fieldTransactional.licenseMutationsPerformed===undefined)invariantErrors.push('Obra360 commercial-license isolation invariant was not proven');
const fieldViewports=Array.isArray(fieldTransactional.viewports)?fieldTransactional.viewports:[];for(const viewport of ['desktop','mobile'])if(!fieldViewports.includes(viewport))invariantErrors.push(`missing ${viewport} Obra360 browser coverage`);
const governanceReportPassed=governanceTransactional.status==='passed';
if(!governanceReportPassed)invariantErrors.push('admin governance transactional report not passed');
if(governanceTransactional.granularPermissions!==true)invariantErrors.push('granular member permissions were not proven in the UI');
if(governanceTransactional.tenantDeviceControl!==true)invariantErrors.push('tenant-scoped device control was not proven in the UI');
if(governanceTransactional.syncObservability!==true)invariantErrors.push('sync observability was not proven in the UI');
if(governanceTransactional.ownerApisTouched!==false)invariantErrors.push('client governance isolation from owner APIs was not proven');
const governanceViewports=Array.isArray(governanceTransactional.viewports)?governanceTransactional.viewports:[];for(const viewport of ['desktop','mobile'])if(!governanceViewports.includes(viewport))invariantErrors.push(`missing ${viewport} admin-governance browser coverage`);
const criticalCheckFailures=checks.filter(check=>check.critical&&check.status!=='passed');
const allowed=criticalCheckFailures.length===0&&coverage.uncoveredCritical===0&&invariantErrors.length===0;
const evidence=await collectEvidence(path.join(root,'qa-artifacts'),startedAt-2000);
const summary={schemaVersion:4,systemId:'obra-na-mao-commercial',profile:'release-p2-core',generatedAt:new Date().toISOString(),status:allowed?'passed':'failed',gate:{allowed,blockers:[...criticalCheckFailures.map(c=>`${c.name}: ${c.error||'failed'}`),...uncovered.filter(item=>item.critical).map(item=>`capability:${item.id}`),...invariantErrors]},checks,coverage,metadata:{qaEngine:'playwright-1.62.1-direct',coreDependencyMode:'self-contained-open-source',emailFirst:ownerTransactional.emailFirst??null,googleAuthPreserved:ownerTransactional.googleAuthPreserved??null,licenseSuspensionsPerformed:ownerTransactional.licenseSuspensionsPerformed??null,ownerViewports:actualViewports,fieldRemoteStateRendered:fieldTransactional.remoteStateRendered??null,fieldLicenseMutationsPerformed:fieldTransactional.licenseMutationsPerformed??null,fieldViewports,governanceGranularPermissions:governanceTransactional.granularPermissions??null,governanceTenantDeviceControl:governanceTransactional.tenantDeviceControl??null,governanceSyncObservability:governanceTransactional.syncObservability??null,governanceOwnerApisTouched:governanceTransactional.ownerApisTouched??null,governanceViewports},evidence};
const stamp=new Date().toISOString().replace(/[:.]/g,'-');const outDir=path.join(root,'qa-delivery-artifacts',stamp);await fs.mkdir(outDir,{recursive:true});await fs.writeFile(path.join(outDir,'summary.json'),JSON.stringify(summary,null,2)+'\n','utf8');await fs.writeFile(path.join(outDir,'coverage.json'),JSON.stringify(coverage,null,2)+'\n','utf8');await fs.writeFile(path.join(outDir,'evidence.json'),JSON.stringify(evidence,null,2)+'\n','utf8');
console.log('ARTISYS_QA_P2_BUNDLE='+outDir);console.log(JSON.stringify({status:summary.status,gate:allowed,blockers:summary.gate.blockers,coverage:{basis:coverage.basis,covered:coverage.covered,discovered:coverage.discovered,uncoveredCritical:coverage.uncoveredCritical},ownerViewports:actualViewports,fieldViewports,governanceViewports},null,2));if(!allowed)process.exitCode=1;
