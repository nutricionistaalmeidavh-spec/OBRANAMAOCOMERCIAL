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
export function groupStockMovements(movements:any[],orderItems:any[]=[]){
  const itemsById=new Map(orderItems.map(item=>[Number(item.id),item]))
  const grouped=new Map<string,{id:string;descricao:string;unidade:string;frente_id:number|null;entradas:number;saidas:number;saldo:number;_custoCoberto:number;_custoTotalCentavos:number;custo_medio_centavos:number|null;saldo_estimado_centavos:number|null}>()
  for(const movement of movements||[]){
    const desc=String(movement.descricao||'').trim()
    const unit=String(movement.unidade||'un').trim()
    const front=Number(movement.frente_id)||null
    const key=[desc.toLowerCase(),unit.toLowerCase(),front||0].join('|')
    if(!grouped.has(key))grouped.set(key,{id:key,descricao:desc,unidade:unit,frente_id:front,entradas:0,saidas:0,saldo:0,_custoCoberto:0,_custoTotalCentavos:0,custo_medio_centavos:null,saldo_estimado_centavos:null})
    const row=grouped.get(key)!
    const quantity=Number(movement.quantidade)||0
    if(movement.tipo==='saida')row.saidas+=quantity
    else {
      row.entradas+=quantity
      const source=itemsById.get(Number(movement.pedido_item_id))
      if(source && Number(source.quantidade_pedida)>0 && Number(source.valor_centavos)>=0){
        row._custoCoberto+=quantity
        row._custoTotalCentavos+=Number(source.valor_centavos)*quantity/Number(source.quantidade_pedida)
      }
    }
    row.saldo=row.entradas-row.saidas
    row.custo_medio_centavos=row._custoCoberto>0?Math.round(row._custoTotalCentavos/row._custoCoberto):null
    row.saldo_estimado_centavos=row.custo_medio_centavos===null?null:Math.round(row.custo_medio_centavos*row.saldo)
  }
  return [...grouped.values()].sort((a,b)=>a.descricao.localeCompare(b.descricao,'pt-BR'))
}
