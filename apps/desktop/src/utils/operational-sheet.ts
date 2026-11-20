export function parseBrDecimal(raw:unknown):number|null {
  if(typeof raw==='number')return Number.isFinite(raw)?raw:null
  if(typeof raw!=='string'||!raw.trim())return null
  const str=raw.trim().replace(/[\s\u00a0\u202f]/g,'')
  if(!/^[+-]?(?:\d{1,3}(?:\.\d{3})+,\d+|\d+,\d+|\d+(?:\.\d+)?)$/.test(str))return null
  const result=Number(str.includes(',')?str.replace(/\./g,'').replace(',','.'):str)
  return Number.isFinite(result)?result:null
}
export function requirePositiveQuantity(value:unknown):number{
  const amount=parseBrDecimal(value)
  if(amount===null||amount<=0)throw new Error('Quantidade deve ser um número maior que zero.')
  return amount
}
export function groupStockMovements(movements:any[]){
  const grouped=new Map<string,{id:string;descricao:string;unidade:string;frente_id:number|null;entradas:number;saidas:number;saldo:number}>()
  for(const movement of movements||[]){
    const desc=String(movement.descricao||'').trim()
    const unit=String(movement.unidade||'un').trim()
    const front=Number(movement.frente_id)||null
    const key=[desc.toLowerCase(),unit.toLowerCase(),front||0].join('|')
    if(!grouped.has(key))grouped.set(key,{id:key,descricao:desc,unidade:unit,frente_id:front,entradas:0,saidas:0,saldo:0})
    const row=grouped.get(key)!
    const quantity=Number(movement.quantidade)||0
    if(movement.tipo==='saida')row.saidas+=quantity
    else row.entradas+=quantity
    row.saldo=row.entradas-row.saidas
  }
  return [...grouped.values()].sort((a,b)=>a.descricao.localeCompare(b.descricao,'pt-BR'))
}
