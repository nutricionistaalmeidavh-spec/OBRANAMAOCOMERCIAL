import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require=createRequire(import.meta.url)
const { DatabaseService }=require('./database.cjs')
const { CatalogService }=require('./catalog-service.cjs')
const created:Array<{dir:string;db:any}>=[]

function setup(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fluxo-catalog-'))
  const db=new DatabaseService({dataDir:dir,migrationsDir:path.resolve(import.meta.dirname,'../../database/migrations')})
  db.open();created.push({dir,db})
  return{db,catalog:new CatalogService({db})}
}

afterEach(()=>{for(const item of created.splice(0)){item.db.close();fs.rmSync(item.dir,{recursive:true,force:true})}})

describe('CatalogService compensation policy',()=>{
  it('salva cargo e vínculos como uma única transação',()=>{
    const {catalog}=setup()
    const cafe=catalog.saveBenefit({nome:'Café policy QA',tipo:'alimentacao',valor_padrao_centavos:0})
    const transporte=catalog.saveBenefit({nome:'Vale-transporte policy QA',tipo:'transporte',valor_padrao_centavos:0})
    const result=catalog.saveCompensationPolicy({
      cargo:{nome:'Encanador policy QA',cbo:'724110',salario_base_centavos:300000},
      links:[
        {beneficio_id:cafe.id,valor_centavos:9000,quinzena:1,natureza:'credito',ativo:1},
        {beneficio_id:transporte.id,valor_centavos:25000,quinzena:1,natureza:'credito',ativo:1},
      ],
    })
    expect(result.cargo).toMatchObject({nome:'Encanador policy QA',salario_base_centavos:300000})
    expect(result.links).toHaveLength(2)
    expect(result.links.map((item:any)=>item.valor_centavos)).toEqual([9000,25000])
  })

  it('faz rollback do cargo e de todos os vínculos quando qualquer item falha',()=>{
    const {db,catalog}=setup()
    const cafe=catalog.saveBenefit({nome:'Café rollback QA',tipo:'alimentacao',valor_padrao_centavos:0})
    const beforeLinks=db.db.prepare('SELECT COUNT(*) total FROM cargo_beneficios').get().total
    expect(()=>catalog.saveCompensationPolicy({
      cargo:{nome:'Cargo rollback',salario_base_centavos:200000},
      links:[
        {beneficio_id:cafe.id,valor_centavos:10000,ativo:1},
        {beneficio_id:999999,valor_centavos:5000,ativo:1},
      ],
    })).toThrow()
    expect(db.db.prepare("SELECT COUNT(*) total FROM cargos WHERE nome='Cargo rollback'").get().total).toBe(0)
    expect(db.db.prepare('SELECT COUNT(*) total FROM cargo_beneficios').get().total).toBe(beforeLinks)
  })
})
