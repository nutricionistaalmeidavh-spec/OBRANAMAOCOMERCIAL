import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { afterEach, describe, expect, it } from 'vitest'

const require=createRequire(import.meta.url)
const { PayrollExportService }=require('./payroll-export-service.cjs')

const dirs:string[]=[]
const temp=()=>{const dir=mkdtempSync(join(tmpdir(),'payroll-export-'));dirs.push(dir);return dir}
afterEach(()=>{while(dirs.length)rmSync(dirs.pop()!,{recursive:true,force:true})})

const overview={
  contract_version:1,
  competencia:'2026-10',
  filters:{empresa_id:1,obra_id:2},
  employees:[{
    funcionario_id:10,funcionario_nome:'Victor Teste',cargo_nome:'Encanador',
    remuneracao:{salario_centavos:250000,vale_adiantamento_centavos:50000,diarias_centavos:12000,empreitas_centavos:0,outros_centavos:0},
    beneficios:{alimentacao_centavos:30000,transporte_centavos:15000,outros_centavos:0},
    descontos:{faltas_centavos:8000,outros_centavos:2000},
    encargos:{inss_centavos:22000,fgts_centavos:20000,outros_centavos:5000},
    total_funcionario_centavos:347000,
    custo_empresa_centavos:394000
  }],
  company_expenses:[{id:5,descricao:'Simples Nacional',categoria_nome:'Impostos',valor_centavos:120000,vencimento:'2026-10-20'}],
  totals:{
    by_column_centavos:{
      'remuneracao.salario':250000,'remuneracao.vale_adiantamento':50000,'remuneracao.diarias':12000,'remuneracao.empreitas':0,'remuneracao.outros':0,
      'beneficios.alimentacao':30000,'beneficios.transporte':15000,'beneficios.outros':0,
      'descontos.faltas':8000,'descontos.outros':2000,'encargos.inss':22000,'encargos.fgts':20000,'encargos.outros':5000
    },
    total_funcionarios_centavos:347000,
    custo_funcionarios_centavos:394000,
    despesas_empresa_centavos:120000,
    custo_competencia_centavos:514000
  }
}

describe('PayrollExportService',()=>{
  it('exporta a visão canônica para Excel sem mutar a origem',async()=>{
    const dir=temp(),file=join(dir,'folha.xlsx')
    let requested:any=null
    const service=new PayrollExportService({
      payroll:{overview:async(payload:any)=>{requested=payload;return structuredClone(overview)}},
      dialog:{showSaveDialog:async()=>({canceled:false,filePath:file})}
    })
    const result=await service.export({format:'xlsx',competencia:'2026-10',empresa_id:1,obra_id:2,empresa_nome:'MH Hidráulica',obra_nome:'Obra Centro'})
    expect(requested).toEqual({competencia:'2026-10',empresa_id:1,obra_id:2})
    expect(result).toMatchObject({canceled:false,format:'xlsx',employees:1,expenses:1,total_centavos:514000})
    expect(existsSync(file)).toBe(true)

    const workbook=new ExcelJS.Workbook()
    await workbook.xlsx.readFile(file)
    const sheet=workbook.getWorksheet('Visão geral')!
    expect(sheet.getCell('A1').value).toBe('Obra na Mão - Visão geral da folha')
    expect(String(sheet.getCell('A2').value)).toContain('MH Hidráulica')
    expect(String(sheet.getCell('A6').value)).toContain('Victor Teste')
    expect(sheet.getCell('B6').value).toBe(2500)
  })

  it('gera PDF compartilhável com resumo e seções por grupo',async()=>{
    const dir=temp(),file=join(dir,'folha.pdf')
    const service=new PayrollExportService({
      payroll:{overview:async()=>structuredClone(overview)},
      dialog:{showSaveDialog:async()=>({canceled:false,filePath:file})}
    })
    const result=await service.export({format:'pdf',competencia:'2026-10',empresa_id:1})
    expect(result).toMatchObject({canceled:false,format:'pdf',total_centavos:514000})
    const bytes=readFileSync(file)
    expect(bytes.subarray(0,4).toString()).toBe('%PDF')
    expect(bytes.length).toBeGreaterThan(1000)
  })

  it('não grava arquivo quando o usuário cancela o diálogo',async()=>{
    let calls=0
    const service=new PayrollExportService({
      payroll:{overview:async()=>{calls++;return structuredClone(overview)}},
      dialog:{showSaveDialog:async()=>({canceled:true,filePath:''})}
    })
    const result=await service.export({format:'xlsx',competencia:'2026-10'})
    expect(result).toEqual({canceled:true,format:'xlsx'})
    expect(calls).toBe(1)
  })

  it('rejeita formato fora de Excel/PDF antes de abrir diálogo',async()=>{
    const service=new PayrollExportService({
      payroll:{overview:async()=>structuredClone(overview)},
      dialog:{showSaveDialog:async()=>({canceled:true,filePath:''})}
    })
    await expect(service.export({format:'csv',competencia:'2026-10'})).rejects.toThrow(/formato de exportação inválido/i)
  })
})
