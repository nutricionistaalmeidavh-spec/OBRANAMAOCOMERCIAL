/**
 * Backoffice Web P0: no shadow tables. Only Desktop bridge rows are editable.
 * Local IDs are meaningful together with entity + sourceDeviceId, never alone.
 */
export const EDIT_FIELDS = Object.freeze({
  frentes_obra:['nome','codigo','status','observacoes'],
  subfrentes_obra:['nome','codigo','pavimento','escopo','status','observacoes'],
  tarefas_obra:['titulo','status','responsavel','prazo','prioridade','descricao','observacoes','concluido_em'],
  cronograma_etapas:['status','percentual_realizado','observacoes','responsavel','previsto_inicio','previsto_fim']
} as const);
export type P0Entity=keyof typeof EDIT_FIELDS;
export type BridgeRow={entity:P0Entity;localId:number;sourceDeviceId:string;revision:number;desktopRevision:number;payload:Record<string,unknown>};
export type BridgeEdit=BridgeRow & {expectedRevision:number;expectedDesktopRevision:number;patch:Record<string,unknown>};
export class BridgeConflict extends Error {
  constructor(){super('Este registro foi alterado em outro dispositivo. Recarregue antes de salvar.');this.name='BridgeConflict'}
}
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const validId=(id:unknown)=>Number.isSafeInteger(Number(id))&&Number(id)>0;
const textValue=(v:unknown)=>typeof v==='string'||typeof v==='number'||typeof v==='boolean'||v===null;

export function bridgeRows(bridge:unknown):BridgeRow[]{
  const raw=rec(bridge);
  const names:[P0Entity,string][]=[['frentes_obra','fronts'],['subfrentes_obra','subfronts'],['tarefas_obra','tasks'],['cronograma_etapas','schedule']];
  return names.flatMap(([entity,bucket])=>(Array.isArray(raw[bucket])?raw[bucket] as unknown[]:[]).map(rec).filter(item=>{
    const payload=rec(item.payload);
    return validId(item.localId)&&typeof item.sourceDeviceId==='string'&&item.sourceDeviceId.length>0&&item.deleted!==true&&payload.deleted!==true&&(!item.entity||item.entity===entity);
  }).map(item=>({entity,localId:Number(item.localId),sourceDeviceId:String(item.sourceDeviceId),revision:Math.max(0,Number(item.mobileEditedRevision||0)),desktopRevision:Math.max(0,Number(item.desktopRevision||0)),payload:rec(item.payload)})));
}

export function assertBridgeEdit(input:unknown):{entity:P0Entity;localId:number;sourceDeviceId:string;expectedRevision:number;expectedDesktopRevision:number;patch:Record<string,unknown>}{
  const body=rec(input),entity=String(body.entity||'') as P0Entity;
  if(!Object.prototype.hasOwnProperty.call(EDIT_FIELDS,entity))throw new Error('Entidade não autorizada no backoffice Web.');
  if(!validId(body.localId)||typeof body.sourceDeviceId!=='string'||!body.sourceDeviceId||body.sourceDeviceId.length>128)throw new Error('Identidade do registro inválida.');
  if(!Number.isSafeInteger(body.expectedRevision)||Number(body.expectedRevision)<0)throw new Error('A revisão original do registro é obrigatória.');
  if(!Number.isSafeInteger(body.expectedDesktopRevision)||Number(body.expectedDesktopRevision)<0)throw new Error('A revisão de origem do Desktop é obrigatória.');
  const patch=rec(body.patch),keys=Object.keys(patch);
  if(!keys.length||keys.length>EDIT_FIELDS[entity].length)throw new Error('Informe ao menos um campo editável.');
  for(const key of keys){
    if(!(EDIT_FIELDS[entity] as readonly string[]).includes(key))throw new Error('Campo não autorizado: '+key);
    if(!textValue(patch[key])||String(patch[key]??'').length>4000)throw new Error('Valor inválido para '+key);
  }
  const dateFields=new Set(['prazo','previsto_inicio','previsto_fim','concluido_em']);
  const validDate=(value:string)=>{const match=/^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
    if(!match)return false;
    const date=new Date(value+'T00:00:00.000Z');
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
  };
  for(const key of keys){
    const value=patch[key];
    if(key==='percentual_realizado'){
      const normalized=typeof value==='string'?value.trim().replace(',','.'):value;
      const percent=Number(normalized);
      if(normalized===null||normalized===''||!Number.isFinite(percent)||percent<0||percent>100)throw new Error('Percentual realizado deve ficar entre 0 e 100.');
      patch[key]=percent;continue;
    }
    if(dateFields.has(key)){
      if(value===null||value===''){patch[key]=null;continue}
      const str=String(value);
      if(!validDate(str)&&!(key==='concluido_em'&&/^\\d{4}-\\d{2}-\\d{2}T/.test(str)&&!Number.isNaN(Date.parse(str))))throw new Error('Data inválida para '+key);
      continue;
    }
    if(['nome','titulo'].includes(key)&&!String(value??'').trim())throw new Error('O nome ou título não pode ficar vazio.');
  }
  return{entity,localId:Number(body.localId),sourceDeviceId:body.sourceDeviceId,expectedRevision:Number(body.expectedRevision),expectedDesktopRevision:Number(body.expectedDesktopRevision),patch};
}
