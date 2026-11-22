const {createHash}=require('node:crypto')
const {ProcurementService}=require('./procurement-service.cjs')
const {ContractsService}=require('./contracts-service.cjs')
const {ProductService}=require('./product-service.cjs')
const TYPES=new Set(['medicoes','pedidos_compra','recebimentos_materiais','movimentacoes_estoque','contratos_obra','contrato_aditivos'])
const FIELDS={
 medicoes:['numero','competencia','data','descricao','frente_id','itens','status','valor_bruto_centavos','valor_liquido_centavos','retencoes_centavos','descontos_centavos'],
 pedidos_compra:['numero','descricao','solicitacao_id','frente_id','entrega_prevista','itens','gerar_conta','valor_centavos','status'],
 recebimentos_materiais:['pedido_item_id','quantidade_recebida','data','nota_fiscal','observacoes'],
 movimentacoes_estoque:['tipo','descricao','unidade','quantidade','data','frente_id','observacoes'],
 contratos_obra:['numero','descricao','valor_centavos','data_inicio','data_fim','tipo','gerar_conta','frente_id','status'],
 contrato_aditivos:['contrato_id','descricao','valor_centavos','data','status','impacto_prazo_dias','expectedContractRevision']
}
const invalid=message=>{const error=new Error(message);error.code='invalid_web_p0_command';throw error}
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{}
const uid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))
const id=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&value<=100000000
const quantity=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=100000000
const cents=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&value<=100000000000
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value
const required=value=>typeof value==='string'&&!!value.trim()&&value.length<=250
function validateWire(entity,data,scope,command){
 if(!TYPES.has(entity)||String(command.action||'create')!=='create'||!uid(command.id))invalid('Comando P1 inválido.')
 if(String(command.deviceId||'')!==String(scope.deviceId||''))invalid('Dispositivo P1 não autorizado.')
 if(!data||typeof data!=='object'||Array.isArray(data)||JSON.stringify(data).length>48000)invalid('Dados P1 inválidos.')
 for(const field of Object.keys(data))if(!FIELDS[entity].includes(field))invalid('Campo P1 proibido: '+field)
 if(data.frente_id!==undefined&&!id(data.frente_id))invalid('Etapa inválida.')
 if(entity==='medicoes'){
  if(!required(data.numero)||!date(data.data)||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(data.competencia)||data.status!=='rascunho')invalid('Medição inválida.')
  if(!Array.isArray(data.itens)||!data.itens.length||data.itens.length>50)invalid('Itens da medição inválidos.')
  const used=new Set()
  for(const item of data.itens){
   if(Object.keys(record(item)).some(key=>!['item_orcamentario_id','quantidade_periodo','valor_periodo_centavos','justificativa_excesso'].includes(key)))invalid('Item medido contém campo proibido.')
   if(!id(item.item_orcamentario_id)||used.has(item.item_orcamentario_id)||!quantity(item.quantidade_periodo)||!cents(item.valor_periodo_centavos))invalid('Item medido inválido.')
   used.add(item.item_orcamentario_id)
  }
  const total=data.itens.reduce((n,x)=>n+x.valor_periodo_centavos,0)
  if(!Number.isSafeInteger(total)||data.valor_bruto_centavos!==total||data.valor_liquido_centavos!==total||data.retencoes_centavos!==0||data.descontos_centavos!==0)invalid('Total da medição divergente.')
 }
 if(entity==='pedidos_compra'){
  if(!required(data.descricao)||data.status!=='emitido'||typeof data.gerar_conta!=='boolean'||!Array.isArray(data.itens)||data.itens.length<1||data.itens.length>50)invalid('Pedido inválido.')
  for(const item of data.itens){
   if(Object.keys(record(item)).some(key=>!['descricao','unidade','quantidade_pedida','valor_centavos'].includes(key))||!required(item.descricao)||!required(item.unidade)||!quantity(item.quantidade_pedida)||!cents(item.valor_centavos))invalid('Item de pedido inválido.')
  }
  if(data.solicitacao_id!==undefined&&!id(data.solicitacao_id))invalid('Solicitação inválida.')
  const total=data.itens.reduce((n,x)=>n+x.valor_centavos,0)
  if(!Number.isSafeInteger(total)||data.valor_centavos!==total)invalid('Total do pedido divergente.')
 }
 if(entity==='recebimentos_materiais'&&(!id(data.pedido_item_id)||!quantity(data.quantidade_recebida)||!date(data.data)))invalid('Recebimento inválido.')
 if(entity==='movimentacoes_estoque'&&(!['entrada','saida','ajuste'].includes(data.tipo)||!required(data.descricao)||!required(data.unidade)||!quantity(data.quantidade)||!date(data.data)))invalid('Movimentação inválida.')
 if(entity==='contratos_obra'&&(!required(data.descricao)||!cents(data.valor_centavos)||data.status!=='ativo'||typeof data.gerar_conta!=='boolean'))invalid('Contrato inválido.')
 if(entity==='contrato_aditivos'&&(!id(data.contrato_id)||!required(data.descricao)||!cents(Math.abs(data.valor_centavos))||data.status!=='solicitado'))invalid('Aditivo deve iniciar como solicitação.')
 if(data.data_inicio!==undefined&&!date(data.data_inicio))invalid('Início inválido.')
 if(data.data_fim!==undefined&&!date(data.data_fim))invalid('Término inválido.')
 if(data.entrega_prevista!==undefined&&!date(data.entrega_prevista))invalid('Data de entrega inválida.')
}
function assertSourceScope(repository,scope,entity,data){
 const companyId=Number(scope.companyId),workId=Number(scope.workId)
 if(!id(companyId)||!id(workId))invalid('Empresa/obra P1 inválidas.')
 const company=repository.get('empresas',companyId),work=repository.get('obras',workId)
 if(!company||company.deleted_at||!work||work.deleted_at||Number(work.empresa_id)!==companyId)invalid('Escopo operacional P1 não corresponde à origem.')
 const owned=(table,itemId,name)=>{
  const item=repository.get(table,itemId)
  if(!item||item.deleted_at||Number(item.obra_id)!==workId)invalid(name+' pertence a outra obra.')
  return item
 }
 if(data.frente_id)owned('frentes_obra',data.frente_id,'Etapa')
 if(entity==='medicoes')for(const item of data.itens)owned('itens_orcamentarios',item.item_orcamentario_id,'Orçamento')
 if(entity==='pedidos_compra'&&data.solicitacao_id)owned('solicitacoes_compra',data.solicitacao_id,'Solicitação')
 if(entity==='recebimentos_materiais'){
  const item=repository.get('pedido_compra_itens',data.pedido_item_id)
  if(!item)invalid('Item do pedido inexistente.')
  owned('pedidos_compra',item.pedido_compra_id,'Pedido de compra')
 }
 if(entity==='contrato_aditivos')owned('contratos_obra',data.contrato_id,'Contrato')
}

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
function applyLocalWebP1({database,scope,command}){
 const entity=String(command?.entity||''),data=command?.data
 validateWire(entity,data,scope,command)
 assertSourceScope(database,scope,entity,data)
 const db=database.db,companyId=Number(scope.companyId),workId=Number(scope.workId)
 const payloadHash=hash({entity,data,deviceId:scope.deviceId,companyId,workId})
 return db.transaction(()=>{
  const prior=db.prepare('SELECT * FROM web_p0_command_receipts WHERE command_id=?').get(command.id)
  if(prior){
   if(prior.payload_hash!==payloadHash||prior.device_id!==scope.deviceId||prior.empresa_id!==companyId||prior.obra_id!==workId||prior.entity!==entity)invalid('UUID P1 reutilizado para outro comando.')
   return{entity,action:'create',localId:prior.local_id,duplicate:true}
  }
  let saved
  const procurement=new ProcurementService({db:database})
  if(entity==='medicoes'){
   saved=database.saveMeasurement({...data,obra_id:workId})
  }else if(entity==='pedidos_compra'){
   const {gerar_conta,...row}=data
   saved=procurement.createOrder({...row,obra_id:workId,...(gerar_conta?{conta:{empresa_id:companyId}}:{})})
  }else if(entity==='recebimentos_materiais'){
   saved=procurement.receiveMaterial({...data})
  }else if(entity==='movimentacoes_estoque'){
   saved=procurement.moveStock({...data,obra_id:workId})
  }else{
   const contracts=new ContractsService({db:database,product:new ProductService({db:database})})
   if(entity==='contratos_obra'){
    const {gerar_conta,...row}=data
    const edition=new ProductService({db:database}).getEdition().edition
    if(gerar_conta&&edition!=='empreiteira')invalid('Conta a receber requer edição empreiteira.')
    saved=contracts.createReceivable({...row,obra_id:workId,...(gerar_conta?{conta:{empresa_id:companyId}}:{})})
   }else{
    const {expectedContractRevision,...row}=data
    saved=contracts.createAddendum({...row})
   }
  }
  if(!id(saved?.id))invalid('Fonte local não confirmou o comando P1.')
  db.prepare('INSERT INTO web_p0_command_receipts(command_id,device_id,empresa_id,obra_id,entity,payload_hash,local_id) VALUES(?,?,?,?,?,?,?)')
    .run(command.id,String(scope.deviceId),companyId,workId,entity,payloadHash,saved.id)
  database.audit?.(entity,saved.id,'WEB_P1_DOMAIN_APPLIED',{commandId:command.id})
  return{entity,action:'create',localId:saved.id,duplicate:false}
 })()
}
module.exports={applyLocalWebP1}
