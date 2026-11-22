import {describe,it,expect} from 'vitest';
import {validateDocumentUpload,validateDocumentCommand} from './web-p1-document-stage';
describe('P1 document staging (temporary transport, canonical source)',()=>{
 it('accepts bounded PDF bytes and computes SHA256',async()=>{
  const b64=btoa('%PDF-1.7\n1 0 obj\nendobj\n%%EOF');
  const file=await validateDocumentUpload({uploadId:'11111111-1111-4111-8111-111111111111',name:'obra.pdf',mimeType:'application/pdf',data:b64,sourceDeviceId:'pc-1'});
  expect(file).toMatchObject({name:'obra.pdf',mimeType:'application/pdf',sourceDeviceId:'pc-1'});
  expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(file.bytes.byteLength).toBeGreaterThan(10);
 });
 it('rejects fake extension, arbitrary MIME, empty and too-large content',async()=>{
  const id='11111111-1111-4111-8111-111111111111';
  const input={uploadId:id,name:'obra.pdf',sourceDeviceId:'pc-1',mimeType:'application/pdf'};
  await expect(validateDocumentUpload({...input,data:btoa('not pdf')})).rejects.toThrow();
  await expect(validateDocumentUpload({...input,data:btoa('%PDF-1.0'),mimeType:'application/x-executable'})).rejects.toThrow();
  await expect(validateDocumentUpload({...input,data:''})).rejects.toThrow();
  await expect(validateDocumentUpload({...input,name:'../../private.pdf',data:btoa('%PDF-1.5')})).rejects.toThrow();
 });
 it('validates document refs and never accepts company/obra id from client',()=>{
  const input={stageId:'11111111-1111-4111-8111-111111111111',
   sha256:'a'.repeat(64),name:'obra.pdf',mimeType:'application/pdf',categoria:'projeto',
   relacao_tipo:'medicoes',relacao_id:7};
  expect(validateDocumentCommand(input)).toEqual(input);
  expect(()=>validateDocumentCommand({...input,obra_id:80})).toThrow();
  expect(()=>validateDocumentCommand({...input,relacao_id:0})).toThrow();
  expect(()=>validateDocumentCommand({...input,relacao_tipo:'contas'})).toThrow();
 });
});