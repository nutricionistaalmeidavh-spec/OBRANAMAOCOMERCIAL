import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)
const JSZip = require('jszip')
const { recoverDocumentBackup } = require('./document-backup-recovery.cjs')

it('recupera por hash mesmo renomeado e ignora arquivo homônimo incorreto sem extrair ZIP', async () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'obra-doc-backup-'))
  try {
    const bytes=Buffer.from('recibo original')
    let pending=[{id:59,nome_original:'recibo.pdf',hash:crypto.createHash('sha256').update(bytes).digest('hex')}]
    const client={pendingDocumentFiles:async()=>pending,recoverDocumentFile:vi.fn(async(id:number,content:string)=>{expect(id).toBe(59);expect(Buffer.from(content,'base64')).toEqual(bytes);pending=[]})}
    const zip=new JSZip();zip.file('recibo.pdf','conteudo errado');zip.file('../renomeado.pdf',bytes)
    const source=path.join(root,'backup.zip');fs.writeFileSync(source,await zip.generateAsync({type:'nodebuffer'}))
    expect(await recoverDocumentBackup(source,client)).toMatchObject({restored:1,skipped:1,pending:0,errors:[]})
    expect(fs.readdirSync(root)).toEqual(['backup.zip'])
  } finally {fs.rmSync(root,{recursive:true,force:true})}
})
