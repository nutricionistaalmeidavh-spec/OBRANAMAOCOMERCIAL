const { z } = require('zod')
const { parseDecimal } = require('./operational-sheet-service.cjs')

const MAX_BATCH=500
const STATUSES = Object.freeze({
  cronograma:['pendente','em_andamento','concluida','atrasada'],
  etapas:['ativa','pausada','concluida'],
  subetapas:['ativa','pausada','concluida']
})
const POINT_TYPES=['trabalho','falta','ferias','feriado','folga','afastado','sabado','domingo']
const positive=z.number().int().positive()
const text=z.string().trim().min(1).max(255)
const percentage=z.coerce.number().min(0).max(100).finite()

function validDate(raw,allowEmpty=true){
  if((raw===null||raw===undefined||raw==='')&&allowEmpty)return null
  if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw new Error('Data inválida (AAAA-MM-DD).')
  const date=new Date(raw+'T00:00:00.000Z')
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==raw)throw new Error('Data inexistente.')
  return raw
}
function validCompetence(raw){
  if(typeof raw!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(raw))throw new Error('Competência inválida.')
  return raw
}
function requireLocal(moduleStorage,domain){
  const state=moduleStorage?.state?.(domain)?.state
  if(state!=='local'&&state!=='migration-required')throw new Error('Planilha em lote indisponível no servidor ou sem domínio local ativo. Nenhum dado foi gravado.')
}
function requireWork(obraId) {
  const id=Number(obraId)
  if(!Number.isSafeInteger(id)||id<=0)throw new Error('Selecione uma obra válida.')
  return id
}
function formattedError(index,error) {
  return new Error('Linha '+(index+1)+': '+(error instanceof Error?error.message:String(error)))
}
function checkRevision(old,row){
  if(row.updated_at && old.updated_at && String(row.updated_at)!==String(old.updated_at))
    throw new Error('Registro alterado desde a abertura da planilha. Atualize os dados antes de salvar.')
}
function percent(value,field) {
  const n=parseDecimal(value)
  if(n===null||n<0||n>100)throw new Error(field+' deve estar entre 0 e 100.')
  return n
}
function nonnegativeMoney(value,field){
  const n=Number(value)
  if(!Number.isSafeInteger(n)||n<0)throw new Error(field+' inválido em centavos.')
  return n
}
function normalizedStatus(area,value,defaultStatus){
  const state=String(value??defaultStatus)
  if(!STATUSES[area].includes(state))throw new Error('Status inválido.')
  return state
}
function cleanRow(area,input,old,obraId){
  const row=input||{}
  if(area==='cronograma'){
    const nome=text.parse(row.nome??old?.nome)
    const frente=Number(row.frente_id??old?.frente_id)
    if(!Number.isSafeInteger(frente)||frente<=0)throw new Error('Vincule a programação a uma etapa válida.')
    const start=validDate(row.previsto_inicio??old?.previsto_inicio)
    const end=validDate(row.previsto_fim??old?.previsto_fim)
    if(start&&end&&start>end)throw new Error('Data de início deve ser anterior ou igual ao fim.')
    return {nome,frente_id:frente,responsavel:String(row.responsavel??old?.responsavel??'').slice(0,200),
      previsto_inicio:start,previsto_fim:end,
      percentual_previsto:percent(row.percentual_previsto??old?.percentual_previsto??0,'% previsto'),
      percentual_realizado:percent(row.percentual_realizado??old?.percentual_realizado??0,'% realizado'),
      custo_planejado_centavos:nonnegativeMoney(row.custo_planejado_centavos??old?.custo_planejado_centavos??0,'Custo planejado'),
      custo_realizado_centavos:nonnegativeMoney(row.custo_realizado_centavos??old?.custo_realizado_centavos??0,'Custo realizado'),
      status:normalizedStatus(area,row.status,old?.status||'pendente')}
  }
  if(area==='etapas'){
    const order=Number(row.ordem??old?.ordem??0)
    if(!Number.isSafeInteger(order)||order<0)throw new Error('Ordem inválida.')
    return {nome:text.parse(row.nome??old?.nome),codigo:String(row.codigo??old?.codigo??'').slice(0,80),
      ordem:order,status:normalizedStatus(area,row.status,old?.status||'ativa'),
      observacoes:String(row.observacoes??old?.observacoes??'').slice(0,1000)}
  }
  const frente=Number(row.frente_id??old?.frente_id)
  if(!Number.isSafeInteger(frente)||frente<=0)throw new Error('Subetapa exige uma etapa de origem.')
  if(old && Number(old.frente_id)!==frente)throw new Error('Não altere a etapa de origem de uma subetapa já vinculada. Abra o cadastro para revisar dependências.')
  const order=Number(row.ordem??old?.ordem??0)
  if(!Number.isSafeInteger(order)||order<0)throw new Error('Ordem inválida.')
  return {nome:text.parse(row.nome??old?.nome),frente_id:frente,
    codigo:String(row.codigo??old?.codigo??'').slice(0,80),
    pavimento:String(row.pavimento??old?.pavimento??'').slice(0,120),
    escopo:String(row.escopo??old?.escopo??'').slice(0,1000),
    ordem:order,status:normalizedStatus(area,row.status,old?.status||'ativa'),
    observacoes:String(row.observacoes??old?.observacoes??'').slice(0,1000)}
}
function minutes(raw){
  if(raw===null||raw===undefined||raw==='')return null
  if(typeof raw!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw))throw new Error('Horário inválido: '+String(raw)+'.')
  const [h,m]=raw.split(':').map(Number)
  return h*60+m
}
function hoursWorked(mark){
  if(mark.tipo!=='trabalho')return null
  const items=[mark.entrada,mark.intervalo_saida,mark.intervalo_entrada,mark.saida].map(minutes)
  if(items.some(x=>x===null))return null
  if(items[1]<items[0]||items[2]<items[1]||items[3]<items[2])return null
  return Number(((items[1]-items[0]+items[3]-items[2])/60).toFixed(2))
}

class OperationalSheetP1Service {
  constructor({db,moduleStorage,timeService,lanClient}){
    this.db=db;this.moduleStorage=moduleStorage;this.timeService=timeService;this.lanClient=lanClient
  }
  commit(payload={}) {
    const area=String(payload.area||'')
    if(!['cronograma','etapas','subetapas'].includes(area))throw new Error('Área não aceita edição de estrutura em lote.')
    const state=this.moduleStorage?.state(area==='cronograma'?'planning':'operation')?.state
    if(state==='central-active'){
      if(!this.lanClient?.operationalSheetCommit)throw new Error('Servidor central precisa ser atualizado para editar planilhas.')
      return this.lanClient.operationalSheetCommit(payload)
    }
    requireLocal(this.moduleStorage,area==='cronograma'?'planning':'operation')
    const obraId=requireWork(payload.obraId)
    const rows=payload.rows
    if(!Array.isArray(rows)||!rows.length||rows.length>MAX_BATCH)throw new Error('Informe de 1 a 500 linhas.')
    const table={cronograma:'cronograma_etapas',etapas:'frentes_obra',subetapas:'subfrentes_obra'}[area]
    return this.db.db.transaction(()=>{
      const ids=[]
      const duplicates=new Set()
      for(let i=0;i<rows.length;i++){
        try{
          const row=rows[i],id=row.id===null||row.id===undefined||row.id===''?null:Number(row.id)
          if(area==='cronograma'&&!id)throw new Error('A programação deve existir antes da edição em lote.')
          if(id!==null&&(!Number.isSafeInteger(id)||id<=0))throw new Error('ID inválido.')
          if(id && duplicates.has(id))throw new Error('ID repetido no lote.')
          if(id)duplicates.add(id)
          const old=id?this.db.get(table,id):null
          if(id&&(!old||old.deleted_at))throw new Error('Registro não encontrado ou excluído.')
          if(old&&Number(old.obra_id)!==obraId)throw new Error('Registro pertence a outra obra.')
          checkRevision(old||{},row)
          const patch=cleanRow(area,row,old,obraId)
          if(area==='cronograma'&&old&&Number(old.frente_id||0)!==Number(patch.frente_id)){
            throw new Error('A etapa vinculada ao cronograma deve ser alterada no formulário individual para preservar o planejamento.')
          }
          if(area==='cronograma'||area==='subetapas'){
            const front=this.db.get('frentes_obra',patch.frente_id)
            if(!front||front.deleted_at||Number(front.obra_id)!==obraId)throw new Error('Etapa vinculada não pertence à obra selecionada.')
          }
          ids.push(this.db.save(table,{...(id?{id}:{}),obra_id:obraId,...patch}).id)
        }catch(err){throw formattedError(i,err)}
      }
      return {updated:rows.length,ids}
    })()
  }
  measurementOverview(payload={}) {
    if(this.moduleStorage?.state('planning')?.state==='central-active'){
      if(!this.lanClient?.operationalSheetMeasurements)throw new Error('Atualize o servidor para consultar medições em planilha.')
      return this.lanClient.operationalSheetMeasurements(payload)
    }
    requireLocal(this.moduleStorage,'planning')
    const obraId=requireWork(payload.obraId)
    const competencia=validCompetence(payload.competencia)
    const items=this.db.db.prepare(`
      SELECT b.id AS item_orcamentario_id, b.descricao, b.unidade, b.frente_id,
        b.quantidade AS quantidade_prevista, b.valor_unitario_centavos,
        COALESCE(SUM(CASE WHEN m.id IS NOT NULL AND m.status!='cancelada'
          AND m.competencia=? THEN mi.quantidade_periodo ELSE 0 END),0) AS quantidade_periodo,
        COALESCE(SUM(CASE WHEN m.id IS NOT NULL AND m.status!='cancelada'
          THEN mi.quantidade_periodo ELSE 0 END),0) AS quantidade_acumulada,
        COALESCE(SUM(CASE WHEN m.id IS NOT NULL AND m.status='aprovada'
          THEN mi.valor_periodo_centavos ELSE 0 END),0) AS valor_a_faturar_centavos
      FROM itens_orcamentarios b
      LEFT JOIN medicao_itens mi ON mi.item_orcamentario_id=b.id
      LEFT JOIN medicoes m ON m.id=mi.medicao_id AND m.obra_id=b.obra_id AND m.deleted_at IS NULL
      WHERE b.obra_id=? AND b.deleted_at IS NULL
      GROUP BY b.id ORDER BY b.frente_id,b.descricao
    `).all(competencia,obraId).map(row=>({
      ...row,id:row.item_orcamentario_id,
      saldo_a_medir:Number((row.quantidade_prevista-row.quantidade_acumulada).toFixed(3)),
      saldo_contratual:null
    }))
    const contracts=this.db.db.prepare(`
      SELECT c.id AS contrato_id,c.numero,c.valor_centavos AS valor_original_centavos,
        COALESCE((SELECT SUM(a.valor_centavos) FROM contrato_aditivos a
          WHERE a.contrato_id=c.id AND a.status IN ('aprovado','aprovada')),0) AS aditivos_centavos,
        COALESCE((SELECT SUM(m.valor_bruto_centavos) FROM medicoes m
          WHERE m.contrato_id=c.id AND m.obra_id=c.obra_id AND m.deleted_at IS NULL
            AND m.status IN ('faturada','recebida')),0) AS faturado_centavos,
        COALESCE((SELECT SUM(m.valor_bruto_centavos) FROM medicoes m
          WHERE m.contrato_id=c.id AND m.obra_id=c.obra_id AND m.deleted_at IS NULL
            AND m.status='aprovada'),0) AS aprovado_a_faturar_centavos
      FROM contratos_obra c
      WHERE c.obra_id=? AND c.deleted_at IS NULL AND c.status!='cancelado'
      ORDER BY c.id
    `).all(obraId).map(row=>{
      const total=Number(row.valor_original_centavos)+Number(row.aditivos_centavos)
      return {...row,total_contratado_centavos:total,
        saldo_contratual_centavos:total-Number(row.faturado_centavos)}
    })
    return {items,contracts,competencia,obraId}
  }
  timeMatrix(payload={}) {
    if(this.moduleStorage?.state('rh')?.state==='central-active'){
      if(!this.lanClient?.operationalSheetTimeMatrix)throw new Error('Atualize o servidor para consultar o ponto em planilha.')
      return this.lanClient.operationalSheetTimeMatrix(payload)
    }
    requireLocal(this.moduleStorage,'rh')
    const competencia=validCompetence(payload.competencia)
    const obraId=payload.obraId?requireWork(payload.obraId):null
    const empresaId=payload.empresaId?Number(payload.empresaId):null
    if(empresaId!==null&&(!Number.isSafeInteger(empresaId)||empresaId<=0))throw new Error('Empresa inválida.')
    const conditions=["e.deleted_at IS NULL","e.status='ativo'"]
    const args=[]
    if(obraId){conditions.push('e.obra_atual_id=?');args.push(obraId)}
    if(empresaId){conditions.push('e.empresa_id=?');args.push(empresaId)}
    const employees=this.db.db.prepare(`SELECT e.id,e.nome,e.empresa_id,e.obra_atual_id
      FROM funcionarios e WHERE ${conditions.join(' AND ')} ORDER BY e.nome,e.id LIMIT 61`).all(...args)
    const truncated=employees.length>60
    const chosen=employees.slice(0,60)
    const [year,month]=competencia.split('-').map(Number)
    const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate()
    // Restrinja a consulta aos funcionários efetivamente selecionados.
    const selectedIds=chosen.map(employee=>employee.id)
    const marks=selectedIds.length?this.db.db.prepare(`
      SELECT p.funcionario_id,p.status AS ponto_status,m.data,m.tipo,
        m.entrada,m.intervalo_saida,m.intervalo_entrada,m.saida,m.observacoes,m.updated_at
      FROM pontos_mensais p JOIN ponto_marcacoes m ON m.ponto_mensal_id=p.id
      WHERE p.competencia=? AND p.funcionario_id IN (${selectedIds.map(()=>'?').join(',')})
        AND m.data BETWEEN ? AND ?
    `).all(competencia,...selectedIds,competencia+'-01',competencia+'-'+String(lastDay).padStart(2,'0')):[]
    const index=new Map(marks.map(row=>[row.funcionario_id+'|'+row.data,row]))
    const points=selectedIds.length?this.db.db.prepare(`
      SELECT funcionario_id,status FROM pontos_mensais WHERE competencia=?
      AND funcionario_id IN (${selectedIds.map(()=>'?').join(',')})
    `).all(competencia,...selectedIds):[]
    const pointStatus=new Map(points.map(row=>[row.funcionario_id,row.status]))
    const rows=[]
    for(const employee of chosen){
      for(let day=1;day<=lastDay;day++){
        const data=competencia+'-'+String(day).padStart(2,'0')
        const mark=index.get(employee.id+'|'+data)
        const current={id:employee.id+'|'+data,funcionario_id:employee.id,
          funcionario_nome:employee.nome,empresa_id:employee.empresa_id,obra_atual_id:employee.obra_atual_id,
          competencia,data,tipo:mark?.tipo||'',entrada:mark?.entrada||'',
          intervalo_saida:mark?.intervalo_saida||'',intervalo_entrada:mark?.intervalo_entrada||'',
          saida:mark?.saida||'',observacoes:mark?.observacoes||'',
          updated_at:mark?.updated_at||'',ponto_status:pointStatus.get(employee.id)||'sem_ficha'}
        current.horas=hoursWorked(current)
        rows.push(current)
      }
    }
    return {competencia,rows,employeeCount:chosen.length,truncated}
  }
  commitTime(payload={}){
    if(this.moduleStorage?.state('rh')?.state==='central-active'){
      if(!this.lanClient?.operationalSheetTimeCommit)throw new Error('Atualize o servidor para salvar o ponto em lote.')
      return this.lanClient.operationalSheetTimeCommit(payload)
    }
    requireLocal(this.moduleStorage,'rh')
    const competencia=validCompetence(payload.competencia)
    const obraId=payload.obraId?requireWork(payload.obraId):null
    const empresaId=payload.empresaId?Number(payload.empresaId):null
    const rows=payload.rows
    if(!Array.isArray(rows)||!rows.length||rows.length>MAX_BATCH)throw new Error('Selecione de 1 a 500 marcações para salvar.')
    const unique=new Set()
    const grouped=new Map()
    const validated=rows.map((row,i)=>{
      try{
        const id=Number(row.funcionario_id)
        if(!Number.isSafeInteger(id)||id<=0)throw new Error('Funcionário inválido.')
        const data=validDate(row.data,false)
        if(!data.startsWith(competencia+'-'))throw new Error('A data não pertence à competência.')
        const key=id+'|'+data
        if(unique.has(key))throw new Error('Dia duplicado no lote.')
        unique.add(key)
        const tipo=String(row.tipo||'')
        if(!POINT_TYPES.includes(tipo))throw new Error('Selecione o tipo de dia.')
        const values=tipo==='trabalho'
          ?[row.entrada,row.intervalo_saida,row.intervalo_entrada,row.saida].map(v=>v===null||v===undefined?'':String(v))
          :['','','','']
        const valuesInMinutes=values.map(minutes)
        if(tipo==='trabalho' && (valuesInMinutes.some(v=>v===null) ||
          valuesInMinutes[1]<valuesInMinutes[0] || valuesInMinutes[2]<valuesInMinutes[1] ||
          valuesInMinutes[3]<valuesInMinutes[2]))throw new Error('Informe quatro horários cronológicos para um dia trabalhado.')
        return {funcionario_id:id,data,tipo,entrada:values[0],intervalo_saida:values[1],
          intervalo_entrada:values[2],saida:values[3],
          observacoes:String(row.observacoes||'').slice(0,500),updated_at:String(row.updated_at||'')}
      }catch(e){throw formattedError(i,e)}
    })
    return this.db.db.transaction(()=>{
      for(let i=0;i<validated.length;i++){
        const row=validated[i]
        try{
          const employee=this.db.get('funcionarios',row.funcionario_id)
          if(!employee||employee.deleted_at||employee.status!=='ativo')throw new Error('Funcionário inativo ou inexistente.')
          if(obraId&&Number(employee.obra_atual_id)!==obraId)throw new Error('Funcionário não pertence à obra selecionada.')
          if(empresaId&&Number(employee.empresa_id)!==empresaId)throw new Error('Funcionário não pertence à empresa selecionada.')
          const point=this.db.db.prepare('SELECT * FROM pontos_mensais WHERE funcionario_id=? AND competencia=?').get(row.funcionario_id,competencia)
          if(point && !['rascunho','preenchido'].includes(String(point.status)))throw new Error('Ficha de ponto já gerada, confirmada ou bloqueada. Não altere por lote.')
          const paid=this.db.db.prepare("SELECT COUNT(*) AS total FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? AND status='pago'").get(row.funcionario_id,competencia)
          if(Number(paid?.total||0)>0)throw new Error('Funcionário possui pagamento confirmado na competência.')
          if(point){
            const old=this.db.db.prepare('SELECT updated_at FROM ponto_marcacoes WHERE ponto_mensal_id=? AND data=?').get(point.id,row.data)
            if(row.updated_at && old?.updated_at && old.updated_at!==row.updated_at)throw new Error('Marcação alterada desde a consulta.')
          }
          if(!grouped.has(row.funcionario_id))grouped.set(row.funcionario_id,[])
          grouped.get(row.funcionario_id).push(row)
        }catch(e){throw formattedError(i,e)}
      }
      for(const [funcionario_id,marks] of grouped){
        this.timeService.save({funcionario_id,competencia,marks})
      }
      return {updated:validated.length,employees:grouped.size}
    })()
  }
}
module.exports={OperationalSheetP1Service,hoursWorked,validDate,validCompetence}
