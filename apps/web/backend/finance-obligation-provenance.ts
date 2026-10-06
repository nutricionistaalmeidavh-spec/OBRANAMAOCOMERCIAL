export type FinanceProvenance={
  canonicalEntity?:string
  canonicalId?:string
  originModule?:string
  originEntity?:string
  originId?:string
  originLabel?:string
  originReason?:string
}

type ObligationIdentity=FinanceProvenance&{sourceKey?:string}

const clean=(value:unknown)=>typeof value==='string'?value.trim():''

export function normalizeFinanceProvenance(input:Record<string,unknown>):FinanceProvenance{
  const canonicalEntity=clean(input.canonicalEntity)
  const canonicalId=clean(input.canonicalId)
  const originModule=clean(input.originModule)
  const originEntity=clean(input.originEntity)
  const originId=clean(input.originId)
  const originLabel=clean(input.originLabel)
  const originReason=clean(input.originReason)
  const out:FinanceProvenance={}
  if(canonicalEntity&&canonicalId){
    out.canonicalEntity=canonicalEntity
    out.canonicalId=canonicalId
  }
  if(originModule)out.originModule=originModule
  if(originEntity)out.originEntity=originEntity
  if(originId)out.originId=originId
  if(originLabel)out.originLabel=originLabel
  if(originReason)out.originReason=originReason
  return out
}

export function financeCanonicalKey(input:ObligationIdentity){
  const provenance=normalizeFinanceProvenance(input as Record<string,unknown>)
  return provenance.canonicalEntity&&provenance.canonicalId
    ? provenance.canonicalEntity+'|'+provenance.canonicalId
    : ''
}

export function matchFinanceObligation<T extends ObligationIdentity>(current:T[],incoming:ObligationIdentity):T|undefined{
  const canonicalKey=financeCanonicalKey(incoming)
  if(canonicalKey){
    const canonical=current.find(item=>financeCanonicalKey(item)===canonicalKey)
    if(canonical)return canonical
  }
  const sourceKey=clean(incoming.sourceKey)
  return sourceKey?current.find(item=>clean(item.sourceKey)===sourceKey):undefined
}

function isGenericFinanceOrigin(input:FinanceProvenance){
  return input.originModule==='finance'&&input.originEntity==='contas'
}

export function mergeFinanceProvenance(existing:FinanceProvenance,incoming:FinanceProvenance):FinanceProvenance{
  const a=normalizeFinanceProvenance(existing as Record<string,unknown>)
  const b=normalizeFinanceProvenance(incoming as Record<string,unknown>)
  const canonical={
    canonicalEntity:b.canonicalEntity||a.canonicalEntity,
    canonicalId:b.canonicalId||a.canonicalId
  }
  const preferExistingOrigin=isGenericFinanceOrigin(b)&&a.originModule&&a.originEntity&&!isGenericFinanceOrigin(a)
  const origin=preferExistingOrigin?a:b
  return normalizeFinanceProvenance({...canonical,...origin} as Record<string,unknown>)
}


export function mergeFinanceObligationIdentity(existing:ObligationIdentity,incoming:ObligationIdentity):FinanceProvenance&{sourceKey?:string}{
  const provenance=mergeFinanceProvenance(existing,incoming)
  const sourceKey=clean(existing.sourceKey)||clean(incoming.sourceKey)
  return sourceKey?{...provenance,sourceKey}:provenance
}
