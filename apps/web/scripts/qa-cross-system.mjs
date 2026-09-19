import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const INTERNAL_PREFIX='/api/internal/artisys/loja-online';

function safeBase(value,fallback){return new URL(String(value||fallback)).toString().replace(/\/$/,'')}
function safeTarget(value,fallback){const url=new URL(String(value||fallback));if(!['https:','http:'].includes(url.protocol))throw new Error('QA target precisa usar HTTP/HTTPS');return url.toString()}
function centralHealthUrl(base){return new URL('/sistema',base+'/').toString()}
function lojaHealthUrl(base){return new URL('/',base+'/').toString()}
function timestamp(date){return date.toISOString().replace(/[:.]/g,'-')}
function redactText(message,secrets=[]){
  let value=String(message||'');
  for(const secret of secrets.filter(Boolean))value=value.split(String(secret)).join('[REDACTED]');
  return value;
}
async function responseJson(response){
  const text=await response.text();
  if(!text)return{};
  try{return JSON.parse(text)}catch{return{message:text.slice(0,500)}}
}
async function assertHttpOk(fetchImpl,url,label){
  const response=await fetchImpl(url,{headers:{accept:'text/html,application/json'}});
  if(!response.ok)throw new Error(label+' respondeu HTTP '+response.status);
  return response.status;
}
async function assertSeoPanel(fetchImpl,url){
  const response=await fetchImpl(url,{headers:{accept:'text/html'}});
  if(!response.ok)throw new Error('Painel SEO respondeu HTTP '+response.status);
  const html=await response.text();
  if(!/Painel SEO/i.test(html)||!/admin\/seo\/app\.js/i.test(html))throw new Error('Painel SEO respondeu sem o shell administrativo esperado');
  return response.status;
}
async function requestJson({fetchImpl,baseURL,pathName,method='GET',headers={},body,expectedStatus=[200]}){
  const response=await fetchImpl(new URL(pathName,baseURL+'/').toString(),{
    method,
    headers:{accept:'application/json',...(body!==undefined?{'content-type':'application/json'}:{}),...headers},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const payload=await responseJson(response);
  const expected=Array.isArray(expectedStatus)?expectedStatus:[expectedStatus];
  if(!expected.includes(response.status)){
    throw new Error((payload.error||'HTTP_ERROR')+': '+(payload.message||('HTTP '+response.status)));
  }
  return {status:response.status,payload};
}
async function internalRequest({fetchImpl,lojaBaseUrl,secret,pathName,method='GET',body}){
  const result=await requestJson({
    fetchImpl,
    baseURL:lojaBaseUrl,
    pathName:INTERNAL_PREFIX+pathName,
    method,
    headers:{'x-artisys-license-secret':secret},
    body,
    expectedStatus:[200,201],
  });
  return result.payload;
}
async function persistReport(report,now){
  const dir=path.join(root,'qa-artifacts','cross-system',timestamp(now));
  await fs.mkdir(dir,{recursive:true});
  const file=path.join(dir,'report.json');
  await fs.writeFile(file,JSON.stringify(report,null,2)+'\n','utf8');
  return file;
}

export async function runCrossSystemQa({
  centralBaseUrl=process.env.ARTISYS_CENTRAL_BASE_URL||'https://artisys.dev',
  lojaBaseUrl=process.env.ARTISYS_LOJAONLINE_BASE_URL||'https://artisys-lojaonline.nutricionistaalmeidavh.workers.dev',
  seoPanelUrl=process.env.ARTISYS_SEO_PANEL_URL||'https://deboralactacao.com/admin/seo/?context=loja-online',
  secret=process.env.LOJAONLINE_LICENSE_SERVICE_SECRET||'',
  fetchImpl=fetch,
  writeArtifacts=true,
  now=()=>new Date(),
}={}){
  const started=now();
  const central=safeBase(centralBaseUrl,'https://artisys.dev');
  const loja=safeBase(lojaBaseUrl,'https://artisys-lojaonline.nutricionistaalmeidavh.workers.dev');
  const seo=safeTarget(seoPanelUrl,'https://deboralactacao.com/admin/seo/?context=loja-online');
  const report={
    schemaVersion:3,
    startedAt:started.toISOString(),
    finishedAt:null,
    status:'PASS',
    mode:secret?'mutable-p1':'read-only',
    targets:{central,loja,seo},
    checks:[],
    mutations:[],
    auditActions:[],
    qaCompanyId:null,
    error:null,
  };
  const sensitive=[secret];
  try{
    const centralStatus=await assertHttpOk(fetchImpl,centralHealthUrl(central),'Central Artisys');
    report.checks.push({name:'central-http',status:'PASS',httpStatus:centralStatus});
    const lojaStatus=await assertHttpOk(fetchImpl,lojaHealthUrl(loja),'Loja Online');
    report.checks.push({name:'loja-http',status:'PASS',httpStatus:lojaStatus});
    const seoStatus=await assertSeoPanel(fetchImpl,seo);
    report.checks.push({name:'seo-panel-http',status:'PASS',httpStatus:seoStatus});

    if(secret){
      const invalid=await requestJson({
        fetchImpl,baseURL:loja,pathName:INTERNAL_PREFIX+'/companies',
        headers:{'x-artisys-license-secret':'qa-invalid-secret'},
        expectedStatus:401,
      });
      if(invalid.payload?.error!=='INTERNAL_AUTH_REQUIRED')throw new Error('Secret inválido não foi rejeitado com INTERNAL_AUTH_REQUIRED');
      report.checks.push({name:'invalid-secret-denied',status:'PASS',httpStatus:invalid.status});

      const runId=randomUUID().slice(0,8);
      const companyName='QA-CROSS-'+started.toISOString().slice(0,10)+'-'+runId;
      const adminEmail='qa-cross-'+runId+'@example.test';
      const slug=('qa-cross-'+runId).toLowerCase();
      const created=await internalRequest({
        fetchImpl,lojaBaseUrl:loja,secret,pathName:'/companies',method:'POST',
        body:{companyName,adminName:'QA Cross System',adminEmail,plan:'QA_P1',months:1,maxUsers:3},
      });
      const companyId=created.company?.id;
      const temporaryPassword=created.temporaryPassword;
      if(!companyId)throw new Error('Criação QA não retornou company.id');
      if(!temporaryPassword)throw new Error('Criação QA não retornou senha temporária');
      if(created.license?.status!=='ACTIVE')throw new Error('Licença criada não ficou ACTIVE: '+(created.license?.status||'sem status'));
      sensitive.push(temporaryPassword);
      report.qaCompanyId=companyId;
      report.mutations.push({action:'create',companyId,licenseStatus:created.license.status,expiresAt:created.license.expiresAt||null});

      const login=await requestJson({
        fetchImpl,baseURL:loja,pathName:'/api/v1/login',method:'POST',
        body:{email:adminEmail,password:temporaryPassword},
        expectedStatus:200,
      });
      const session=login.payload?.session;
      if(!session)throw new Error('Login QA não retornou sessão');
      sensitive.push(session);
      report.checks.push({name:'temporary-login',status:'PASS'});

      const auth={authorization:'Bearer '+session};
      const product=await requestJson({
        fetchImpl,baseURL:loja,pathName:'/api/v1/products',method:'POST',headers:auth,
        body:{name:'Produto QA '+runId,sku:'QA-'+runId.toUpperCase(),priceCents:1234},
        expectedStatus:201,
      });
      const productId=product.payload?.id;
      if(!productId)throw new Error('Produto QA não retornou id');

      await requestJson({
        fetchImpl,baseURL:loja,pathName:'/api/v1/products/'+encodeURIComponent(productId)+'/publication',
        method:'PUT',headers:auth,body:{published:true},expectedStatus:200,
      });
      await requestJson({
        fetchImpl,baseURL:loja,pathName:'/api/v1/public-catalog/settings',
        method:'PUT',headers:auth,
        body:{slug,title:companyName,enabled:true},
        expectedStatus:200,
      });
      const catalogBefore=await requestJson({
        fetchImpl,baseURL:loja,pathName:'/api/v1/public/catalog/'+encodeURIComponent(slug),
        expectedStatus:200,
      });
      if(!Array.isArray(catalogBefore.payload?.products)||!catalogBefore.payload.products.some(item=>item.id===productId)){
        throw new Error('Produto QA não apareceu no catálogo público');
      }
      report.checks.push({name:'public-catalog-active',status:'PASS',products:catalogBefore.payload.products.length});

      const extended=await internalRequest({
        fetchImpl,lojaBaseUrl:loja,secret,pathName:'/companies/'+encodeURIComponent(companyId)+'/extend',
        method:'POST',body:{months:6},
      });
      if(!extended.license?.expiresAt)throw new Error('Extensão QA não retornou nova validade');
      report.mutations.push({action:'extend',companyId,licenseStatus:extended.license.status||null,expiresAt:extended.license.expiresAt});

      const blocked=await internalRequest({
        fetchImpl,lojaBaseUrl:loja,secret,pathName:'/companies/'+encodeURIComponent(companyId)+'/block',
        method:'POST',body:{reason:'QA cross-system P1'},
      });
      if(blocked.license?.status!=='BLOCKED')throw new Error('Bloqueio QA retornou '+(blocked.license?.status||'sem status'));
      report.mutations.push({action:'block',companyId,licenseStatus:blocked.license.status});

      const blockedDashboard=await requestJson({
        fetchImpl,baseURL:loja,pathName:'/api/v1/dashboard',headers:auth,expectedStatus:403,
      });
      if(blockedDashboard.payload?.error!=='LICENSE_BLOCKED')throw new Error('Dashboard bloqueado não retornou LICENSE_BLOCKED');
      const blockedCatalog=await requestJson({
        fetchImpl,baseURL:loja,pathName:'/api/v1/public/catalog/'+encodeURIComponent(slug),expectedStatus:403,
      });
      if(blockedCatalog.payload?.error!=='PUBLIC_CATALOG_LICENSE_INACTIVE')throw new Error('Catálogo bloqueado não retornou PUBLIC_CATALOG_LICENSE_INACTIVE');
      report.checks.push({name:'license-block-enforced',status:'PASS'});

      const unblocked=await internalRequest({
        fetchImpl,lojaBaseUrl:loja,secret,pathName:'/companies/'+encodeURIComponent(companyId)+'/unblock',
        method:'POST',body:{},
      });
      if(unblocked.license?.status!=='ACTIVE')throw new Error('Desbloqueio QA retornou '+(unblocked.license?.status||'sem status'));
      report.mutations.push({action:'unblock',companyId,licenseStatus:unblocked.license.status,expiresAt:unblocked.license.expiresAt||null});

      await requestJson({fetchImpl,baseURL:loja,pathName:'/api/v1/dashboard',headers:auth,expectedStatus:200});
      await requestJson({fetchImpl,baseURL:loja,pathName:'/api/v1/public/catalog/'+encodeURIComponent(slug),expectedStatus:200});
      report.checks.push({name:'license-unblock-restored',status:'PASS'});

      const audit=await internalRequest({fetchImpl,lojaBaseUrl:loja,secret,pathName:'/license-audit'});
      const actions=(audit.events||[]).filter(event=>event.companyId===companyId).map(event=>event.action);
      for(const required of ['central.client.create','central.license.extend','central.license.block','central.license.unblock']){
        if(!actions.includes(required))throw new Error('Auditoria QA não registrou '+required);
      }
      report.auditActions=[...new Set(actions)];
      report.checks.push({name:'licensing-audit',status:'PASS',events:report.auditActions.length});
    }
  }catch(error){
    report.status='FAIL';
    report.error=redactText(error?.message||String(error),sensitive);
  }
  report.finishedAt=now().toISOString();
  if(writeArtifacts)report.artifact=await persistReport(report,started);
  return report;
}

async function main(){
  const report=await runCrossSystemQa();
  console.log(JSON.stringify(report,null,2));
  if(report.artifact)console.log('ARTISYS_QA_CROSS_REPORT='+report.artifact);
  process.exitCode=report.status==='PASS'?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
