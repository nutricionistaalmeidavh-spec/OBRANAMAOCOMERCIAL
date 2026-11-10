function policyKey(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function readReceiptPolicy(value){
  const text=String(value||'').trim()
  if(text.startsWith('{')){let policy;try{policy=JSON.parse(text)}catch{throw new Error('Preferência de recibos inválida. Revise a seleção da empresa.')}
    if(policy.version!==1||!Array.isArray(policy.benefitIds)||policy.benefitIds.some(id=>!Number.isSafeInteger(id)||id<=0))throw new Error('Preferência de recibos inválida.')
    return {benefitIds:[...new Set(policy.benefitIds)],point:policy.point!==false,receipts:policy.receipts!==false}
  }
  return {legacy:text,point:true,receipts:true}
}
function filterBenefitsByPolicy(benefits,policy){
  const selected=readReceiptPolicy(policy)
  if(selected.benefitIds){const ids=new Set(selected.benefitIds);return (benefits||[]).filter(item=>ids.has(Number(item.beneficio_id??item.id)))}
  const configured=selected.legacy.split(',').map(policyKey).filter(Boolean)
  if(!configured.length)return benefits||[]
  return(benefits||[]).filter(item=>configured.some(key=>policyKey(item.descricao).includes(key)||key.includes(policyKey(item.descricao))))
}
function receiptDocumentSelection(payload,policy){const saved=readReceiptPolicy(policy);return {point:payload?.point===undefined?saved.point:payload.point!==false,receipts:payload?.receipts===undefined?saved.receipts:payload.receipts!==false}}
class ReceiptPolicyService{
  constructor({dataAccess}){this.dataAccess=dataAccess}
  async get(){const [companies,benefits]=await Promise.all([this.dataAccess.list('empresas'),this.dataAccess.list('beneficios')]);return (companies||[]).filter(c=>!c.deleted_at).map(company=>{const available=(benefits||[]).filter(b=>b.ativo&&!b.deleted_at&&(!b.empresa_id||Number(b.empresa_id)===Number(company.id)));const saved=readReceiptPolicy(company.politica_recibos);return {companyId:company.id,companyName:company.nome_fantasia||company.razao_social,revision:company.revision,point:saved.point,receipts:saved.receipts,benefits:available.map(b=>({id:b.id,name:b.nome})),benefitIds:filterBenefitsByPolicy(available.map(b=>({...b,descricao:b.nome})),company.politica_recibos).map(b=>b.id)}})}
  async save(payload){const company=await this.dataAccess.get('empresas',Number(payload.companyId));if(!company)throw new Error('Empresa não encontrada.');const benefits=await this.dataAccess.list('beneficios');if(!Array.isArray(payload.benefitIds)||payload.benefitIds.some(id=>!Number.isSafeInteger(id)||!benefits.some(b=>b.id===id&&b.ativo&&(!b.empresa_id||Number(b.empresa_id)===Number(company.id)))))throw new Error('Benefício inválido para esta empresa.');const politica_recibos=JSON.stringify({version:1,benefitIds:[...new Set(payload.benefitIds)],point:payload.point!==false,receipts:payload.receipts!==false});await this.dataAccess.save('empresas',{...company,revision:payload.revision??company.revision,politica_recibos});return this.get()}
}
module.exports={ReceiptPolicyService,readReceiptPolicy,filterBenefitsByPolicy,receiptDocumentSelection}
