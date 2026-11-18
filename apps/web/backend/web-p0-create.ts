/**
 * Commands posted by browser are queued, never written to a parallel operational table.
 * Authority and tenant identity come exclusively from the authenticated session/device.
 */
export type P0CreateEntity='clientes'|'obras'|'frentes_obra'|'subfrentes_obra'|'tarefas_obra';
export type P0CommandAction='create'|'delete';
export type P0CreateCommand={
  commandId:string;sourceDeviceId:string;entity:P0CreateEntity;action:P0CommandAction;
  data:Record<string,unknown>;localId?:number;expectedFingerprint?:string
};
export const P0_CREATE_FIELDS={
  clientes:['nome','documento','telefone','email','observacoes'],
  obras:['nome','codigo','endereco','responsavel','cliente_id','data_inicio','previsao_termino','status','observacoes'],
  frentes_obra:['nome','codigo','ordem','status','observacoes'],
  subfrentes_obra:['nome','codigo','pavimento','escopo','ordem','status','observacoes','frente_id'],
  tarefas_obra:['titulo','descricao','responsavel','prazo','prioridade','status','frente_id']
} as const;
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const validId=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
export function validP0Date(value:string):boolean{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function assertP0Create(input:unknown):P0CreateCommand{
  const raw=rec(input),commandId=String(raw.commandId||''),sourceDeviceId=String(raw.sourceDeviceId||'');
  const entity=String(raw.entity||'') as P0CreateEntity,action=String(raw.action||'create') as P0CommandAction;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId))throw new Error('Identificador único de solicitação inválido.');
  if(!sourceDeviceId||sourceDeviceId.length>128||!/^[-\w]+$/.test(sourceDeviceId))throw new Error('Dispositivo operacional inválido.');
  if(!Object.prototype.hasOwnProperty.call(P0_CREATE_FIELDS,entity))throw new Error('Cadastro não habilitado para esta operação pelo Web.');
  if(!['create','delete'].includes(action))throw new Error('Operação não autorizada.');
  if(action==='delete'){
    if(!validId(raw.localId)||typeof raw.expectedFingerprint!=='string'||!/^[a-f0-9]{64}$/i.test(raw.expectedFingerprint))
      throw new Error('Exclusão exige ID e hash da versão sincronizada.');
    if(Object.keys(rec(raw.data)).length)throw new Error('Exclusão não aceita dados de cadastro.');
    return{commandId,sourceDeviceId,entity,action,data:{},localId:raw.localId as number,expectedFingerprint:raw.expectedFingerprint.toLowerCase()};
  }
  const rawData=rec(raw.data),data:Record<string,unknown>={},allowed=P0_CREATE_FIELDS[entity] as readonly string[];
  if(!Object.keys(rawData).length||Object.keys(rawData).length>allowed.length)throw new Error('Informe os campos do cadastro.');
  for(const [key,value] of Object.entries(rawData)){
    if(!allowed.includes(key))throw new Error('Campo não autorizado: '+key);
    if(['frente_id','cliente_id','ordem'].includes(key)){
      if(typeof value!=='number'||!Number.isSafeInteger(value)||value<(key==='ordem'?0:1)||value>100000000)throw new Error('Referência ou ordem inválida.');
      data[key]=value;continue;
    }
    if(typeof value!=='string')throw new Error('Valor inválido para '+key);
    const text=value.trim(),max=['nome','titulo'].includes(key)?250:['observacoes','descricao'].includes(key)?4000:255;
    if(text.length>max)throw new Error('Campo excede tamanho permitido: '+key);
    if(['prazo','data_inicio','previsao_termino'].includes(key)&&text&&!validP0Date(text))
      throw new Error('Data inválida: '+key);
    data[key]=text;
  }
  if(!String(data[entity==='tarefas_obra'?'titulo':'nome']||''))throw new Error('Informe nome ou título.');
  if(entity==='subfrentes_obra'&&!validId(data.frente_id))throw new Error('Selecione a etapa da subetapa.');
  return{commandId,sourceDeviceId,entity,action,data};
}
