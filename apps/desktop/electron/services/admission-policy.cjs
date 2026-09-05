const { ADMISSION_DOCUMENTS } = require('./admission-documents.cjs')

const REQUIRED = Object.freeze({
  contrato_experiencia:['nome','cpf','ctps','ctps_serie','admissao','cargo_id','salario_centavos','jornada_inicio','intervalo_inicio','intervalo_fim','jornada_fim','experiencia_dias','experiencia_fim'],
  ficha_registro:['nome','cpf','rg','rg_orgao','data_nascimento','naturalidade','nacionalidade','estado_civil','pai','mae','ctps','ctps_serie','pis','endereco_logradouro','endereco_numero','endereco_bairro','endereco_cidade','endereco_uf','cep','matricula_esocial','admissao','cargo_id','salario_centavos','fgts_optante','fgts_opcao_em'],
  ordem_servico:['nome','cpf','admissao','cargo_id'],
  vale_transporte:['nome','cpf','ctps','ctps_serie','cargo_id','endereco_logradouro','endereco_numero','endereco_bairro','endereco_cidade','endereco_uf','cep','vale_transporte_opcao'],
  ficha_epi:['nome','cargo_id','admissao'],
  carta_sindical:['nome','ctps','ctps_serie']
})

function hasValue(value){if(value===0||value===false)return true;return value!==null&&value!==undefined&&String(value).trim()!==''}

function buildAdmissionPlan(employee,includeCarta=false,companyProfile=[]){
  const profileByKey=new Map((companyProfile||[]).map(item=>[item.documento_key,item]))
  const role=String(employee?.cargo_nome||'Cargo não informado')
  return ADMISSION_DOCUMENTS
    .filter(doc=>{
      const profile=profileByKey.get(doc.key)
      if(profile&&Number(profile.ativo)===0)return false
      if(doc.optional&&!includeCarta&&!profile?.obrigatorio)return false
      return true
    })
    .map(doc=>{
      const profile=profileByKey.get(doc.key)
      return {...doc,title:profile?.titulo_customizado||doc.title,profile:role,required:Boolean(profile?.obrigatorio)||!doc.optional,modelId:profile?.modelo_id||null}
    })
}

function validateAdmissionDocuments(employee,selectedKeys){
  const keys=selectedKeys?.length?selectedKeys:ADMISSION_DOCUMENTS.filter(doc=>!doc.optional).map(doc=>doc.key)
  const allowed=new Set(ADMISSION_DOCUMENTS.map(doc=>doc.key)),byDocument={}
  for(const key of keys){
    if(!allowed.has(key)){byDocument[key]=['tipo_documento_invalido'];continue}
    byDocument[key]=(REQUIRED[key]||[]).filter(field=>!hasValue(employee?.[field]))
    if(!byDocument[key].length)delete byDocument[key]
  }
  return {ok:Object.keys(byDocument).length===0,byDocument}
}

function admissionDocumentFilename(index,title){return `${String(index+1).padStart(2,'0')} - ${title}.pdf`}

module.exports={REQUIRED,buildAdmissionPlan,validateAdmissionDocuments,admissionDocumentFilename}
