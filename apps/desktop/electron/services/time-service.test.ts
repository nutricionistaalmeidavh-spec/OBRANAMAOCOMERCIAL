import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require=createRequire(import.meta.url)
const {DatabaseService}=require('./database.cjs')
const {TimeService}=require('./time-service.cjs')
const {parseEmployeeIdentity}=require('./import-service.cjs')
const created:Array<{dir:string,db:any}>=[]

function setup(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-ponto-'))
  const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')})
  db.open();created.push({dir,db})
  const company=db.save('empresas',{razao_social:'Empresa Teste',status:'ativa'})
  const employee=db.save('funcionarios',{empresa_id:company.id,nome:'Pessoa Teste',status:'ativo',jornada_inicio:'07:00',intervalo_inicio:'11:00',intervalo_fim:'12:00',jornada_fim:'17:00'})
  return {db,employee,time:new TimeService({db,fileService:{}})}
}

afterEach(()=>{for(const item of created.splice(0)){item.db.close();fs.rmSync(item.dir,{recursive:true,force:true})}})

describe('folha de ponto mensal',()=>{
  it('preenche todos os dias com variações estáveis e preserva fins de semana',()=>{
    const {employee,time}=setup()
    const first=time.autoFill({funcionario_id:employee.id,competencia:'2026-08'})
    const second=time.autoFill({funcionario_id:employee.id,competencia:'2026-08'})
    expect(first.marks).toHaveLength(31)
    expect(second.marks.map((x:any)=>x.entrada)).toEqual(first.marks.map((x:any)=>x.entrada))
    expect(first.marks.filter((x:any)=>x.tipo==='trabalho').every((x:any)=>x.entrada!=='07:00'&&x.intervalo_saida!=='11:00'&&x.intervalo_entrada!=='12:00'&&x.saida!=='17:00')).toBe(true)
    expect(first.marks.filter((x:any)=>/sabado|domingo/.test(x.tipo)).every((x:any)=>!x.entrada&&!x.saida)).toBe(true)
  })

  it('identifica cargo no nome da planilha sem mantê-lo no nome do funcionário',()=>{
    expect(parseEmployeeIdentity('Adenir encanador')).toEqual({name:'Adenir',roleHint:'Encanador'})
    expect(parseEmployeeIdentity('Carlos - ajudante')).toEqual({name:'Carlos',roleHint:'Ajudante de Encanador'})
  })
})
