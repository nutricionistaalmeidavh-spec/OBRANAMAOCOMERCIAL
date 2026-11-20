import { ConcurrencyService, RevisionConflictError } from './concurrency-service.mjs'

const MAX_ROWS=500
const TABLE={orcamento:'itens_orcamentarios',financeiro:'contas',cronograma:'cronograma_etapas',etapas:'frentes_obra',subetapas:'subfrentes_obra',tarefas:'tarefas_obra'}
export const AREA_DOMAIN=Object.freeze({orcamento:'planning',financeiro:'finance',cronograma:'planning',etapas:'operation',subetapas:'operation',tarefas:'operation'})
const STATES={etapas:['ativa','pausada','concluida'],subetapas:['ativa','pausada','concluida'],cronograma:['pendente','em_andamento','concluida','atrasada'],tarefas:['aberta','em_andamento','concluida','cancelada']}
const PRIORITIES=['baixa','normal','alta','urgente']
const POINT_TYPES=['trabalho','falta','ferias','feriado','folga','afastado','sabado','domingo']
const VALUE_KEYS={
 orcamento:['descricao','codigo','tipo','unidade','quantidade','valor_unitario_centavos','frente_id','subfrente_id','etapa_id'],
 financeiro:['descricao','competencia','vencimento','valor_centavos'],
 cronograma:['nome','responsavel','previsto_inicio','previsto_fim','percentual_previsto','percentual_realizado','custo_planejado_centavos','custo_realizado_centavos','status'],
 etapas:['nome','codigo','ordem','status','observacoes'],
 subetapas:['nome','codigo','pavimento','escopo','ordem','status','observacoes','frente_id'],
 tarefas:['responsavel','prazo','prioridade','status']
}
function positiveId(v,name='ID'){
 const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw Error(name+' inválido.');return n
}
function decimal(v,label){
 if(typeof v==='number' && Number.isFinite(v))return v
 if(typeof v!=='string'||!v.trim())throw Error(label+' inválido.')
 const clean=v.trim().replace(/[\u00a0\s]/g,'')
 if(!/^[+-]?(?:\d{1,3}(?:\.\d{3})+,\d+|\d+,\d+|\d+(?:\.\d+)?)$/.test(clean))throw Error(label+' inválido.')
 const result=Number(clean.includes(',')?clean.replace(/\./g,'').replace(',','.'):clean)
 if(!Number.isFinite(result))throw Error(label+' inválido.')
 return result
}
function nonnegative(v,name){const n=decimal(v,name);if(n<0)throw Error(name+' não pode ser negativo.');return n}
function money(v,name){const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw Error(name+' inválido em centavos.');return n}
function optionalId(v){return v===null||v===undefined||v===''?null:positiveId(v)}
function requiredName(v,label='Nome'){const s=String(v??'').trim();if(!s||s.length>255)throw Error(label+' obrigatório, com até 255 caracteres.');return s}
function text(v,max=1000){const s=String(v??'').trim();if(s.length>max)throw Error('Campo excede '+max+' caracteres.');return s}
function date(v,required=false){
 if(v===null||v===undefined||v===''){if(required)throw Error('Data obrigatória.');return null}
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error('Data inválida.')
 return v
}
function competence(v){if(typeof v!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(v))throw Error('Competência inválida.');return v}
function percent(v,label){const n=nonnegative(v,label);if(n>100)throw Error(label+' deve estar entre 0 e 100.');return n}
function status(v,values){if(!values.includes(v))throw Error('Status inválido.');return v}
function validRows(rows){if(!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS)throw Error('Informe de 1 a 500 linhas para salvar.');return rows}
function typedError(index,error){if(error instanceof RevisionConflictError)return error;return Error('Linha '+(index+1)+': '+(error?.message||String(error)))}
function timeMinutes(value){if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('Horário inválido.');let [h,m]=value.split(':').map(Number);return h*60+m}
function workedHours(row){if(row.tipo!=='trabalho')return null;const times=[row.entrada,row.intervalo_saida,row.intervalo_entrada,row.saida];if(times.some(x=>!x))return null;const n=times.map(timeMinutes);return n[0]<=n[1]&&n[1]<=n[2]&&n[2]<=n[3]?Number(((n[1]-n[0]+n[3]-n[2])/60).toFixed(2)):null}

export class OperationalSheetCentral {
 constructor({repository}){
  if(!repository?.connection||!repository?.save)throw Error('Repositório central indisponível para planilhas.')
  this.repository=repository
  this.db=repository.connection()
  this.concurrency=new ConcurrencyService({db:this.db})
 }
 transaction(fn){
  this.db.exec('BEGIN IMMEDIATE')
  try{const result=fn();this.db.exec('COMMIT');return result}
  catch(e){try{this.db.exec('ROLLBACK')}catch{}throw e}
 }
 revision(table,id,expected,old){
  const current=this.concurrency.current(table,id)||this.concurrency.initialize(table,id)
  this.concurrency.assertExpected(table,id,expected,{...old,revision:current})
 }
 checkWork(id){const work=this.repository.get('obras',positiveId(id,'Obra'));if(!work||work.deleted_at)throw Error('Obra inexistente ou excluída.');return work}
 front(id,obraId){
  if(!id)return
  const row=this.repository.get('frentes_obra',positiveId(id,'Etapa'))
  if(!row||row.deleted_at||Number(row.obra_id)!==Number(obraId))throw Error('Etapa não pertence à obra.')
 }
 subfront(id,obraId,frontId){
  if(!id)return
  const sub=this.repository.get('subfrentes_obra',positiveId(id,'Subetapa'))
  if(!sub||sub.deleted_at||Number(sub.obra_id)!==Number(obraId)||Number(sub.frente_id)!==Number(frontId))throw Error('Subetapa incompatível com obra/etapa.')
 }
 account(old,patch,empresaId){
  if(empresaId && Number(old.empresa_id)!==Number(empresaId))throw Error('Conta pertence a outra empresa.')
  if(!['pendente','vencido'].includes(old.status))throw Error('Conta já liquidada ou bloqueada.')
  if(old.origem_tipo && old.origem_tipo!=='manual')throw Error('Conta gerada por outro módulo; edite na origem.')
  const payments=this.db.prepare('SELECT COUNT(*) total FROM pagamentos_conta WHERE conta_id=?').get(old.id)
  if(Number(payments.total)>0)throw Error('Conta com pagamentos não pode ser editada em lote.')
  if(patch.valor_centavos!==undefined)patch.valor_bruto_centavos=patch.valor_centavos
 }
 normalize(area,row,old,obraId){
  const src=Object.fromEntries(VALUE_KEYS[area].filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]))
  if(area==='orcamento'){
   if(src.quantidade!==undefined)src.quantidade=nonnegative(src.quantidade,'Quantidade')
   if(src.valor_unitario_centavos!==undefined)src.valor_unitario_centavos=money(src.valor_unitario_centavos,'Valor unitário')
   for(const key of ['frente_id','subfrente_id','etapa_id'])if(key in src)src[key]=optionalId(src[key])
   if(src.descricao!==undefined)src.descricao=requiredName(src.descricao,'Descrição')
   if(src.unidade!==undefined)src.unidade=requiredName(src.unidade,'Unidade')
   if(src.codigo!==undefined)src.codigo=text(src.codigo,80)
   if(src.tipo!==undefined)status(src.tipo,['material','mao_de_obra','equipamento','servico'])
   const frontId=src.frente_id===undefined?old.frente_id:src.frente_id
   const subId=src.subfrente_id===undefined?old.subfrente_id:src.subfrente_id
   this.front(frontId,obraId);this.subfront(subId,obraId,frontId)
  }
  if(area==='financeiro'){
   if('descricao' in src)src.descricao=requiredName(src.descricao,'Descrição')
   if('valor_centavos' in src)src.valor_centavos=money(src.valor_centavos,'Valor da conta')
   if('vencimento' in src)src.vencimento=date(src.vencimento,true)
   if('competencia' in src)src.competencia=competence(src.competencia)
  }
  if(area==='cronograma'){
   if('nome' in src)src.nome=requiredName(src.nome,'Nome da programação')
   if('responsavel' in src)src.responsavel=text(src.responsavel,200)
   for(const key of ['previsto_inicio','previsto_fim'])if(key in src)src[key]=date(src[key])
   if('percentual_previsto' in src)src.percentual_previsto=percent(src.percentual_previsto,'% previsto')
   if('percentual_realizado' in src)src.percentual_realizado=percent(src.percentual_realizado,'% realizado')
   for(const key of ['custo_planejado_centavos','custo_realizado_centavos'])if(key in src)src[key]=money(src[key],key)
   if('status' in src)status(src.status,STATES.cronograma)
   if((src.previsto_inicio??old.previsto_inicio)&&(src.previsto_fim??old.previsto_fim)&&
      (src.previsto_inicio??old.previsto_inicio)>(src.previsto_fim??old.previsto_fim))throw Error('Início posterior ao fim.')
   this.front(old.frente_id,obraId)
   if(row.frente_id!==undefined&&Number(row.frente_id)!==Number(old.frente_id))throw Error('Alteração de vínculo do cronograma exige formulário individual.')
  }
  if(area==='etapas'||area==='subetapas'){
   if('nome' in src)src.nome=requiredName(src.nome)
   if('ordem' in src){src.ordem=Number(src.ordem);if(!Number.isSafeInteger(src.ordem)||src.ordem<0)throw Error('Ordem inválida.')}
   if('status' in src)status(src.status,STATES[area])
   for(const key of ['codigo','pavimento','escopo','observacoes'])if(key in src)src[key]=text(src[key],key==='escopo'||key==='observacoes'?1000:120)
   if(area==='subetapas'){
    const frontId=src.frente_id===undefined?old?.frente_id:optionalId(src.frente_id)
    this.front(frontId,obraId)
    if(old&&Number(old.frente_id)!==Number(frontId))throw Error('Alteração da etapa de origem exige cadastro individual.')
    src.frente_id=frontId
   }
  }
  if(area==='tarefas'){
   if(old?.origem_tipo==='rdo_ocorrencia'||old?.rdo_ocorrencia_id)throw Error('Pendência vinculada ao RDO só pode ser alterada pelo Diário.')
   if('responsavel' in src)src.responsavel=text(src.responsavel,200)
   if('prazo' in src)src.prazo=date(src.prazo)
   if('prioridade' in src)status(src.prioridade,PRIORITIES)
   if('status' in src)status(src.status,STATES.tarefas)
   const final=src.status??old.status
   src.concluido_em=final==='concluida'?(old.status==='concluida'&&old.concluido_em?old.concluido_em:new Date().toISOString().slice(0,10)):null
  }
  return src
 }
 commit(payload={}){
  const area=String(payload.area||'')
  const table=TABLE[area]
  if(!table)throw Error('Área de planilha não suportada.')
  const rows=validRows(payload.rows)
  const obraId=area==='financeiro'?null:positiveId(payload.obraId,'Obra')
  return this.transaction(()=>{
   const ids=[],seen=new Set()
   if(obraId)this.checkWork(obraId)
   for(let i=0;i<rows.length;i++){
    try{
     const row=rows[i]||{}
     const id=row.id===null||row.id===undefined||row.id===''?null:positiveId(row.id)
     if(id===null&&!['etapas','subetapas'].includes(area))throw Error('Registro existente obrigatório para esta planilha.')
     if(id!==null){if(seen.has(id))throw Error('ID repetido no lote.');seen.add(id)}
     const old=id?this.repository.get(table,id):null
     if(id&&(!old||old.deleted_at))throw Error('Registro inexistente ou excluído.')
     if(old&&obraId&&Number(old.obra_id)!==obraId)throw Error('Registro pertence a outra obra.')
     if(id)this.revision(table,id,row.revision,old)
     const patch=this.normalize(area,row,old,obraId)
     if(area==='financeiro')this.account(old,patch,payload.empresaId)
     if(!id&&!patch.nome)throw Error('Preencha o nome da nova etapa.')
     if(!Object.keys(patch).length)throw Error('Nenhuma alteração válida foi informada.')
     const saved=this.repository.save(table,{...(id?{id}:{}),...(obraId?{obra_id:obraId}:{}),...patch})
     if(!saved)throw Error('Não foi possível salvar o registro.')
     const revision=id?this.concurrency.bump(table,id):this.concurrency.initialize(table,saved.id)
     ids.push({id:saved.id,revision})
    }catch(e){throw typedError(i,e)}
   }
   return {updated:ids.length,ids:ids.map(x=>x.id),revisions:ids}
  })
 }
 measurements(payload={}){
  const obraId=positiveId(payload.obraId,'Obra'),competencia=competence(payload.competencia)
  this.checkWork(obraId)
  const items=this.db.prepare(`SELECT b.id AS item_orcamentario_id,b.descricao,b.unidade,b.frente_id,
      b.quantidade AS quantidade_prevista,b.valor_unitario_centavos,
      COALESCE(SUM(CASE WHEN m.id IS NOT NULL AND m.status!='cancelada' AND m.competencia=? THEN mi.quantidade_periodo ELSE 0 END),0) quantidade_periodo,
      COALESCE(SUM(CASE WHEN m.id IS NOT NULL AND m.status!='cancelada' THEN mi.quantidade_periodo ELSE 0 END),0) quantidade_acumulada,
      COALESCE(SUM(CASE WHEN m.id IS NOT NULL AND m.status='aprovada' THEN mi.valor_periodo_centavos ELSE 0 END),0) valor_a_faturar_centavos
      FROM itens_orcamentarios b
      LEFT JOIN medicao_itens mi ON mi.item_orcamentario_id=b.id
      LEFT JOIN medicoes m ON m.id=mi.medicao_id AND m.obra_id=b.obra_id AND m.deleted_at IS NULL
      WHERE b.obra_id=? AND b.deleted_at IS NULL GROUP BY b.id ORDER BY b.frente_id,b.descricao`).all(competencia,obraId).map(row=>({
       ...row,id:row.item_orcamentario_id,
       saldo_a_medir:Number((Number(row.quantidade_prevista)-Number(row.quantidade_acumulada)).toFixed(3)),
       saldo_contratual:null
      }))
  const contracts=this.db.prepare(`SELECT c.id AS contrato_id,c.numero,c.valor_centavos AS valor_original_centavos,
     COALESCE((SELECT SUM(a.valor_centavos) FROM contrato_aditivos a WHERE a.contrato_id=c.id AND a.status IN ('aprovado','aprovada')),0) aditivos_centavos,
     COALESCE((SELECT SUM(m.valor_bruto_centavos) FROM medicoes m WHERE m.contrato_id=c.id AND m.obra_id=c.obra_id AND m.deleted_at IS NULL AND m.status IN ('faturada','recebida')),0) faturado_centavos,
     COALESCE((SELECT SUM(m.valor_bruto_centavos) FROM medicoes m WHERE m.contrato_id=c.id AND m.obra_id=c.obra_id AND m.deleted_at IS NULL AND m.status='aprovada'),0) aprovado_a_faturar_centavos
     FROM contratos_obra c WHERE c.obra_id=? AND c.deleted_at IS NULL AND c.status!='cancelado' ORDER BY c.id`).all(obraId).map(row=>{
      const total=Number(row.valor_original_centavos)+Number(row.aditivos_centavos)
      return {...row,total_contratado_centavos:total,saldo_contratual_centavos:total-Number(row.faturado_centavos)}
     })
  return {items,contracts,competencia,obraId}
 }
 timeMatrix(payload={}){
  const competencia=competence(payload.competencia)
  const obraId=payload.obraId?positiveId(payload.obraId,'Obra'):null
  const empresaId=payload.empresaId?positiveId(payload.empresaId,'Empresa'):null
  const where=["e.deleted_at IS NULL","e.status='ativo'"],args=[]
  if(obraId){this.checkWork(obraId);where.push('e.obra_atual_id=?');args.push(obraId)}
  if(empresaId){where.push('e.empresa_id=?');args.push(empresaId)}
  const employees=this.db.prepare(`SELECT e.id,e.nome,e.empresa_id,e.obra_atual_id FROM funcionarios e WHERE ${where.join(' AND ')} ORDER BY e.nome,e.id LIMIT 61`).all(...args)
  const chosen=employees.slice(0,60)
  const [year,month]=competencia.split('-').map(Number),last=new Date(Date.UTC(year,month,0)).getUTCDate()
  const ids=chosen.map(e=>e.id)
  const points=ids.length?this.db.prepare(`SELECT id,funcionario_id,status FROM pontos_mensais WHERE competencia=? AND funcionario_id IN (${ids.map(()=>'?').join(',')})`).all(competencia,...ids):[]
  const index=new Map(points.map(p=>[p.funcionario_id,{...p,revision:this.concurrency.current('pontos_mensais',p.id)||this.concurrency.initialize('pontos_mensais',p.id)}]))
  const marks=points.length?this.db.prepare(`SELECT p.funcionario_id,m.data,m.tipo,m.entrada,m.intervalo_saida,m.intervalo_entrada,m.saida,m.observacoes,m.updated_at FROM ponto_marcacoes m JOIN pontos_mensais p ON p.id=m.ponto_mensal_id WHERE p.competencia=? AND p.funcionario_id IN (${ids.map(()=>'?').join(',')})`).all(competencia,...ids):[]
  const markIndex=new Map(marks.map(m=>[m.funcionario_id+'|'+m.data,m]))
  const rows=[]
  for(const e of chosen){
   const p=index.get(e.id)
   for(let day=1;day<=last;day++){
    const data=competencia+'-'+String(day).padStart(2,'0'),m=markIndex.get(e.id+'|'+data)
    const row={id:e.id+'|'+data,funcionario_id:e.id,funcionario_nome:e.nome,empresa_id:e.empresa_id,obra_atual_id:e.obra_atual_id,competencia,data,
     tipo:m?.tipo||'',entrada:m?.entrada||'',intervalo_saida:m?.intervalo_saida||'',intervalo_entrada:m?.intervalo_entrada||'',saida:m?.saida||'',
     observacoes:m?.observacoes||'',updated_at:m?.updated_at||'',ponto_status:p?.status||'sem_ficha',pointRevision:p?.revision||null}
    row.horas=workedHours(row)
    rows.push(row)
   }
  }
  return {competencia,rows,employeeCount:chosen.length,truncated:employees.length>60}
 }
 timeCommit(payload={}){
  const competencia=competence(payload.competencia),rows=validRows(payload.rows),obraId=payload.obraId?positiveId(payload.obraId,'Obra'):null,
   empresaId=payload.empresaId?positiveId(payload.empresaId,'Empresa'):null
  return this.transaction(()=>{
   const grouped=new Map(),seen=new Set()
   for(let i=0;i<rows.length;i++)try{
    const r=rows[i],id=positiveId(r.funcionario_id,'Funcionário'),data=date(r.data,true)
    if(!data.startsWith(competencia+'-'))throw Error('Data fora da competência.')
    const key=id+'|'+data;if(seen.has(key))throw Error('Dia repetido no lote.');seen.add(key)
    const employee=this.repository.get('funcionarios',id)
    if(!employee||employee.deleted_at||employee.status!=='ativo')throw Error('Funcionário inativo.')
    if(obraId&&Number(employee.obra_atual_id)!==obraId)throw Error('Funcionário de outra obra.')
    if(empresaId&&Number(employee.empresa_id)!==empresaId)throw Error('Funcionário de outra empresa.')
    if(!POINT_TYPES.includes(r.tipo))throw Error('Tipo de marcação inválido.')
    const mark={data,tipo:r.tipo,entrada:null,intervalo_saida:null,intervalo_entrada:null,saida:null,observacoes:text(r.observacoes,500)}
    if(r.tipo==='trabalho'){
     for(const field of ['entrada','intervalo_saida','intervalo_entrada','saida'])mark[field]=String(r[field]??'')
     if(workedHours(mark)===null)throw Error('Horários incompletos ou fora de ordem.')
    }
    if(!grouped.has(id))grouped.set(id,{employee,expected:r.pointRevision,marks:[]})
    const group=grouped.get(id)
    if(group.expected!==r.pointRevision)throw Error('Revisões incompatíveis para o mesmo funcionário.')
    group.marks.push(mark)
   }catch(e){throw typedError(i,e)}
   for(const [employeeId,group] of grouped){
    const emp=group.employee
    const paid=this.db.prepare("SELECT COUNT(*) n FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? AND status='pago'").get(employeeId,competencia)
    if(Number(paid?.n)>0)throw Error('Funcionário com pagamento confirmado.')
    let point=this.db.prepare('SELECT * FROM pontos_mensais WHERE funcionario_id=? AND competencia=?').get(employeeId,competencia)
    if(point){
     if(!['rascunho','preenchido'].includes(point.status))throw Error('Ficha de ponto fechada.')
     if(group.expected===null||group.expected===undefined){
      const currentRevision=this.concurrency.current('pontos_mensais',point.id)||this.concurrency.initialize('pontos_mensais',point.id)
      throw new RevisionConflictError({resourceType:'pontos_mensais',resourceId:point.id,expectedRevision:0,currentRevision,current:{...point,revision:currentRevision}})
     }
     this.revision('pontos_mensais',point.id,group.expected,point)
    }else{
     if(group.expected!==null&&group.expected!==undefined)throw new RevisionConflictError({resourceType:'pontos_mensais',resourceId:employeeId+'|'+competencia,expectedRevision:group.expected,currentRevision:0})
     point=this.repository.save('pontos_mensais',{empresa_id:emp.empresa_id,funcionario_id:employeeId,competencia,status:'rascunho',
      jornada_inicio:emp.jornada_inicio||'07:00',intervalo_inicio:emp.intervalo_inicio||'11:00',intervalo_fim:emp.intervalo_fim||'12:00',jornada_fim:emp.jornada_fim||'17:00',preenchimento_automatico:0})
     this.concurrency.initialize('pontos_mensais',point.id)
    }
    const upsert=this.db.prepare(`INSERT INTO ponto_marcacoes(empresa_id,ponto_mensal_id,data,tipo,entrada,intervalo_saida,intervalo_entrada,saida,observacoes)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(ponto_mensal_id,data) DO UPDATE SET tipo=excluded.tipo,entrada=excluded.entrada,intervalo_saida=excluded.intervalo_saida,
      intervalo_entrada=excluded.intervalo_entrada,saida=excluded.saida,observacoes=excluded.observacoes,updated_at=CURRENT_TIMESTAMP`)
    for(const mark of group.marks)upsert.run(emp.empresa_id,point.id,mark.data,mark.tipo,mark.entrada,mark.intervalo_saida,mark.intervalo_entrada,mark.saida,mark.observacoes)
    this.repository.save('pontos_mensais',{id:point.id,status:'preenchido'})
    this.concurrency.bump('pontos_mensais',point.id)
   }
   return {updated:rows.length,employees:grouped.size}
  })
 }
 receiveMany(payload={}){
  const rows=validRows(payload.items)
  const requestId=text(payload.requestId,120)
  if(!requestId)throw Error('Identificador idempotente obrigatório para recebimento.')
  const day=date(payload.data,true)
  const seen=new Set()
  return this.transaction(()=>{
   const prefix=requestId+':'
   const previous=this.db.prepare('SELECT COUNT(*) AS n FROM recebimentos_materiais WHERE substr(request_id,1,?)=?').get(prefix.length,prefix)
   if(Number(previous.n)>0&&Number(previous.n)!==rows.length)throw Error('Reenvio idempotente divergente: o lote original tinha outra quantidade de itens.')
   const receipts=[]
   for(let i=0;i<rows.length;i++){
    try{
     const itemId=positiveId(rows[i].pedido_item_id,'Item'),quantity=decimal(rows[i].quantidade_recebida,'Quantidade')
     if(quantity<=0)throw Error('Quantidade recebida deve ser maior que zero.')
     if(seen.has(itemId))throw Error('Item duplicado.');seen.add(itemId)
     const key=requestId+':'+itemId
     const replay=this.db.prepare('SELECT * FROM recebimentos_materiais WHERE request_id=?').get(key)
     if(replay){
      if(Number(replay.quantidade_recebida)!==quantity||replay.data!==day)throw Error('Reenvio com quantidade ou data diferente do recebimento original.')
      receipts.push(replay);continue
     }
     const item=this.repository.get('pedido_compra_itens',itemId)
     if(!item)throw Error('Item de pedido inexistente.')
     const order=this.repository.get('pedidos_compra',item.pedido_compra_id)
     if(!order||order.deleted_at)throw Error('Pedido inexistente.')
     const remaining=Number(item.quantidade_pedida)-Number(item.quantidade_recebida||0)
     if(quantity>remaining+1e-9)throw Error('Quantidade excede pedido.')
     const receipt=this.repository.save('recebimentos_materiais',{pedido_compra_id:order.id,pedido_item_id:item.id,obra_id:order.obra_id,frente_id:order.frente_id||null,
      data:day,quantidade_pedida:item.quantidade_pedida,quantidade_recebida:quantity,nota_fiscal:payload.nota_fiscal||null,request_id:key})
     this.repository.save('pedido_compra_itens',{id:item.id,quantidade_recebida:Number(item.quantidade_recebida||0)+quantity})
     this.repository.save('movimentacoes_estoque',{obra_id:order.obra_id,frente_id:order.frente_id||null,pedido_item_id:item.id,
      tipo:'entrada',descricao:item.descricao,unidade:item.unidade,quantidade:quantity,data:day,request_id:'receipt:'+key})
     const left=this.db.prepare('SELECT COUNT(*) n FROM pedido_compra_itens WHERE pedido_compra_id=? AND quantidade_recebida<quantidade_pedida').get(order.id)
     this.repository.save('pedidos_compra',{id:order.id,status:Number(left.n)>0?'recebido_parcial':'recebido'})
     receipts.push(receipt)
    }catch(e){throw typedError(i,e)}
   }
   return {received:receipts.length,ids:receipts.map(r=>r.id)}
  })
 }
}
