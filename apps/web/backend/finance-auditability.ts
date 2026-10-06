export type ReconciliationState='unreconciled'|'suggestion'|'partial'|'reconciled'|'divergence'|'ignored'|'transfer'|'withdrawal'

type StateInput={
  amountCents:number
  matchedCents:number
  hasSuggestion?:boolean
  divergence?:boolean
  ignored?:boolean
  internalTransfer?:boolean
  relatedWithdrawal?:boolean
}

export function obligationReconciliationState(input:StateInput):ReconciliationState{
  if(input.divergence)return'divergence'
  if(input.ignored)return'ignored'
  const amount=Math.max(0,Number(input.amountCents)||0),matched=Math.max(0,Number(input.matchedCents)||0)
  if(matched>amount)return'divergence'
  if(amount>0&&matched>=amount)return'reconciled'
  if(matched>0)return'partial'
  if(input.hasSuggestion)return'suggestion'
  return'unreconciled'
}

export function transactionReconciliationState(input:StateInput):ReconciliationState{
  if(input.internalTransfer)return'transfer'
  if(input.relatedWithdrawal)return'withdrawal'
  if(input.divergence)return'divergence'
  if(input.ignored)return'ignored'
  const amount=Math.max(0,Number(input.amountCents)||0),matched=Math.max(0,Number(input.matchedCents)||0)
  if(matched>amount)return'divergence'
  if(amount>0&&matched>=amount)return'reconciled'
  if(matched>0)return'partial'
  if(input.hasSuggestion)return'suggestion'
  return'unreconciled'
}

type AuditTx={id:string;date:string;description:string;amountCents:number;category?:string;accountLabel?:string}
type AuditObligation={id:string;beneficiaryName:string;description:string;amountCents:number;dueDate?:string;category?:string;originLabel?:string;originModule?:string;originEntity?:string;originId?:string;originReason?:string;sourceUpdatedAt?:string}
type AuditAllocation={obligationId:string;amountCents:number}
type EvidenceState='match'|'partial'|'mismatch'|'info'

function normalize(value:string){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim()
}

function dayDistance(a?:string,b?:string){
  if(!a||!b)return null
  const av=Date.parse(a+'T00:00:00Z'),bv=Date.parse(b+'T00:00:00Z')
  if(!Number.isFinite(av)||!Number.isFinite(bv))return null
  return Math.abs(Math.round((av-bv)/86400000))
}

function beneficiaryScore(description:string,name:string){
  const stop=new Set(['PIX','PAGAMENTO','PAGTO','TRANSFERENCIA','TRANSF','LTDA','ME','EPP','SA'])
  const parts=normalize(name).split(' ').filter(x=>x.length>=3&&!stop.has(x))
  if(!parts.length)return 0
  const desc=normalize(description)
  return parts.filter(x=>desc.includes(x)).length/parts.length
}

export function buildReconciliationAudit(input:{transaction:AuditTx;obligations:AuditObligation[];allocations:AuditAllocation[]}){
  const byId=new Map(input.obligations.map(item=>[item.id,item]))
  const rows=input.allocations.map(allocation=>({allocation,obligation:byId.get(allocation.obligationId)})).filter(x=>x.obligation) as Array<{allocation:AuditAllocation;obligation:AuditObligation}>
  const allocatedCents=rows.reduce((sum,row)=>sum+Math.max(0,Number(row.allocation.amountCents)||0),0)
  const exact=allocatedCents===Math.max(0,Number(input.transaction.amountCents)||0)
  const name=Math.max(0,...rows.map(row=>beneficiaryScore(input.transaction.description,row.obligation.beneficiaryName)))
  const distances=rows.map(row=>dayDistance(input.transaction.date,row.obligation.dueDate)).filter((x):x is number=>x!==null)
  const nearest=distances.length?Math.min(...distances):null
  const category=!!input.transaction.category&&rows.some(row=>row.obligation.category===input.transaction.category)
  const evidence:Array<{key:string;label:string;state:EvidenceState;detail:string}>=[
    {key:'amount',label:'Valor',state:exact?'match':'partial',detail:exact?'O valor bancário é totalmente explicado pelas obrigações selecionadas.':'O vínculo explica apenas parte do valor bancário.'},
    {key:'beneficiary',label:'Beneficiário',state:name>=.5?'match':name>0?'partial':'info',detail:name>=.5?'O beneficiário aparece de forma consistente na descrição bancária.':name>0?'Há correspondência parcial do nome do beneficiário.':'O nome do beneficiário não é evidência suficiente neste vínculo.'},
    {key:'date',label:'Data',state:nearest!==null&&nearest<=7?'match':nearest!==null&&nearest<=15?'partial':'info',detail:nearest===null?'Não há vencimento suficiente para comparar datas.':nearest<=7?`Pagamento a ${nearest} dia(s) do vencimento mais próximo.`:nearest<=15?`Pagamento a ${nearest} dias do vencimento; revisar.`:`Pagamento distante ${nearest} dias do vencimento mais próximo.`},
    {key:'category',label:'Categoria',state:category?'match':'info',detail:category?'Banco e obrigação compartilham a mesma categoria.':'Categoria não foi usada como evidência confirmatória.'}
  ]
  return{
    bank:{...input.transaction},
    system:{
      allocatedCents,
      obligations:rows.map(row=>({...row.obligation,allocatedCents:row.allocation.amountCents}))
    },
    evidence
  }
}
