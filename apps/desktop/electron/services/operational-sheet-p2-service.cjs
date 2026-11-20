const { parseDecimal }=require('./operational-sheet-service.cjs')

const TASK_STATUSES=new Set(['aberta','em_andamento','concluida','cancelada'])
const TASK_PRIORITIES=new Set(['baixa','normal','alta','urgente'])
const MAX_ROWS=500

function requireLocal(moduleStorage){
  const state=moduleStorage?.state?.('operation')?.state
  if(!['local','migration-required'].includes(state))
    throw new Error('A edição em lote não está homologada no servidor. Utilize o cadastro individual, sem fallback local.')
}
function validateDate(value){
  if(value===null||value===undefined||value==='')return null
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error('Prazo inválido: use AAAA-MM-DD.')
  const date=new Date(value+'T00:00:00.000Z')
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)
    throw new Error('Prazo contém data inexistente.')
  return value
}
function taskPatch(row,old,today){
  const status=String(row.status??old.status)
  const prioridade=String(row.prioridade??old.prioridade)
  if(!TASK_STATUSES.has(status))throw new Error('Status inválido.')
  if(!TASK_PRIORITIES.has(prioridade))throw new Error('Prioridade inválida.')
  const responsavel=String(row.responsavel??old.responsavel??'').trim()
  if(responsavel.length>200)throw new Error('Responsável excede 200 caracteres.')
  const prazo=validateDate(row.prazo??old.prazo??null)
  const concluido_em=status==='concluida'?(old.status==='concluida'&&old.concluido_em?old.concluido_em:today()):null
  return {responsavel,prazo,prioridade,status,concluido_em}
}
function money(value,field){
  const parsed=parseDecimal(value)
  if(parsed===null||parsed<0||!Number.isFinite(parsed)||Math.round(parsed*100)>Number.MAX_SAFE_INTEGER)
    throw new Error(field+' inválido: informe um valor não negativo.')
  return parsed.toFixed(2)
}
function qty(value,field){
  const n=parseDecimal(value)
  if(n===null||n<0||n>24)throw new Error(field+' deve estar entre 0 e 24.')
  return String(n)
}
function normalizeRdoRows(area,rows){
  if(!['equipe','equipamentos'].includes(area))throw new Error('Tipo de planilha do RDO inválido.')
  if(!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS)throw new Error('O RDO aceita de 1 a 500 linhas em edição.')
  const seen=new Set()
  return rows.map((row,index)=>{
    try{
      const id=Number(row.id)
      if(!Number.isSafeInteger(id)||id<=0)throw new Error('Linha sem identificador válido.')
      if(seen.has(id))throw new Error('Linha duplicada no lote.')
      seen.add(id)
      const nome=String(row.nome??'').trim()
      if(!nome||nome.length>250)throw new Error('Nome é obrigatório e deve ter até 250 caracteres.')
      const custo=money(row.custo??'0','Custo')
      const frente_id=String(row.frente_id||'')
      if(frente_id && (!/^\d+$/.test(frente_id)||Number(frente_id)<=0))throw new Error('Etapa inválida.')
      const observacoes=String(row.observacoes||'').slice(0,500)
      if(area==='equipe'){
        const funcionario_id=String(row.funcionario_id||'')
        if(funcionario_id&&(!/^\d+$/.test(funcionario_id)||Number(funcionario_id)<=0))throw new Error('Funcionário inválido.')
        return {id,nome,funcao:String(row.funcao||'').slice(0,200),
          horas:qty(row.horas??'0','Horas'),custo,funcionario_id,frente_id,observacoes}
      }
      return {id,nome,horas_uso:qty(row.horas_uso??'0','Horas de uso'),custo,frente_id,observacoes}
    }catch(error){throw new Error('Linha '+(index+1)+': '+(error instanceof Error?error.message:String(error)))}
  })
}
class OperationalSheetP2Service {
  constructor({db,moduleStorage,lanClient,today=()=>new Date().toISOString().slice(0,10)}){
    this.db=db;this.moduleStorage=moduleStorage;this.lanClient=lanClient;this.today=today
  }
  commitTasks(payload={}){
    if(this.moduleStorage?.state('operation')?.state==='central-active'){
      if(!this.lanClient?.operationalSheetCommit)throw new Error('Atualize o servidor para salvar tarefas em lote.')
      return this.lanClient.operationalSheetCommit({...payload,area:'tarefas'})
    }
    requireLocal(this.moduleStorage)
    const obraId=Number(payload.obraId)
    if(!Number.isSafeInteger(obraId)||obraId<=0)throw new Error('Selecione uma obra válida.')
    const rows=payload.rows
    if(!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS)
      throw new Error('Informe de 1 a 500 tarefas para edição.')
    const seen=new Set()
    return this.db.db.transaction(()=>{
      const ids=[]
      for(let i=0;i<rows.length;i++){
        try{
          const row=rows[i],id=Number(row.id)
          if(!Number.isSafeInteger(id)||id<=0)throw new Error('ID de tarefa inválido.')
          if(seen.has(id))throw new Error('ID de tarefa duplicado no lote.')
          seen.add(id)
          const old=this.db.get('tarefas_obra',id)
          if(!old||old.deleted_at)throw new Error('Tarefa inexistente ou excluída.')
          if(Number(old.obra_id)!==obraId)throw new Error('Tarefa pertence a outra obra.')
          if(old.origem_tipo==='rdo_ocorrencia'||old.rdo_ocorrencia_id)throw new Error('Pendência gerada pelo diário deve ser editada no RDO de origem.')
          if(row.updated_at&&old.updated_at&&String(row.updated_at)!==String(old.updated_at))
            throw new Error('Tarefa alterada por outro usuário. Atualize os dados antes de salvar.')
          const patch=taskPatch(row,old,this.today)
          const updated=this.db.save('tarefas_obra',{id,...patch})
          ids.push(updated.id)
        }catch(error){throw new Error('Linha '+(i+1)+': '+(error instanceof Error?error.message:String(error)))}
      }
      return {updated:ids.length,ids}
    })()
  }
}
module.exports={OperationalSheetP2Service,normalizeRdoRows,validateDate}
