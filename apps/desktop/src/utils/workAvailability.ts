export type WorkArea='core'|'operation'|'planning'|'finance'|'rh'|'medicoes'|'documentos'|'contratos'|'compras'

export function isWorkAreaAvailable(
  serverPartial:boolean|undefined,
  availability:Record<string,unknown>|null|undefined,
  area:WorkArea
){
  if(serverPartial!==true)return true
  return availability?.[area]===true
}
