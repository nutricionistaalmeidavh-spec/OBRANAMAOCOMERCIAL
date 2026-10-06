type AnyRecord=Record<string,unknown>

const clean=(value:unknown)=>typeof value==='string'?value.trim():''
const cents=(value:unknown)=>Math.max(0,Math.round(Number(value)||0))

export function applyLegacyObligationCompatibility<T extends AnyRecord>(input:T):T&{
  sourceType:string
  canonicalEntity:string
  originModule:string
}{
  const sourceType=clean(input.sourceType)||'payable'
  const canonicalEntity=clean(input.canonicalEntity)||'conta'
  const originModule=clean(input.originModule)||'unknown'
  return{...input,sourceType,canonicalEntity,originModule}
}

export function buildFinanceChangeAudit(field:string,before:AnyRecord,after:AnyRecord){
  return{field,before:{...before},after:{...after}}
}

type MatchSnapshotInput={
  actorUserId:string
  matchId:string
  source:string
  confidence?:number
  transaction:AnyRecord
  allocations:Array<{obligationId:string;amountCents:number}>
  obligations:AnyRecord[]
}

export function buildMatchAuditSnapshot(input:MatchSnapshotInput){
  const byId=new Map(input.obligations.map(item=>[clean(item.id),item]))
  const allocations=input.allocations.map(allocation=>{
    const obligation=byId.get(allocation.obligationId)||{}
    return{
      obligationId:allocation.obligationId,
      amountCents:cents(allocation.amountCents),
      beneficiaryName:clean(obligation.beneficiaryName)||undefined,
      description:clean(obligation.description)||undefined,
      canonicalEntity:clean(obligation.canonicalEntity)||undefined,
      canonicalId:clean(obligation.canonicalId)||undefined,
      originModule:clean(obligation.originModule)||'unknown',
      originEntity:clean(obligation.originEntity)||undefined,
      originId:clean(obligation.originId)||undefined,
      originLabel:clean(obligation.originLabel)||undefined,
      originReason:clean(obligation.originReason)||undefined
    }
  })
  return{
    actorUserId:input.actorUserId,
    matchId:input.matchId,
    source:clean(input.source)||'manual',
    confidence:Number.isFinite(Number(input.confidence))?Number(input.confidence):undefined,
    confirmedCents:allocations.reduce((sum,item)=>sum+item.amountCents,0),
    transaction:{
      id:clean(input.transaction.id),
      accountId:clean(input.transaction.accountId)||undefined,
      date:clean(input.transaction.date)||undefined,
      description:clean(input.transaction.description)||undefined,
      amountCents:cents(input.transaction.amountCents),
      category:clean(input.transaction.category)||undefined
    },
    allocations
  }
}

export function dedupeFinanceTransactions<T extends {hash?:unknown}>(existing:Array<{hash?:unknown}>,incoming:T[]):T[]{
  const hashes=new Set(existing.map(item=>clean(item.hash)).filter(Boolean))
  const fresh:T[]=[]
  for(const item of incoming){
    const hash=clean(item.hash)
    if(!hash||hashes.has(hash))continue
    hashes.add(hash)
    fresh.push(item)
  }
  return fresh
}
