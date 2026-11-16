// Runs on disposable Windows runner AFTER NSIS upgrade, against the installed Electron process.
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {setTimeout:delay}=require('node:timers/promises');
const {selectRendererTarget}=require('./windows-cdp-target.cjs');
const [evidence,renderPort='9224',mainPort='9232']=process.argv.slice(2);
if(!evidence)throw Error('Specify QA evidence folder');
const ExcelJS=createRequire(path.resolve(__dirname,'../../apps/desktop/package.json'))('exceljs');
async function connect(port){
 let last;
 for(let attempt=0;attempt<50;attempt++){
  try{
   const list=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(4000)})).json();
   const target=selectRendererTarget(list);
   if(!target?.webSocketDebuggerUrl)throw Error('CDP target missing');
   const ws=new WebSocket(target.webSocketDebuggerUrl);
   await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
   let id=0;const pending=new Map();
   ws.addEventListener('message',e=>{const data=JSON.parse(e.data);if(!pending.has(data.id))return;const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(Error(JSON.stringify(data.error))):p.resolve(data.result)});
   return {close:()=>ws.close(),async evaluate(expression){
    const n=++id;
    const result=await Promise.race([new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}))}),delay(75000).then(()=>{throw Error('CDP timeout '+expression.slice(0,80))})]);
    if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
   }};
  }catch(e){last=e;await delay(650)}
 }
 throw last;
}
async function workbook(file,rows){
 const wb=new ExcelJS.Workbook();const ws=wb.addWorksheet('Financeiro');
 rows.forEach(row=>ws.addRow(row));
 await wb.xlsx.writeFile(file);
}
async function run(){
 fs.mkdirSync(evidence,{recursive:true});
 const invalidFile=path.join(evidence,'duplicada.xlsx');
 const validFile=path.join(evidence,'valida.xlsx');
 const templateFile=path.join(evidence,'modelo-gerado.xlsx');
 const issuesFile=path.join(evidence,'erros-gerados.csv');
 await workbook(invalidFile,[['descricao','valor'],['Agua',12],['Agua',12],['Energia',50]]);
 await workbook(validFile,[['descricao','valor'],['Tubo teste',30],['Valvula teste',15]]);
 const renderer=await connect(Number(renderPort)),main=await connect(Number(mainPort));
 const verify=(condition,message)=>{if(!condition)throw Error(message)};
 const call=expression=>renderer.evaluate('(async()=>{'+expression+'})()');
 async function dialogs(file){
  const expr=`(()=>{const req=process.getBuiltinModule('module').createRequire(process.resourcesPath+'/app.asar/package.json');const d=req('electron').dialog;d.showOpenDialog=async()=>({canceled:false,filePaths:[${JSON.stringify(file)}]});d.showSaveDialog=async opts=>({canceled:false,filePath:opts.defaultPath.startsWith('Modelo-')?${JSON.stringify(templateFile)}:${JSON.stringify(issuesFile)}});return true})()`;
  verify(await main.evaluate(expr),'Cannot configure disposable file dialogs');
 }
 try{
  const company=await call(`const all=await window.fluxoDre.empresas.list();return all.find(x=>x.razao_social==='CI PRESERVATION COMPANY')||null;`);
  verify(company?.id,'Disposable installed company unavailable');
  const opts={sheet:'Financeiro',area:'financeiro',companyId:company.id};
  await dialogs(invalidFile);
  const selected=await call('return await window.fluxoDre.importadorUniversal.choose();');
  verify(selected?.token,'Installed Excel picker failed');
  const preview=await call(`return await window.fluxoDre.importadorUniversal.preview(${JSON.stringify(selected.token)},${JSON.stringify(opts)});`);
  verify(preview.total===3&&preview.duplicates===1&&preview.invalid===1,'Duplicate was not flagged');
  const rejected=await call(`try {await window.fluxoDre.importadorUniversal.commit(${JSON.stringify(selected.token)},${JSON.stringify(opts)});return false;}catch(error){return /linha|inválid|corrij/i.test(error.message)}`);
  verify(rejected,'Invalid import was not blocked');
  const profile=await call(`return await window.fluxoDre.importadorUniversal.saveMapping(${JSON.stringify({companyId:company.id,area:'financeiro',headers:['descricao','valor'],mapping:{descricao:'descricao',valor:'valor'}})});`);
  verify(profile?.saved,'SQLite mapping not persisted');
  const restored=await call(`return await window.fluxoDre.importadorUniversal.preview(${JSON.stringify(selected.token)},${JSON.stringify({...opts,mappingOnly:true})});`);
  verify(restored.mappingSource==='saved','Mapping not restored');
  const report=await call(`return await window.fluxoDre.importadorUniversal.exportIssues(${JSON.stringify(selected.token)},${JSON.stringify(opts)});`);
  verify(report?.count===1&&fs.existsSync(issuesFile),'Issues CSV not saved');
  const template=await call(`return await window.fluxoDre.importadorUniversal.template('financeiro');`);
  verify(template?.area==='financeiro'&&fs.existsSync(templateFile),'Template not created in installed app');
  const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(templateFile);
  verify(wb.getWorksheet('Financeiro')?.getRow(1).getCell(1).value==='descricao','Template headers wrong');
  await dialogs(validFile);
  const valid=await call('return await window.fluxoDre.importadorUniversal.choose();');
  verify(valid?.token,'Valid Excel not selected');
  const clean=await call(`return await window.fluxoDre.importadorUniversal.preview(${JSON.stringify(valid.token)},${JSON.stringify(opts)});`);
  verify(clean.total===2&&clean.invalid===0&&!clean.alreadyImported,'Valid preview failed');
  const committed=await call(`return await window.fluxoDre.importadorUniversal.commit(${JSON.stringify(valid.token)},${JSON.stringify(opts)});`);
  verify(committed.imported===2,'Installed import did not commit 2 rows');
  const accounts=await call(`return await window.fluxoDre.contas.list({empresa_id:${company.id}});`);
  verify(Array.isArray(accounts)&&accounts.some(x=>x.descricao==='Tubo teste')&&accounts.some(x=>x.descricao==='Valvula teste'),'SQLite canonical rows not available');
  const repeated=await call('return await window.fluxoDre.importadorUniversal.choose();');
  const replay=await call(`return await window.fluxoDre.importadorUniversal.preview(${JSON.stringify(repeated.token)},${JSON.stringify(opts)});`);
  verify(replay.alreadyImported===true,'Identical Excel can be silently replayed');
  const result={status:'PASS',company:company.id,imported:committed.imported,invalidBlocked:true,duplicateCount:preview.duplicates,exportedErrors:report.count,templateBytes:fs.statSync(templateFile).size,canonicalRecordsVerified:true,reimportBlocked:true};
  fs.writeFileSync(path.join(evidence,'importer-installed-qa.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
 }finally{main.close();renderer.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1});