import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require=createRequire(import.meta.url)
const { DatabaseService }=require('./database.cjs')
const { PayrollService }=require('./payroll-service.cjs')
const { CatalogService }=require('./catalog-service.cjs')
const created:Array<{dir:string;db:any}>=[]

function setup(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-folha-'))
  const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')})
  db.open();created.push({dir,db})
  const catalog=new CatalogService({db}),payroll=new PayrollService({db})
  const company=db.save('empresas',{razao_social:'Teste',status:'ativa'})
  const cargo=catalog.saveCargo({nome:'Encanador teste',cbo:'724110',salario_base_centavos:250000})
  const benefit=catalog.saveBenefit({nome:'Café teste',tipo:'alimentacao',valor_padrao_centavos:18000})
  catalog.saveLink({cargo_id:cargo.id,beneficio_id:benefit.id,valor_centavos:18000,quinzena:1,natureza:'credito',ativo:1})
  const employee=db.save('funcionarios',{empresa_id:company.id,cargo_id:cargo.id,nome:'Funcionário Teste',status:'ativo',salario_centavos:250000})
  return {db,catalog,payroll,cargo,employee}
}

afterEach(()=>{for(const item of created.splice(0)){item.db.close();fs.rmSync(item.dir,{recursive:true,force:true})}})

describe('folha automática por cargo',()=>{
  it('pré-cria salário e benefícios fixos e aceita variáveis',()=>{
    const {payroll,employee}=setup()
    const first=payroll.getEmployee({funcionario_id:employee.id,competencia:'2026-08'})
    expect(first.launches.some((item:any)=>item.tipo==='salario'&&!item.editavel)).toBe(true)
    expect(first.launches.some((item:any)=>item.descricao==='Café teste'&&!item.editavel)).toBe(true)
    payroll.saveVariable({funcionario_id:employee.id,competencia:'2026-08',tipo:'diaria',descricao:'Diária',natureza:'credito',quinzena:1,valor_centavos:10000})
    const updated=payroll.getEmployee({funcionario_id:employee.id,competencia:'2026-08'})
    expect(updated.launches.find((item:any)=>item.tipo==='diaria').editavel).toBe(1)
  })

  it('confirma a quinzena e bloqueia alteração do histórico pago',()=>{
    const {payroll,employee}=setup()
    payroll.getEmployee({funcionario_id:employee.id,competencia:'2026-08'})
    const payment=payroll.confirm({funcionario_id:employee.id,competencia:'2026-08',quinzena:1,data:'2026-08-15',forma_pagamento:'PIX'})
    expect(payment.status).toBe('pago')
    expect(payment.valor_centavos).toBe(268000)
    expect(()=>payroll.confirm({funcionario_id:employee.id,competencia:'2026-08',quinzena:1,data:'2026-08-15'})).toThrow(/confirmada/i)
  })
})


describe('visão geral da folha',()=>{
  it('consolida lançamentos e despesas da empresa por competência sem duplicar a própria folha',()=>{
    const {db,payroll,employee}=setup()
    payroll.getEmployee({funcionario_id:employee.id,competencia:'2026-10'})
    payroll.saveVariable({funcionario_id:employee.id,competencia:'2026-10',tipo:'vale_salario',descricao:'Vale / adiantamento',natureza:'credito',quinzena:2,valor_centavos:50000})
    const category=db.save('categorias_financeiras',{nome:'Impostos teste',natureza:'despesa',grupo_dre:'operacional',ativa:1})
    const folhaCategory=db.save('categorias_financeiras',{nome:'Folha de pagamento',natureza:'despesa',grupo_dre:'operacional',ativa:1})
    const companyId=db.get('funcionarios',employee.id).empresa_id
    db.save('contas',{tipo:'pagar',empresa_id:companyId,categoria_id:category.id,descricao:'DAS Simples Nacional',competencia:'2026-10',vencimento:'2026-10-20',valor_bruto_centavos:435000,valor_centavos:435000,status:'pendente'})
    db.save('contas',{tipo:'pagar',empresa_id:companyId,categoria_id:folhaCategory.id,descricao:'Folha Funcionário Teste',competencia:'2026-10',vencimento:'2026-10-05',valor_bruto_centavos:318000,valor_centavos:318000,status:'pendente'})

    const overview=payroll.overview({competencia:'2026-10',empresa_id:companyId})
    expect(overview.contract_version).toBe(1)
    expect(overview.employees).toHaveLength(1)
    expect(overview.employees[0].remuneracao.salario_centavos).toBe(250000)
    expect(overview.employees[0].remuneracao.vale_adiantamento_centavos).toBe(50000)
    expect(overview.employees[0].beneficios.alimentacao_centavos).toBe(18000)
    expect(overview.company_expenses.map((item:any)=>item.descricao)).toEqual(['DAS Simples Nacional'])
    expect(overview.totals.custo_competencia_centavos).toBe(753000)
  })
})
