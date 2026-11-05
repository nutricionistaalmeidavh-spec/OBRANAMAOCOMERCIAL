const fs = require('node:fs')
const crypto = require('node:crypto')
const JSZip = require('jszip')
const MAX_FILE = 25 * 1024 * 1024

async function readEntry(entry, budget) {
  return new Promise((resolve,reject)=>{
    const chunks=[]
    let size=0
    const stream=entry.nodeStream('nodebuffer')
    stream.on('data',chunk=>{
      size+=chunk.length; budget.bytes+=chunk.length
      if(size>MAX_FILE||budget.bytes>500*1024*1024){
        stream.destroy()
        reject(new Error(budget.bytes>500*1024*1024?'Conteúdo descompactado excede 500 MB.':'Arquivo no backup excede 25 MB.'))
      }else chunks.push(chunk)
    })
    stream.on('error',reject)
    stream.on('end',()=>resolve(Buffer.concat(chunks)))
  })
}

async function recoverDocumentBackup(source, client) {
  const stat = fs.statSync(source)
  if (!stat.isFile() || stat.size > 200 * 1024 * 1024) throw new Error('Selecione um backup ZIP de até 200 MB.')
  const pending = await client.pendingDocumentFiles()
  const byHash = new Map()
  for (const file of pending) {
    const hash = String(file.hash || '').toLowerCase()
    if (!/^[a-f0-9]{64}$/.test(hash)) continue
    byHash.set(hash, [...(byHash.get(hash) || []), file])
  }
  const zip = await JSZip.loadAsync(fs.readFileSync(source))
  const entries = Object.values(zip.files).filter(entry => !entry.dir)
  if (entries.length > 5000) throw new Error('Backup excede o limite de 5.000 arquivos.')
  let restored = 0, skipped = 0
  const budget={bytes:0}
  const errors = []
  for (const entry of entries) {
    try {
      const bytes = await readEntry(entry,budget)
      const hash = crypto.createHash('sha256').update(bytes).digest('hex')
      const matches = byHash.get(hash)
      if (!matches) { skipped++; continue }
      for (const file of matches) {
        await client.recoverDocumentFile(file.id, bytes.toString('base64'))
        restored++
      }
      byHash.delete(hash)
    } catch (error) {
      errors.push(`${entry.name.slice(0,120)}: ${error.message}`)
      if (budget.bytes > 500 * 1024 * 1024) break
    }
  }
  return { restored, skipped, errors, pending: (await client.pendingDocumentFiles()).length }
}
module.exports = { recoverDocumentBackup }
