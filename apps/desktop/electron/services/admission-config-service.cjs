const { ADMISSION_DOCUMENTS } = require('./admission-documents.cjs')

const ALLOWED_DOCUMENTS=new Set(ADMISSION_DOCUMENTS.map(doc=>doc.key))

function positiveId(value,label){const id=Number(value);if(!Number.isInteger(id)||id<=0)throw new Error(`${label} inválido.`);return id}
function parseConfig(value){if(!value)return{};if(typeof value==='object')return value;try{return JSON.parse(String(value))||{}}catch{return{}}}

class AdmissionConfigService {
  constructor({db}){this.db=db}

  documentProfiles(empresaId){
    const id=positiveId(empresaId,'Empresa')
    return this.db.db.prepare('SELECT * FROM empresa_documentos_admissionais WHERE empresa_id=? ORDER BY id').all(id).map(row=>({...row,configuracao:parseConfig(row.configuracao_json)}))
  }

  saveDocumentProfile(data){
    const empresaId=positiveId(data.empresa_id,'Empresa'), key=String(data.documento_key||'').trim()
    if(!ALLOWED_DOCUMENTS.has(key))throw new Error('Tipo de documento admissional inválido.')
    const config=data.configuracao&&typeof data.configuracao==='object'?JSON.stringify(data.configuracao):data.configuracao_json?String(data.configuracao_json):null
    this.db.db.prepare(`INSERT INTO empresa_documentos_admissionais(empresa_id,documento_key,ativo,obrigatorio,modelo_id,titulo_customizado,configuracao_json,updated_at)
      VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(empresa_id,documento_key) DO UPDATE SET ativo=excluded.ativo,obrigatorio=excluded.obrigatorio,modelo_id=excluded.modelo_id,titulo_customizado=excluded.titulo_customizado,configuracao_json=excluded.configuracao_json,updated_at=CURRENT_TIMESTAMP`)
      .run(empresaId,key,data.ativo===0?0:1,data.obrigatorio?1:0,data.modelo_id?String(data.modelo_id):null,String(data.titulo_customizado||'').trim()||null,config)
    return this.db.db.prepare('SELECT * FROM empresa_documentos_admissionais WHERE empresa_id=? AND documento_key=?').get(empresaId,key)
  }

  epiKit(empresaId,cargoId){
    const company=positiveId(empresaId,'Empresa'), cargo=positiveId(cargoId,'Cargo')
    return this.db.db.prepare(`SELECT k.*,e.nome,e.ca,e.unidade FROM cargo_epi_kits k JOIN epis e ON e.id=k.epi_id WHERE k.empresa_id=? AND k.cargo_id=? AND k.ativo=1 ORDER BY e.nome COLLATE NOCASE`).all(company,cargo)
  }

  saveEpiKit(data){
    const company=positiveId(data.empresa_id,'Empresa'),cargo=positiveId(data.cargo_id,'Cargo'),epi=positiveId(data.epi_id,'EPI')
    const quantity=String(data.quantidade_texto||'01').trim()||'01'
    if(quantity.length>20)throw new Error('Quantidade do EPI inválida.')
    this.db.db.prepare(`INSERT INTO cargo_epi_kits(empresa_id,cargo_id,epi_id,quantidade_texto,ativo,updated_at)
      VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(empresa_id,cargo_id,epi_id) DO UPDATE SET quantidade_texto=excluded.quantidade_texto,ativo=excluded.ativo,updated_at=CURRENT_TIMESTAMP`)
      .run(company,cargo,epi,quantity,data.ativo===0?0:1)
    return this.db.db.prepare('SELECT * FROM cargo_epi_kits WHERE empresa_id=? AND cargo_id=? AND epi_id=?').get(company,cargo,epi)
  }

  removeEpiKit(data){
    const company=positiveId(data.empresa_id,'Empresa'),cargo=positiveId(data.cargo_id,'Cargo'),epi=positiveId(data.epi_id,'EPI')
    this.db.db.prepare('UPDATE cargo_epi_kits SET ativo=0,updated_at=CURRENT_TIMESTAMP WHERE empresa_id=? AND cargo_id=? AND epi_id=?').run(company,cargo,epi)
    return true
  }
}

module.exports={AdmissionConfigService,parseConfig}
