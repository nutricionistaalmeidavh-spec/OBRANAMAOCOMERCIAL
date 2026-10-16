// Runs the unmodified installed startup service with real SQLite and real fs.
// Only Electron dialog/shell (unused by this constructor) are replaced, because
// this probe runs Electron's Node mode, not a BrowserWindow.
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const [asar,databasePath,output,phase]=process.argv.slice(2);
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){if(request==='electron')return {dialog:{},shell:{}};return originalLoad.call(this,request,parent,isMain);};
let db;
const result={phase,user:process.env.USERNAME,node:process.version,asar,databasePath};
try {
  const Database=require(path.join(asar,'node_modules','better-sqlite3'));
  db=new Database(databasePath,{readonly:true,fileMustExist:true});
  const {DocumentRootService}=require(path.join(asar,'electron','services','document-root-service.cjs'));
  result.configuredRoot=db.prepare("SELECT valor FROM configuracoes WHERE chave='documentos_pasta_raiz'").get()?.valor;
  const service=new DocumentRootService({db:{db},files:{},defaultDir:path.join(path.dirname(databasePath),'documentos')});
  const probe=path.join(service.getRoot(),'ci-permission-probe-'+process.pid+'.txt');
  fs.writeFileSync(probe,'fixture-only permission probe',{flag:'wx'});
  fs.unlinkSync(probe);
  result.status='ready-and-writable';
} catch(error) {
  result.status='startup-failed';
  result.error={code:error.code,syscall:error.syscall,path:error.path,message:error.message,stack:error.stack};
} finally {db?.close();}
fs.writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
