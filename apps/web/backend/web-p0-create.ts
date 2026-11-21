/**
 * Commands posted by browser are queued, never written to a parallel operational table.
 * Authority and tenant identity come exclusively from the authenticated session/device.
 */
export type P0CreateEntity='empresas'|'clientes'|'obras'|'frentes_obra'|'subfrentes_obra'|'tarefas_obra'|'etapas_obra'|'cronograma_etapas'|'checklist_frente_itens'|'rdos';
export type P0CommandAction='create'|'update'|'delete';
export type P0CreateCommand={
  commandId:string;sourceDeviceId:string;entity:P0CreateEntity;action:P0CommandAction;
  data:Record<string,unknown>;localId?:number;expectedFingerprint?:string
};
export const P0_CREATE_FIELDS={
  empresas:['razao_social','nome_fantasia','cnpj','telefone','email','endereco','observacoes','status'],
  clientes:['nome','documento','telefone','email','observacoes'],
  obras:['nome','codigo','endereco','responsavel','cliente_id','data_inicio','previsao_termino','status','observacoes'],
  frentes_obra:['nome','codigo','ordem','status','observacoes'],
  subfrentes_obra:['nome','codigo','pavimento','escopo','ordem','status','observacoes','frente_id'],
  tarefas_obra:['titulo','descricao','responsavel','prazo','prioridade','status','frente_id'],
  etapas_obra:['nome','frente_id','ordem','status'],
  cronograma_etapas:['nome','frente_id','etapa_id','responsavel','previsto_inicio','previsto_fim','percentual_previsto','percentual_realizado','status','observacoes'],
  checklist_frente_itens:['frente_id','subfrente_id','descricao','tipo','status','responsavel','prazo','observacoes','pavimento'],
  rdos:['data','clima','atividades','observacoes']
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
  if(!['create','update','delete'].includes(action))throw new Error('Operação não autorizada.');
  if(['rdos','checklist_frente_itens'].includes(entity)&&action!=='create')throw new Error('Este módulo deve ser editado pelo fluxo Web com controle de revisões.');
  if(action==='create'&&entity==='empresas')throw new Error('Nova empresa exige tenant e licença próprios. Use o cadastro de empresas da administração.');
  if(action==='delete'&&entity==='empresas')throw new Error('Exclusão de empresa com tenant ativo exige desativação administrativa.');
  if(action==='delete'){
    if(!validId(raw.localId)||typeof raw.expectedFingerprint!=='string'||!/^[a-f0-9]{64}$/i.test(raw.expectedFingerprint))
      throw new Error('Exclusão exige ID e hash da versão sincronizada.');
    if(Object.keys(rec(raw.data)).length)throw new Error('Exclusão não aceita dados de cadastro.');
    return{commandId,sourceDeviceId,entity,action,data:{},localId:raw.localId as number,expectedFingerprint:raw.expectedFingerprint.toLowerCase()};
  }
  if(action==='update'&&(!validId(raw.localId)||typeof raw.expectedFingerprint!=='string'||!/^[a-f0-9]{64}$/i.test(raw.expectedFingerprint)))throw new Error('Edição exige ID e hash da versão sincronizada.');
  const rawData=rec(raw.data),data:Record<string,unknown>={},allowed=P0_CREATE_FIELDS[entity] as readonly string[];
  if(!Object.keys(rawData).length||Object.keys(rawData).length>allowed.length)throw new Error('Informe os campos do cadastro.');
  for(const [key,value] of Object.entries(rawData)){
    if(!allowed.includes(key))throw new Error('Campo não autorizado: '+key);
    if(action==='update'&&key==='cliente_id'&&value===null){data[key]=null;continue;}
    if(['frente_id','cliente_id','etapa_id','subfrente_id','ordem'].includes(key)){
      if(typeof value!=='number'||!Number.isSafeInteger(value)||value<(key==='ordem'?0:1)||value>100000000)throw new Error('Referência ou ordem inválida.');
      data[key]=value;continue;
    }
    if(['percentual_previsto','percentual_realizado'].includes(key)){
      if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)throw new Error('Percentual fora da faixa 0 a 100.');
      data[key]=value;continue;
    }
    if(typeof value!=='string')throw new Error('Valor inválido para '+key);
    const text=value.trim(),max=['nome','titulo','descricao'].includes(key)?250:['observacoes','atividades'].includes(key)?4000:255;
    if(text.length>max)throw new Error('Campo excede tamanho permitido: '+key);
    if(['prazo','data','data_inicio','previsao_termino','previsto_inicio','previsto_fim'].includes(key)&&text&&!validP0Date(text))
      throw new Error('Data inválida: '+key);
    data[key]=text;
  }
  if(action==='create'&&!String(data[entity==='tarefas_obra'?'titulo':entity==='empresas'?'razao_social':entity==='checklist_frente_itens'?'descricao':entity==='rdos'?'data':'nome']||''))throw new Error('Informe nome, descrição ou data.');
  if(action==='create'&&entity==='checklist_frente_itens'&&!validId(data.frente_id))throw new Error('Checklist exige etapa da obra.');
  if(action==='update'&&['nome','razao_social','titulo'].some(key=>Object.prototype.hasOwnProperty.call(data,key)&&!String(data[key]||'')))throw new Error('Nome ou título não pode ficar vazio.');
  if(action==='create'&&entity==='subfrentes_obra'&&!validId(data.frente_id))throw new Error('Selecione a etapa da subetapa.');
  return{commandId,sourceDeviceId,entity,action,data,...(action==='update'?{localId:raw.localId as number,expectedFingerprint:(raw.expectedFingerprint as string).toLowerCase()}: {})};
}
