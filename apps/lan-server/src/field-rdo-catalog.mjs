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
  list({companyId,workId}={}){
    const id=Number(workId),company=Number(companyId)
    if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(company)||company<1)throw new Error('Obra e empresa inválidas para o catálogo.')
    const work=this.repository.get('obras',id)
    if(!work||work.deleted_at||Number(work.empresa_id)!==company)throw new Error('Catálogo solicitado fora da obra autorizada.')
    const rows=this.db.prepare(`
      SELECT MIN(trim(descricao)) AS descricao, trim(unidade) AS unidade,
        ROUND(SUM(CASE WHEN tipo='saida' THEN -quantidade ELSE quantidade END),6) AS saldo
      FROM movimentacoes_estoque
      WHERE obra_id=? AND descricao IS NOT NULL AND trim(descricao)<>'' AND trim(unidade)<>''
      GROUP BY lower(trim(descricao)),lower(trim(unidade))
      ORDER BY descricao,unidade
      LIMIT 1200`).all(id)
    const materials=rows.map(row=>({
      id:materialIdentity(id,row.descricao,row.unidade),
      descricao:clean(row.descricao),unidade:clean(row.unidade),saldo:Number(row.saldo)||0
    }))
    const fronts=this.db.prepare(`SELECT id,nome FROM frentes_obra WHERE obra_id=? AND deleted_at IS NULL ORDER BY ordem,id LIMIT 250`).all(id)
    const services=this.db.prepare(`SELECT id,nome,frente_id FROM etapas_obra WHERE obra_id=? AND deleted_at IS NULL ORDER BY id LIMIT 250`).all(id)
    const version=digest(JSON.stringify({materials,fronts,services})).slice(0,32)
    return {schemaVersion:1,workId:id,materials,fronts,services,version}
  }
  requireMaterial(workId,row){
    const id=Number(workId)
    const found=this.db.prepare(`SELECT 1 AS found FROM movimentacoes_estoque WHERE obra_id=? AND lower(trim(descricao))=lower(trim(?))
      AND lower(trim(unidade))=lower(trim(?)) LIMIT 1`).get(id,clean(row.descricao),clean(row.unidade))
    if(!found)throw new Error('Material não consta do estoque canônico desta obra.')
    if(row.material_id&&row.material_id!==materialIdentity(id,row.descricao,row.unidade))
      throw new Error('Identificador do material diverge do catálogo canônico da obra.')
    return true
  }
}
