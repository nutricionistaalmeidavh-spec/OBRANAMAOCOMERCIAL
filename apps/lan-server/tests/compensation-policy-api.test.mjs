import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import path from 'node:path'
import test from 'node:test'
import { LanRepository } from '../src/repository.mjs'
import { createLanServer } from '../src/server.mjs'

const migrationsDir=path.resolve(import.meta.dirname,'../migrations')
const TOKEN='rh-compensation-token'
const digest=value=>createHash('sha256').update(String(value)).digest('hex')

function security({modules=['rh'],role='employee'}={}){
  return{
    serverState(){return{claimed:true,companyId:'company-rh'}},
    deviceByTokenHash(value){return value===digest(TOKEN)?{id:'device-rh',memberId:'member-rh',status:'active'}:null},
    member(id){return id==='member-rh'?{memberId:id,role,modules,channels:['desktop'],status:'active'}:null},
    touchDevice(){}
  }
}

async function fixture(options={}){
  const repository=new LanRepository({filename:':memory:'})
  repository.applyMigrations(migrationsDir)
  const company=repository.save('empresas',{razao_social:'Empresa RH API'})
  const benefit=repository.save('beneficios',{empresa_id:company.id,nome:'Café',tipo:'alimentacao',valor_padrao_centavos:0,ativo:1})
  const server=createLanServer({repository,security:security(options)})
  server.listen(0,'127.0.0.1');await once(server,'listening')
  const address=server.address()
  if(!address||typeof address==='string')throw new Error('Servidor sem porta TCP.')
  return{repository,company,benefit,server,baseUrl:`http://127.0.0.1:${address.port}`}
}

async function close(f){f.server.close();await once(f.server,'close');f.repository.close()}
const headers=()=>({authorization:`Bearer ${TOKEN}`,'content-type':'application/json'})

test('endpoint canônico salva cargo e benefícios com autorização RH',async()=>{
  const f=await fixture()
  try{
    const response=await fetch(`${f.baseUrl}/api/v1/rh/catalog/compensation-policy`,{
      method:'POST',headers:headers(),body:JSON.stringify({
        cargo:{empresa_id:f.company.id,nome:'Encanador',salario_base_centavos:300000},
        links:[{beneficio_id:f.benefit.id,valor_centavos:9000,quinzena:1,natureza:'credito',ativo:1}]
      })
    })
    assert.equal(response.status,200)
    const body=await response.json()
    assert.equal(body.cargo.nome,'Encanador')
    assert.equal(body.links[0].valor_centavos,9000)
    assert.equal(body.cargo.revision,1)
  }finally{await close(f)}
})

test('endpoint canônico rejeita perfil sem permissão RH e não grava parcialmente',async()=>{
  const f=await fixture({modules:['obra360'],role:'foreman'})
  try{
    const response=await fetch(`${f.baseUrl}/api/v1/rh/catalog/compensation-policy`,{
      method:'POST',headers:headers(),body:JSON.stringify({
        cargo:{empresa_id:f.company.id,nome:'Não salvar',salario_base_centavos:300000},
        links:[{beneficio_id:f.benefit.id,valor_centavos:9000,ativo:1}]
      })
    })
    assert.equal(response.status,403)
    assert.equal(f.repository.list('cargos',{empresa_id:f.company.id}).length,0)
  }finally{await close(f)}
})
