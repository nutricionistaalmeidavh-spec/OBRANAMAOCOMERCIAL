import {test,expect} from 'vitest';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createRequire} from 'node:module';const require=createRequire(import.meta.url);
const {DatabaseService}=require('./database.cjs');
const {applyWebP0Create}=require('./web-p0-create.cjs');
const {createHash}=require('node:crypto');
test('P1 document local stores canonical file and record, replay preserves single file and rejects scope forgery',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p1-document-')),documentsDir=path.join(dir,'documents');
 const database=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')});database.open();
 try{
  const company=database.save('empresas',{razao_social:'Empresa'}),work=database.save('obras',{empresa_id:company.id,nome:'Obra'});
  const other=database.save('obras',{empresa_id:company.id,nome:'Outra obra'});
  const scope={companyId:company.id,workId:work.id,deviceId:'pc-a'};
  const data=Buffer.from('%PDF-1.7\n%%EOF','utf8');
  const digest=createHash('sha256').update(data).digest('hex');
  const command={id:'11111111-1111-4111-8111-111111111111',deviceId:'pc-a',entity:'documentos',action:'create',data:{
    stageId:'11111111-1111-4111-8111-111111111111',sha256:digest,name:'Projeto.pdf',mimeType:'application/pdf',categoria:'projeto'
  },stagedFile:{data:data.toString('base64'),sha256:digest,name:'Projeto.pdf',mimeType:'application/pdf'}};
  const first=applyWebP0Create({database,documentsDir,scope,command});
  expect(applyWebP0Create({database,documentsDir,scope,command})).toMatchObject({duplicate:true,localId:first.localId});
  const doc=database.get('documentos',first.localId),file=database.get('arquivos',doc.arquivo_id);
  expect(doc.obra_id).toBe(work.id);expect(fs.existsSync(file.caminho)).toBe(true);
  expect(fs.readdirSync(documentsDir)).toHaveLength(1);
  expect(()=>applyWebP0Create({database,documentsDir,scope:{...scope,workId:other.id},command})).toThrow();
  expect(()=>applyWebP0Create({database,documentsDir,scope,command:{...command,id:'22222222-2222-4222-8222-222222222222',data:{...command.data,sha256:'b'.repeat(64)}}})).toThrow();
 }finally{database.close();fs.rmSync(dir,{recursive:true,force:true})}
});