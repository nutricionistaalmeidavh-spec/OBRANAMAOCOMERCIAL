export type ReconciliationState='unreconciled'|'suggestion'|'partial'|'reconciled'|'divergence'|'ignored'|'transfer'|'withdrawal'

const LABELS:Record<ReconciliationState,string>={
  unreconciled:'Não conciliado',
  suggestion:'Sugestão',
  partial:'Parcial',
  reconciled:'Conciliado',
  divergence:'Divergência',
  ignored:'Ignorado',
  transfer:'Transferência',
  withdrawal:'Retirada'
}

export function reconciliationLabel(state:ReconciliationState|string){
  return LABELS[state as ReconciliationState]||LABELS.unreconciled
}

export function reconciliationTone(state:ReconciliationState|string){
  if(state==='reconciled'||state==='transfer')return'ok'
  if(state==='suggestion'||state==='partial'||state==='withdrawal')return'warn'
  if(state==='divergence')return'bad'
  return''
}

export function coveragePercent(expectedCents:number,matchedCents:number){
  const expected=Math.max(0,Number(expectedCents)||0),matched=Math.max(0,Number(matchedCents)||0)
  if(!expected)return 0
  return Math.max(0,Math.min(100,Math.round(matched/expected*100)))
}

type ProvenanceLike={
  originModule?:string
  originEntity?:string
  originLabel?:string
  beneficiaryName?:string
}

export function provenanceTrail(input:ProvenanceLike){
  const module=String(input.originModule||'').trim()
  const entity=String(input.originEntity||'').trim()
  const label=String(input.originLabel||'').trim()
  if(module==='rh'&&entity==='folhas_pagamento')return['RH',label||'Folha de pagamento','Conta a pagar','Financeiro']
  if(module==='procurement'&&entity==='pedidos_compra')return['Compras',label||'Pedido de compra',String(input.beneficiaryName||'Fornecedor'),'Conta a pagar','Financeiro']
  if(module==='contracts'&&entity==='contratos_obra')return['Contratos',label||'Contrato',String(input.beneficiaryName||'Contratado'),'Conta a pagar','Financeiro']
  if(module==='measurements'&&entity==='medicoes')return['Medições',label||'Medição','Conta financeira','Financeiro']
  if(module==='finance'&&entity==='contas')return['Financeiro',label||'Conta financeira']
  if(module==='finance'&&entity==='importacoes')return['Financeiro',label||'Importação','Conta financeira']
  return[label||'Origem não detalhada','Financeiro']
}
