const asRecord=(value:unknown):Record<string,any>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,any>:{}
const asList=(value:unknown):Array<Record<string,any>>=>Array.isArray(value)?value.map(asRecord):[]
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const editableDay=new Set(['assignments','events','note','plans','sessions','rdoStatus','rdoDraft','rdoClosedFingerprint','materials','materialsReviewed','photos','photosReviewed','photosReviewedFingerprint','occurrencesReviewed','occurrencesReviewedFingerprint','rdoSubmissionId','rdoIntegration'])
const editableEmployee=new Set(['frontKey'])

/** Preserves server-owned administration, attendance, licensing and bridge data. */
export function restrictForemanSnapshot(input:Record<string,any>,current:Record<string,any>):Record<string,any>{
  const original=asRecord(current),incoming=asRecord(input)
  for(const key of ['project','settings','checklistTemplates']){
    if(Object.prototype.hasOwnProperty.call(incoming,key)&&!same(incoming[key],original[key]))throw new Error('Alteração administrativa sem permissão para encarregado.')
  }
  const currentEmployees=asList(original.employees),proposedEmployees=asList(incoming.employees)
  if(proposedEmployees.length!==currentEmployees.length)throw new Error('Cadastro de colaborador não autorizado.')
  const existingById=new Map(currentEmployees.map(employee=>[String(employee.id),employee]))
  const employees=proposedEmployees.map(employee=>{
    const old=existingById.get(String(employee.id))
    if(!old)throw new Error('Cadastro de colaborador não autorizado.')
    for(const key of Object.keys(employee))if(!editableEmployee.has(key)&&!same(employee[key],old[key]))throw new Error('Dados do colaborador não autorizados.')
    return {...old,...Object.fromEntries(Object.entries(employee).filter(([key])=>editableEmployee.has(key)))}
  })
  const oldDays=asRecord(original.days),receivedDays=asRecord(incoming.days),dayKeys=new Set<string>(asRecord(original._remote).dayKeys||[])
  const days:{[key:string]:any}={...oldDays}
  for(const[date,submitted]of Object.entries(receivedDays)){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Data de RDO inválida.')
    const previous=asRecord(oldDays[date]),proposed=asRecord(submitted)
    if(!oldDays[date]&&dayKeys.has(date))throw new Error('Histórico do dia não carregado. Consulte antes de editar.')
    for(const key of ['attendance','presentCount','absentCount']){
      if(Object.prototype.hasOwnProperty.call(proposed,key)&&oldDays[date]&&!same(proposed[key],previous[key]))throw new Error('Presença deve ser alterada pelo registro de equipe autorizado.')
    }
    for(const key of Object.keys(proposed))if(!editableDay.has(key)&&key!=='date'&&!['attendance','presentCount','absentCount'].includes(key)&&oldDays[date]&&!same(proposed[key],previous[key]))
      throw new Error('Campo do RDO não autorizado para encarregado.')
    days[date]={...previous,date,...Object.fromEntries(Object.entries(proposed).filter(([key])=>editableDay.has(key)))}
    if(oldDays[date])for(const key of ['attendance','presentCount','absentCount'])if(Object.prototype.hasOwnProperty.call(previous,key))days[date][key]=previous[key]
  }
  const remote=asRecord(incoming._remote)
  return {...original,_remote:remote,days,employees,
    floors:Array.isArray(incoming.floors)?incoming.floors:original.floors,
    issues:Array.isArray(incoming.issues)?incoming.issues:original.issues,
    history:Array.isArray(incoming.history)?incoming.history:original.history}
}
