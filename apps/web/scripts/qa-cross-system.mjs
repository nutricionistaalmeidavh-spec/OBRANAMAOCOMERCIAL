import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const INTERNAL_PREFIX='/api/internal/artisys/loja-online';

function safeBase(value,fallback){return new URL(String(value||fallback)).toString().replace(/\/$/,'')}
function centralHealthUrl(base){return new URL('/sistema',`${base}/`).toString()}
function lojaHealthUrl(base){return new URL('/',`${base}/`).toString()}
function timestamp(date){return date.toISOString().replace(/[:.]/g,'-')}
function redact(message,secret){return String(message||'').split(String(secret||'__never__')).join('[REDACTED]')}

async function responseJson(response){
  const text=await response.text();
  if(!text)return{};
  try{return JSON.parse(text)}catch{return{message:text.slice(0,500)}}
}

async function assertHttpOk(fetchImpl,url,label){
  const response=await fetchImpl(url,{headers:{accept:'text/html,application/json'}});
  if(!response.ok)throw new Error(`${label} respondeu HTTP ${response.status}`);
  return response.status;
}

async function internalRequest({fetchImpl,lojaBaseUrl,secret,pathName,method='GET',body}){
  const url=new URL(`${INTERNAL_PREFIX}${pathName}`,`${lojaBaseUrl}/`).toString();
  const headers={accept:'application/json','x-artisys-license-secret':secret};
  if(body!==undefined)headers['content-type']='application/json';
  const response=await fetchImpl(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const payload=await responseJson(response);
  if(!response.ok)throw new Error(`${payload.error||'HTTP_ERROR'}: ${payload.message||`HTTP ${response.status}`}`);
  return payload;
}

async function persistReport(report,now){
  const dir=path.join(root,'qa-artifacts','cross-system',timestamp(now));
  await fs.mkdir(dir,{recursive:true});
  const file=path.join(dir,'report.json');
  await fs.writeFile(file,`${JSON.stringify(report,null,2)}\n`,'utf8');
  return file;
}

export async function runCrossSystemQa({
  centralBaseUrl=process.env.ARTISYS_CENTRAL_BASE_URL||'https://artisys.dev',
  lojaBaseUrl=process.env.ARTISYS_LOJAONLINE_BASE_URL||'https://artisys-lojaonline.nutricionistaalmeidavh.workers.dev',
  secret=process.env.LOJAONLINE_LICENSE_SERVICE_SECRET||'',
  fetchImpl=fetch,
  writeArtifacts=true,
  now=()=>new Date(),
}={}){
  const started=now();
  const central=safeBase(centralBaseUrl,'https://artisys.dev');
  const loja=safeBase(lojaBaseUrl,'https://artisys-lojaonline.nutricionistaalmeidavh.workers.dev');
  const report={
    schemaVersion:1,
    startedAt:started.toISOString(),
    finishedAt:null,
    status:'PASS',
    mode:secret?'mutable':'read-only',
    targets:{central,loja},
    checks:[],
    mutations:[],
    auditActions:[],
    qaCompanyId:null,
    error:null,
  };

  try{
    const centralStatus=await assertHttpOk(fetchImpl,centralHealthUrl(central),'Central Artisys');
    report.checks.push({name:'central-http',status:'PASS',httpStatus:centralStatus});
    const lojaStatus=await assertHttpOk(fetchImpl,lojaHealthUrl(loja),'Loja Online');
    report.checks.push({name:'loja-http',status:'PASS',httpStatus:lojaStatus});

    if(secret){
      const runId=randomUUID().slice(0,8);
      const companyName=`QA-CROSS-${started.toISOString().slice(0,10)}-${runId}`;
      const adminEmail=`qa-cross-${runId}@example.test`;
      const created=await internalRequest({fetchImpl,lojaBaseUrl:loja,secret,pathName:'/companies',method:'POST',body:{companyName,adminName:'QA Cross System',adminEmail,plan:'QA_P0',months:1,maxUsers:3}});
      const companyId=created.company?.id;
      if(!companyId)throw new Error('Criação QA não retornou company.id');
      if(created.license?.status!=='ACTIVE')throw new Error(`Licença criada não ficou ACTIVE: ${created.license?.status||'sem status'}`);
      report.qaCompanyId=companyId;
      report.mutations.push({action:'create',companyId,licenseStatus:created.license.status,expiresAt:created.license.expiresAt||null});

      const extended=await internalRequest({fetchImpl,lojaBaseUrl:loja,secret,pathName:`/companies/${encodeURIComponent(companyId)}/extend`,method:'POST',body:{months:6}});
      if(!extended.license?.expiresAt)throw new Error('Extensão QA não retornou nova validade');
      report.mutations.push({action:'extend',companyId,licenseStatus:extended.license.status||null,expiresAt:extended.license.expiresAt});

      const blocked=await internalRequest({fetchImpl,lojaBaseUrl:loja,secret,pathName:`/companies/${encodeURIComponent(companyId)}/block`,method:'POST',body:{reason:'QA cross-system P0'}});
      if(blocked.license?.status!=='BLOCKED')throw new Error(`Bloqueio QA retornou ${blocked.license?.status||'sem status'}`);
      report.mutations.push({action:'block',companyId,licenseStatus:blocked.license.status});

      const unblocked=await internalRequest({fetchImpl,lojaBaseUrl:loja,secret,pathName:`/companies/${encodeURIComponent(companyId)}/unblock`,method:'POST',body:{}});
      if(unblocked.license?.status!=='ACTIVE')throw new Error(`Desbloqueio QA retornou ${unblocked.license?.status||'sem status'}`);
      report.mutations.push({action:'unblock',companyId,licenseStatus:unblocked.license.status,expiresAt:unblocked.license.expiresAt||null});

      const audit=await internalRequest({fetchImpl,lojaBaseUrl:loja,secret,pathName:'/license-audit'});
      const actions=(audit.events||[]).filter(event=>event.companyId===companyId).map(event=>event.action);
      if(!actions.includes('central.client.create'))throw new Error('Auditoria QA não registrou central.client.create');
      report.auditActions=[...new Set(actions)];
      report.checks.push({name:'licensing-audit',status:'PASS',events:report.auditActions.length});
    }
  }catch(error){
    report.status='FAIL';
    report.error=redact(error?.message||String(error),secret);
  }

  report.finishedAt=now().toISOString();
  if(writeArtifacts)report.artifact=await persistReport(report,started);
  return report;
}

async function main(){
  const report=await runCrossSystemQa();
  console.log(JSON.stringify(report,null,2));
  if(report.artifact)console.log(`ARTISYS_QA_CROSS_REPORT=${report.artifact}`);
  process.exitCode=report.status==='PASS'?0:1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
