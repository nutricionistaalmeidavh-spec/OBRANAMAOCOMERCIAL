import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../src/pages/DocumentsPage.tsx'),'utf8')

describe('Central de documentos comercial · integração visual do scanner',()=>{
  it('expõe a ação de digitalização nos Registros e reutiliza o modal compartilhado',()=>{
    expect(source).toContain('DocumentScannerModal')
    expect(source).toContain('canScanDocument')
    expect(source).toContain('scannerCapabilities')
    expect(source).toContain('scannerTarget')
    expect(source).toContain('Digitalizar versão assinada')
    expect(source).toContain('Promise.all([docs.reload(), files.reload()])')
  })
})
