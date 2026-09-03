const base=String(process.env.PRODUCTION_URL||'https://obra-na-mao-comercial.nutricionistaalmeidavh.workers.dev').replace(/\/$/,'');
const expected=String(process.env.EXPECTED_SHA||'').trim();
const waitMs=Number(process.env.DEPLOY_WAIT_MS||300000);
const intervalMs=5000;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function get(path,init={}){
  const response=await fetch(base+path,{redirect:'follow',...init,headers:{'cache-control':'no-cache',...(init.headers||{})}});
  return response;
}
async function json(path,init={}){
  const response=await get(path,init);
  const text=await response.text();
  let data;try{data=JSON.parse(text)}catch{throw new Error(path+' did not return JSON (HTTP '+response.status+'): '+text.slice(0,160))}
  return{response,data};
}

if(expected){
  const started=Date.now();
  let observed='';
  while(Date.now()-started<waitMs){
    try{
      const {response,data}=await json('/build-meta.json?ts='+Date.now());
      observed=String(data.sha||'');
      if(response.ok&&observed===expected)break;
      console.log('Waiting for production commit. expected='+expected.slice(0,12)+' observed='+(observed||'none').slice(0,12));
    }catch(error){console.log('Waiting for production metadata:',error instanceof Error?error.message:String(error))}
    await sleep(intervalMs);
  }
  if(observed!==expected)throw new Error('Production did not reach expected commit '+expected.slice(0,12)+' within '+Math.round(waitMs/1000)+'s; last observed '+(observed||'none').slice(0,12));
}

const buildMeta=await json('/build-meta.json?ts='+Date.now());
if(!buildMeta.response.ok)throw new Error('/build-meta.json failed: HTTP '+buildMeta.response.status);
if(!String(buildMeta.data.appVersion||''))throw new Error('Production build metadata is missing appVersion');

const health=await json('/api/health?ts='+Date.now());
if(!health.response.ok)throw new Error('/api/health failed: HTTP '+health.response.status);
if(health.data.ok!==true)throw new Error('/api/health is not healthy: '+JSON.stringify(health.data).slice(0,500));
if(String(health.data.appVersion||'')!==String(buildMeta.data.appVersion||''))throw new Error('Worker/static app version mismatch');
const expectedSchema=Number(health.data.expectedDbSchemaVersion);
const persistedSchema=Number(health.data.persistedDbSchemaVersion);
if(!Number.isFinite(expectedSchema)||expectedSchema<2)throw new Error('Production reports an invalid expected DB schema contract');
if(!Number.isFinite(persistedSchema))throw new Error('Production D1 has no persisted schema version');
if(persistedSchema!==expectedSchema)throw new Error('Production D1 schema mismatch: expected '+expectedSchema+' persisted '+persistedSchema);
if(health.data.schemaVersionMatch!==true||health.data.schemaReady!==true)throw new Error('Production D1 schema is not ready: '+JSON.stringify({schemaVersionMatch:health.data.schemaVersionMatch,missingSchemaTables:health.data.missingSchemaTables,missingRequiredMigrations:health.data.missingRequiredMigrations}));
if(Array.isArray(health.data.missingSchemaTables)&&health.data.missingSchemaTables.length)throw new Error('Production D1 is missing schema tables: '+health.data.missingSchemaTables.join(', '));
if(health.data.migrationTrackingReady!==true){
  console.warn('D1 schema is materialized and current, but Wrangler migration history is not fully tracked:',health.data.missingRequiredMigrations||[]);
}

const home=await get('/?ts='+Date.now());
const homeHtml=await home.text();
if(!home.ok||!homeHtml.includes('<title>ArtiSys'))throw new Error('ArtiSys commercial landing is not deployed');
const system=await get('/sistema.html?ts='+Date.now());
const systemHtml=await system.text();
if(!system.ok||!systemHtml.includes('id="content"'))throw new Error('System entry page is unavailable');
const logo=await get('/artisys-logo.svg');
if(!logo.ok||!String(logo.headers.get('content-type')||'').includes('image/svg+xml'))throw new Error('ArtiSys logo is unavailable');

const university=await get('/universidade.html?ts='+Date.now());
if(!university.ok)throw new Error('/universidade.html failed: HTTP '+university.status);
const universityHtml=await university.text();
if(universityHtml.length<300)throw new Error('/universidade.html returned an unexpectedly small document');

const visualMapResult=await json('/resources/question-visual-map.json?ts='+Date.now());
if(!visualMapResult.response.ok)throw new Error('question visual map failed: HTTP '+visualMapResult.response.status);
const visuals=visualMapResult.data;
const visualEntries=Object.values(visuals);
if(visualEntries.length!==549)throw new Error('Expected 549 question visuals in production, found '+visualEntries.length);
const sample=visualEntries.find(item=>item&&typeof item==='object'&&typeof item.src==='string');
if(!sample)throw new Error('No visual sample found');
const image=await get(sample.src+'?ts='+Date.now());
if(!image.ok)throw new Error('Question image sample failed: '+sample.src+' HTTP '+image.status);
if(!String(image.headers.get('content-type')||'').startsWith('image/'))throw new Error('Question image sample has invalid content type');

const unauthenticated=await get('/api/project?date=2026-09-02',{method:'GET'});
if(unauthenticated.status!==401)throw new Error('Protected /api/project should reject unauthenticated access with 401, got '+unauthenticated.status);

console.log('Production smoke passed:',{
  base,
  sha:expected?expected.slice(0,12):'not-enforced',
  health:true,
  commercialLanding:true,
  systemEntry:true,
  appVersion:String(health.data.appVersion||''),
  expectedDbSchemaVersion:expectedSchema,
  persistedDbSchemaVersion:persistedSchema,
  schemaReady:health.data.schemaReady===true,
  migrationTrackingReady:health.data.migrationTrackingReady===true,
  university:true,
  questionVisuals:visualEntries.length,
  protectedRoute:true
});
