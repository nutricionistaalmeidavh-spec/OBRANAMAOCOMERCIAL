import domainCore from './domain-core.cjs'
const {stockWorkBalances,resolveStockMaterial}=domainCore
import { createHash } from 'node:crypto'

const clean=value=>String(value??'').trim().replace(/\s+/g,' ')
const normalize=value=>clean(value).toLocaleLowerCase('pt-BR')
const digest=value=>createHash('sha256').update(value).digest('hex')
export const materialIdentity=(workId,description,unit)=>'mat_'+digest(JSON.stringify([Number(workId),normalize(description),normalize(unit)])).slice(0,24)

/**
 * A read-through catalog from the canonical operational stock ledger.
 * There is no second balance or separately editable material master.
 */
export class FieldRdoCatalog {
  constructor({repository}){
    if(!repository?.get||!repository?.connection)throw new Error('Repositório operacional indisponível.')
    this.repository=repository
    this.db=repository.connection()
  }
  crew(companyId,workId){
    const rows=this.db.prepare(`SELECT f.id,f.nome FROM funcionarios f WHERE f.empresa_id=? AND f.deleted_at IS NULL AND f.status='ativo' AND (f.obra_atual_id=? OR EXISTS(SELECT 1 FROM funcionario_obras a WHERE a.funcionario_id=f.id AND a.obra_id=? AND a.inicio<=date('now','localtime') AND (a.fim IS NULL OR a.fim>=date('now','localtime')))) ORDER BY f.id`).all(companyId,workId,workId)
    return rows.map(row=>({id:'rdo_emp_'+digest(JSON.stringify([companyId,workId,row.id])).slice(0,24),name:row.nome,localId:row.id}))
  }
  list({companyId,workId}={}){
    const id=Number(workId),company=Number(companyId)
    if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(company)||company<1)throw new Error('Obra e empresa inválidas para o catálogo.')
    const work=this.repository.get('obras',id)
    if(!work||work.deleted_at||Number(work.empresa_id)!==company)throw new Error('Catálogo solicitado fora da obra autorizada.')
    const rows=stockWorkBalances(this.db,id,{includeZero:true})
    const materials=rows.filter(row=>row.material_uid&&row.descricao&&row.unidade).map(row=>({
      id:'mat_'+row.material_uid,
      descricao:row.descricao,unidade:row.unidade,saldo:Number(row.saldo)||0
    }))
    const fronts=this.db.prepare(`SELECT id,nome FROM frentes_obra WHERE obra_id=? AND deleted_at IS NULL ORDER BY ordem,id`).all(id)
    const services=this.db.prepare(`SELECT id,nome,frente_id FROM etapas_obra WHERE obra_id=? AND deleted_at IS NULL ORDER BY id`).all(id)
    const employees=this.crew(company,id).map(({id,name})=>({id,name}))
    const version=digest(JSON.stringify({materials,fronts,services,employees})).slice(0,32)
    return {schemaVersion:1,workId:id,materials,fronts,services,employees,version}
  }
  requireMaterial(workId,row){
    const id=Number(workId)
    const material=resolveStockMaterial(this.db,{obra_id:id,descricao:row.descricao,unidade:row.unidade})
    if(!material||!this.db.prepare('SELECT 1 FROM movimentacoes_estoque WHERE obra_id=? AND material_id=? LIMIT 1').get(id,material.id))throw new Error('Material não consta do estoque canônico desta obra.')
    if(row.material_id&&row.material_id!=='mat_'+material.uid&&!(material.original_uid&&row.material_id==='mat_'+material.original_uid)&&row.material_id!==materialIdentity(id,row.descricao,row.unidade))
      throw new Error('Identificador do material diverge do catálogo canônico da obra.')

    return material
  }
}
