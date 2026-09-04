const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { afterEach, describe, expect, it } = require('vitest')
const { PDFDocument } = require('pdf-lib')

const tempDirs=[]
afterEach(()=>{
  while(tempDirs.length){
    const dir=tempDirs.pop()
    fs.rmSync(dir,{recursive:true,force:true})
  }
})

async function pdfWithWidth(filePath,width){
  const pdf=await PDFDocument.create()
  pdf.addPage([width,200])
  fs.writeFileSync(filePath,await pdf.save())
}

describe('monthly document batch',()=>{
  it('merges point then receipts employee by employee',async()=>{
    const { mergeGeneratedPdfs } = require('./time-service.cjs')
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'commercial-batch-test-'))
    tempDirs.push(dir)
    const files=['a-point.pdf','a-receipt.pdf','b-point.pdf','b-receipt.pdf'].map((name)=>path.join(dir,name))
    await pdfWithWidth(files[0],101)
    await pdfWithWidth(files[1],102)
    await pdfWithWidth(files[2],201)
    await pdfWithWidth(files[3],202)
    const bytes=await mergeGeneratedPdfs([
      {ok:true,documents:{point:{path:files[0]},receipt:{path:files[1]}}},
      {ok:true,documents:{point:{path:files[2]},receipt:{path:files[3]}}}
    ],{point:true,receipts:true})
    const merged=await PDFDocument.load(bytes)
    expect(merged.getPages().map((page)=>page.getWidth())).toEqual([101,102,201,202])
  })

  it('prints only the selected document type',async()=>{
    const { mergeGeneratedPdfs } = require('./time-service.cjs')
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'commercial-batch-test-'))
    tempDirs.push(dir)
    const point=path.join(dir,'point.pdf'), receipt=path.join(dir,'receipt.pdf')
    await pdfWithWidth(point,301)
    await pdfWithWidth(receipt,302)
    const bytes=await mergeGeneratedPdfs([{ok:true,documents:{point:{path:point},receipt:{path:receipt}}}],{point:false,receipts:true})
    const merged=await PDFDocument.load(bytes)
    expect(merged.getPages().map((page)=>page.getWidth())).toEqual([302])
  })
})
