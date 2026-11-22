import {it,expect} from 'vitest';import {validateDownloadFilePayload} from './web-p1-document-download';
it('accepts a PDF with SHA256 and rejects tampered or unsafe files',async()=>{
 const data=btoa('%PDF-1.7\n%%EOF');
 const bytes=new TextEncoder().encode('%PDF-1.7\n%%EOF');
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const base={name:'Projeto.pdf',mimeType:'application/pdf',data,sha256:sha,localId:7};
 expect(await validateDownloadFilePayload(base)).toMatchObject({sha256:sha,name:'Projeto.pdf',localId:7});
 await expect(validateDownloadFilePayload({...base,sha256:'a'.repeat(64)})).rejects.toThrow();
 await expect(validateDownloadFilePayload({...base,name:'../private.pdf'})).rejects.toThrow();
 await expect(validateDownloadFilePayload({...base,localId:0})).rejects.toThrow();
});