import {test,expect} from 'vitest';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {DatabaseService}=require('./database.cjs');const {LocalSyncDataProvider}=require('./sync-data-provider.cjs');
test('P1 document reads only work-authorized bytes inside managed root',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p1-read-')),documentsDir=path.join(dir,'docs');fs.mkdirSync(documentsDir,{recursive:true});
 const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')});db.open();
 try{
  const company=db.save('empresas',{razao_social:'Empresa'}),work=db.save('obras',{empresa_id:company.id,nome:'A'}),other=db.save('obras',{empresa_id:company.id,nome:'B'});
  const p=path.join(documentsDir,'a.pdf'),outside=path.join(dir,'private.pdf');fs.writeFileSync(p,'%PDF-1.7\n%%EOF');fs.writeFileSync(outside,'%PDF-1.7\nPrivate');
  const f=db.save('arquivos',{nome_original:'a.pdf',nome_armazenado:'a.pdf',caminho:p,tamanho:fs.statSync(p).size});
  const fp=db.save('arquivos',{nome_original:'private.pdf',nome_armazenado:'private.pdf',caminho:outside,tamanho:fs.statSync(outside).size});
  const doc=db.save('documentos',{empresa_id:company.id,obra_id:work.id,categoria:'projeto',titulo:'Projeto',arquivo_id:f.id});
  const foreign=db.save('documentos',{empresa_id:company.id,obra_id:other.id,categoria:'projeto',titulo:'Alheio',arquivo_id:f.id});
  const leaked=db.save('documentos',{empresa_id:company.id,obra_id:work.id,categoria:'projeto',titulo:'Private',arquivo_id:fp.id});
  const reader=new LocalSyncDataProvider({database:db,documentsDir:()=>documentsDir}),scope={companyId:company.id,workId:work.id,deviceId:'pc'};
  expect((await reader.readP1Document(scope,doc.id)).name).toBe('a.pdf');
  await expect(reader.readP1Document(scope,foreign.id)).rejects.toThrow();
  await expect(reader.readP1Document(scope,leaked.id)).rejects.toThrow();
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true})}
});