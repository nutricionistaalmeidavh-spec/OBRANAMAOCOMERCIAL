import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here=dirname(fileURLToPath(import.meta.url))
const read=(relative:string)=>readFileSync(resolve(here,relative),'utf8')

describe('payroll overview phases 4-8',()=>{
  it('wires spreadsheet parsing separately from canonical preview and commit',()=>{
    const main=read('../electron/main.cjs')
    const preload=read('../electron/preload.cjs')
    const source=read('../electron/services/rh-source-service.cjs')
    expect(main).toContain("'payroll-import:file-preview'")
    expect(main).toContain("'payroll-import:preview'")
    expect(main).toContain("'payroll-import:commit'")
    expect(preload).toContain("filePreview: (token, options) => call('payroll-import:file-preview'")
    expect(source).toContain('async importPreview(payload)')
    expect(source).toContain('async importCommit(payload)')
  })

  it('offers template and universal mapping with an explicit preview gate',()=>{
    const modal=read('../src/components/PayrollImportModal.tsx')
    const core=read('../../../packages/domain-core/index.cjs')
    expect(modal).toContain("value:'template',label:'Modelo Obra na Mão'")
    expect(modal).toContain("value:'universal',label:'Minha planilha'")
    expect(modal).toContain('Gerar prévia')
    expect(modal).toContain('Nenhuma divergência será sobrescrita silenciosamente')
    expect(modal).toContain('conflict.options?.map')
    expect(core).toContain("label:'Manter valor atual'")
    expect(core).toContain("label:'Usar valor da planilha'")
    expect(core).toContain("label:'Criar funcionário'")
  })

  it('exposes audit history and guarded undo',()=>{
    const modal=read('../src/components/PayrollImportModal.tsx')
    const local=read('../electron/services/payroll-service.cjs')
    expect(modal).toContain('Importações recentes')
    expect(modal).toContain('Desfazer')
    expect(local).toContain('importHistory(limit)')
    expect(local).toContain('importUndo(importacaoId)')
    expect(local).toContain('createPayrollImportEngine')
  })
})
