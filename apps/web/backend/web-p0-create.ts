/**
 * Create requests are commands awaiting the operational Desktop. They never create
 * obras, etapas or tarefas in a second D1 data store.
 */
export type P0CreateEntity='frentes_obra'|'subfrentes_obra'|'tarefas_obra';
export type P0CreateCommand={commandId:string;sourceDeviceId:string;entity:P0CreateEntity;data:Record<string,unknown>};
export const P0_CREATE_FIELDS={
  frentes_obra:['nome','codigo','ordem','status','observacoes'],
  subfrentes_obra:['nome','codigo','pavimento','escopo','ordem','status','observacoes','frente_id'],
  tarefas_obra:['titulo','descricao','responsavel','prazo','prioridade','status','frente_id']
} as const;
const rec=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function validDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value}
export function assertP0Create(input:unknown):P0CreateCommand{
  const raw=rec(input),commandId=String(raw.commandId||''),sourceDeviceId=String(raw.sourceDeviceId||''),entity=String(raw.entity||'') as P0CreateEntity;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId))throw new Error('Identificador único de solicitação inválido.');
  if(!sourceDeviceId||sourceDeviceId.length>128||!/^[\w-]+$/.test(sourceDeviceId))throw new Error('Dispositivo operacional inválido.');
  if(!Object.prototype.hasOwnProperty.call(P0_CREATE_FIELDS,entity))throw new Error('Cadastro não habilitado para criação pelo Web.');
  const rawData=rec(raw.data),data:Record<string,unknown>={};
  const allowed=P0_CREATE_FIELDS[entity] as readonly string[];
  if(!Object.keys(rawData).length||Object.keys(rawData).length>allowed.length)throw new Error('Informe os campos do cadastro.');
  for(const [key,value] of Object.entries(rawData)){
    if(!allowed.includes(key))throw new Error('Campo não autorizado: '+key);
    if(key==='frente_id'||key==='ordem'){
      if(!Number.isSafeInteger(Number(value))||Number(value)<(key==='frente_id'?1:0)||Number(value)>100000000)throw new Error('Referência ou ordem inválida.');
      data[key]=Number(value);continue;
    }
    if(typeof value!=='string')throw new Error('Valor inválido para '+key);
    const text=value.trim(),max=['nome','titulo'].includes(key)?250:key==='observacoes'||key==='descricao'?4000:255;
    if(text.length>max)throw new Error('Campo excede tamanho permitido: '+key);
    if(key==='prazo'&&text&&!validDate(text))throw new Error('Prazo precisa ser uma data válida no formato AAAA-MM-DD.');
    data[key]=text;
  }
  if(!String(data[entity==='tarefas_obra'?'titulo':'nome']||''))throw new Error('Informe nome ou título.');
  if(entity==='subfrentes_obra'&&!Number.isSafeInteger(data.frente_id))throw new Error('Selecione a etapa da subetapa.');
  return{commandId,sourceDeviceId,entity,data};
}
