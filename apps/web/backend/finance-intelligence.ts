type BasisInput={
  accounts?:Array<Record<string,unknown>>
  transactions?:Array<Record<string,unknown>>
  openObligations?:Array<Record<string,unknown>>
  reconciliationSuggestions?:Array<Record<string,unknown>>
  confirmedMatches?:Array<Record<string,unknown>>
}

type DivergenceInput={
  today?:string
  transactions:Array<Record<string,unknown>>
  obligations:Array<Record<string,unknown>>
  suggestions:Array<Record<string,unknown>>
}

const text=(value:unknown)=>typeof value==='string'?value:''
const number=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0
const array=(value:unknown)=>Array.isArray(value)?value as Array<Record<string,unknown>>:[]

function reference(item:Record<string,unknown>,fields:string[]){
  const out:Record<string,unknown>={id:text(item.id)}
  for(const field of fields)if(item[field]!==undefined&&item[field]!==null&&item[field]!=='')out[field]=item[field]
  return out
}

export function buildFinanceAnalysisBasis(input:BasisInput){
  const transactions=array(input.transactions).slice(0,12)
  const obligations=array(input.openObligations).slice(0,12)
  const suggestions=array(input.reconciliationSuggestions).slice(0,12)
  const confirmed=array(input.confirmedMatches).slice(0,12)
  return{
    label:'Base usada nesta análise',
    sections:[
      {
        key:'bank',
        label:'Extratos bancários',
        count:transactions.length,
        references:transactions.map(item=>reference(item,['date','description','amount','category','account']))
      },
      {
        key:'system',
        label:'Obrigações do sistema',
        count:obligations.length,
        references:obligations.map(item=>reference(item,['beneficiary','description','expected','matched','remaining','dueDate','category']))
      },
      {
        key:'reconciliation',
        label:'Conciliações',
        count:suggestions.length+confirmed.length,
        references:[
          ...suggestions.map(item=>{
            const transaction=(item.transaction&&typeof item.transaction==='object'?item.transaction:{}) as Record<string,unknown>
            const suggestion=(item.suggestion&&typeof item.suggestion==='object'?item.suggestion:{}) as Record<string,unknown>
            return{id:text(transaction.id),kind:'suggestion',confidence:number(suggestion.confidence)}
          }),
          ...confirmed.map(item=>({id:text(item.id),kind:'confirmed',transactionId:text(item.transactionId)}))
        ]
      }
    ]
  }
}

function suggestionMeta(raw:Record<string,unknown>){
  const suggestion=(raw.suggestion&&typeof raw.suggestion==='object'?raw.suggestion:{}) as Record<string,unknown>
  const transaction=(raw.transaction&&typeof raw.transaction==='object'?raw.transaction:{}) as Record<string,unknown>
  const audit=(suggestion.audit&&typeof suggestion.audit==='object'?suggestion.audit:{}) as Record<string,unknown>
  const evidence=array(audit.evidence)
  return{suggestion,transaction,evidence}
}

function item(type:string,severity:'info'|'warning'|'critical',title:string,description:string,extra:Record<string,unknown>={}){
  return{type,severity,title,description,...extra}
}

export function detectFinanceDivergences(input:DivergenceInput){
  const result:Array<Record<string,unknown>>=[],today=text(input.today)||new Date().toISOString().slice(0,10)
  const suggestions=array(input.suggestions)
  const suggestedTx=new Set(suggestions.map(raw=>text((raw.transaction as Record<string,unknown>|undefined)?.id)).filter(Boolean))
  const suggestedObligations=new Set<string>(),duplicateTxIds=new Set<string>()
  const duplicateGroups=new Map<string,Array<Record<string,unknown>>>()
  for(const tx of array(input.transactions)){
    if(text(tx.direction)!=='debit'||text(tx.accountOwnership)==='personal'||tx.internalTransfer===true||tx.relatedWithdrawal===true)continue
    const accountId=text(tx.accountId),date=text(tx.date),amount=number(tx.amountCents),direction=text(tx.direction),description=text(tx.normalized)||text(tx.description)
    if(!accountId||!date||!amount||!description)continue
    const key=[accountId,date,amount,direction,description].join('|')
    const group=duplicateGroups.get(key)||[]
    group.push(tx)
    duplicateGroups.set(key,group)
  }
  for(const group of duplicateGroups.values()){
    if(group.length<2)continue
    const transactionIds=group.map(x=>text(x.id)).filter(Boolean)
    transactionIds.forEach(id=>duplicateTxIds.add(id))
    result.push(item('potential_duplicate_bank','warning','Possível lançamento bancário duplicado','Dois ou mais lançamentos têm a mesma conta, data, valor, direção e descrição.',{transactionIds,amountCents:number(group[0].amountCents),date:group[0].date}))
  }
  for(const raw of suggestions){
    const {suggestion}=suggestionMeta(raw)
    for(const allocation of array(suggestion.allocations)){const id=text(allocation.obligationId);if(id)suggestedObligations.add(id)}
  }

  for(const tx of array(input.transactions)){
    if(text(tx.direction)!=='debit'||text(tx.accountOwnership)==='personal'||tx.internalTransfer===true||tx.relatedWithdrawal===true)continue
    const amount=number(tx.amountCents),matched=number(tx.matchedCents),id=text(tx.id)
    if(matched>amount)result.push(item('transaction_overallocated','critical','Conciliação excede o lançamento','O valor conciliado é maior que a saída bancária.',{transactionId:id,amountCents:amount,differenceCents:matched-amount}))
    else if(matched>0&&matched<amount)result.push(item('partial_reconciliation','warning','Pagamento parcialmente explicado','Parte da saída bancária ainda não está vinculada a obrigações.',{transactionId:id,amountCents:amount,differenceCents:amount-matched}))
    else if(matched===0&&!suggestedTx.has(id)&&!duplicateTxIds.has(id))result.push(item('bank_without_obligation','warning','Saída bancária sem obrigação encontrada','Existe uma saída bancária sem vínculo confirmado e sem sugestão de obrigação.',{transactionId:id,amountCents:amount,date:tx.date,description:tx.description}))
  }

  for(const obligation of array(input.obligations)){
    const amount=number(obligation.amountCents),matched=number(obligation.matchedCents),remaining=Math.max(0,number(obligation.remainingCents)||amount-matched),id=text(obligation.id)
    if(matched>amount)result.push(item('obligation_overallocated','critical','Obrigação conciliada acima do previsto','O total conciliado excede o valor canônico da obrigação.',{obligationId:id,amountCents:amount,differenceCents:matched-amount}))
    else if(matched>0&&remaining>0)result.push(item('partial_reconciliation','warning','Obrigação parcialmente comprovada','A obrigação ainda possui saldo sem comprovação bancária.',{obligationId:id,amountCents:amount,differenceCents:remaining}))
    else if(remaining>0&&!suggestedObligations.has(id)&&(!text(obligation.dueDate)||text(obligation.dueDate)<=today))result.push(item('obligation_without_payment','warning','Obrigação sem pagamento encontrado','A obrigação está em aberto e não possui pagamento confirmado nem sugestão bancária.',{obligationId:id,amountCents:amount,differenceCents:remaining,beneficiaryName:obligation.beneficiaryName,dueDate:obligation.dueDate}))
  }

  for(const raw of suggestions){
    const {suggestion,transaction,evidence}=suggestionMeta(raw),transactionId=text(transaction.id),kind=text(suggestion.kind)
    const allocations=array(suggestion.allocations)
    const obligationIds=allocations.map(x=>text(x.obligationId)).filter(Boolean)
    if(kind==='bundle')result.push(item('grouped_payment','info','Possível pagamento agrupado',`Um único lançamento pode quitar ${allocations.length} obrigações.`,{transactionId,obligationIds}))
    if(kind==='partial')result.push(item('possible_split_payment','info','Possível pagamento dividido','O lançamento parece explicar apenas parte de uma obrigação.',{transactionId,obligationIds}))
    const beneficiary=evidence.find(x=>text(x.key)==='beneficiary')
    if(beneficiary&&text(beneficiary.state)!=='match')result.push(item('beneficiary_review','warning','Beneficiário precisa de revisão',text(beneficiary.detail)||'O beneficiário não é evidência forte para esta sugestão.',{transactionId,obligationIds}))
    const date=evidence.find(x=>text(x.key)==='date')
    if(date&&text(date.state)!=='match')result.push(item('date_review','info','Data precisa de revisão',text(date.detail)||'A data bancária está distante do vencimento da obrigação.',{transactionId,obligationIds}))
  }

  const seen=new Set<string>()
  return result.filter(row=>{
    const key=[row.type,row.transactionId||'',row.obligationId||'',JSON.stringify(row.obligationIds||[])].join('|')
    if(seen.has(key))return false
    seen.add(key)
    return true
  })
}
