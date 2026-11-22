import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import os from 'node:os';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {LanRepository} from '../src/repository.mjs';import {DocumentStorageService} from '../src/document-storage-service.mjs';
import {applyLanWebP0Command} from '../src/web-p0-command-service.mjs';
test('P1 server document import atomically stores canonical file and receipt only once',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p1-lan-document-'));
 const repository=new LanRepository({filename:':memory:'});repository.applyMigrations(path.resolve(import.meta.dirname,'../migrations'));
 try{
  const company=repository.save('empresas',{razao_social:'Empresa'}),work=repository.save('obras',{empresa_id:company.id,nome:'Obra A'});
  const docs=new DocumentStorageService({repository,filesDir:dir});
  const scope={companyId:company.id,workId:work.id,deviceId:'pc-1'};
  const file=Buffer.from('%PDF-1.7\n%%EOF'),sha=createHash('sha256').update(file).digest('hex');
  const command={id:'11111111-1111-4111-8111-111111111111',deviceId:'pc-1',entity:'documentos',action:'create',data:{
    stageId:'11111111-1111-4111-8111-111111111111',sha256:sha,name:'Obra.pdf',mimeType:'application/pdf',categoria:'projeto'
  },stagedFile:{data:file.toString('base64'),sha256:sha,name:'Obra.pdf',mimeType:'application/pdf'}};
  const first=applyLanWebP0Command({repository,documents:docs,scope,command});
  const next=applyLanWebP0Command({repository,documents:docs,scope,command});
  assert.equal(first.localId,next.localId);assert.equal(next.duplicate,true);
  assert.equal(repository.get('documentos',first.localId).obra_id,work.id);
  assert.equal(fs.readdirSync(dir).length,1);
  assert.throws(()=>applyLanWebP0Command({repository,documents:docs,scope,command:{...command,id:'22222222-2222-4222-8222-222222222222',stagedFile:{...command.stagedFile,data:Buffer.from('tampered').toString('base64')}}}));
 }finally{repository.close();fs.rmSync(dir,{recursive:true,force:true})}
});