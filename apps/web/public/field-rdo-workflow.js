// Pure read-only RDO workflow selectors. The project snapshot remains canonical.
// No secondary queue, workflow ledger or RDO status is created here.
const count=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;

export function pendingRdoActions(draft={},context={}){
  if(context.status==='ready_for_desktop'){
    return context.confirmed?[]:[{
      key:'integration',label:'Acompanhar integração no Desktop',
      detail:'RDO enviado; aguardando confirmação operacional',button:'refreshRdoStatus'
    }];
  }
  const actions=[];
  if(count(draft.attendanceMarked)===0)actions.push({
    key:'attendance',label:'Conferir presença e faltas',detail:'Nenhum colaborador conferido',
    button:'goRdoTeam'
  });
  if(count(draft.finishedSessions)===0||count(draft.openSessions)>0)actions.push({
    key:'production',label:'Concluir apontamentos de produção',
    detail:count(draft.openSessions)>0?
      `${count(draft.openSessions)} apontamento(s) aberto(s)`:'Nenhum apontamento concluído',
    button:'goRdoProduction'
  });
  if(draft.materialsReviewed!==true)actions.push({
    key:'materials',label:'Conferir materiais utilizados',detail:'Confirmar consumo ou ausência de consumo',
    button:'openRdoMaterials'
  });
  if(draft.occurrencesReviewed!==true)actions.push({
    key:'occurrences',label:'Revisar ocorrências e pendências',detail:'Confirmar o registro do dia',
    button:'openRdoOccurrences'
  });
  if(draft.photosReviewed!==true)actions.push({
    key:'photos',label:'Revisar fotos e observações',detail:'Conferir evidências ou ausência de fotos',
    button:'openRdoPhotos'
  });
  return actions;
}

// Immutable compensation transaction, persisted by the existing canonical sync.
export function recordCompensation(employee,details={}){
  const balance=Number(employee?.compensationDays);
  if(!Number.isInteger(balance)||balance<1)throw new Error('Funcionário sem saldo de compensação.');
  if(!employee?.id||!employee?.name)throw new Error('Selecione um funcionário válido.');
  if(typeof details.id!=='string'||!details.id.trim())throw new Error('Identificador de auditoria inválido.');
  if(typeof details.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(details.date)||
     new Date(details.date+'T12:00:00Z').toISOString().slice(0,10)!==details.date)
    throw new Error('Informe uma data válida de compensação.');
  const current={...employee,compensationDays:balance-1};
  return {
    employee:current,
    event:{
      id:details.id,kind:'compensation',employeeId:employee.id,date:details.date,
      time:details.time||'00:00',days:1,
      label:`Compensação de 1 dia registrada para ${employee.name}`
    }
  };
}
