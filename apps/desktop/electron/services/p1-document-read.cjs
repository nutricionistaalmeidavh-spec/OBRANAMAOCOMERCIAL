const {createHash}=require('node:crypto')
const path=require('node:path')
const MAX_BYTES=2*1024*1024
function safeFile(document,file,data){
 const bytes=Buffer.from(data)
 if(bytes.length<5||bytes.length>MAX_BYTES)throw new Error('Arquivo documental ausente ou excede 2 MB para consulta Web.')
 const id=Number(document?.id)
 if(!Number.isSafeInteger(id)||id<1)throw new Error('Documento sem identidade canônica.')
 const ext=path.extname(String(file?.nome_original||'')).toLowerCase()
 const mime=String(file?.mime_type||(
  ext==='.pdf'?'application/pdf':['.jpg','.jpeg'].includes(ext)?'image/jpeg':ext==='.png'?'image/png':'' ))
 const signature=mime==='application/pdf'?bytes.subarray(0,5).toString('ascii')==='%PDF-':
  mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
  mime==='image/png'?[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):false
 if(!signature)throw new Error('Tipo documental não suportado ou conteúdo incompatível.')
 const name=String(file?.nome_original||'documento'+ext)
 if(!name||name.length>120||/[\\/\x00-\x1f]/.test(name))throw new Error('Nome de documento inseguro.')
 return{localId:id,name,mimeType:mime,sha256:createHash('sha256').update(bytes).digest('hex'),
   data:bytes.toString('base64'),sizeBytes:bytes.length}
}
module.exports={safeFile,MAX_BYTES}
