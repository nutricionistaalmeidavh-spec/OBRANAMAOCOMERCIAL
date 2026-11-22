type Item={entity:string;localId:number;sourceDeviceId:string;payload:Record<string,unknown>};
export function parentStage(item:Item,items:Item[]):string{
  const frontId=Number(item.payload.frente_id||0);
  if(!Number.isSafeInteger(frontId)||frontId<=0)return 'Sem etapa vinculada';
  const stage=items.find(row=>row.entity==='frentes_obra'&&row.localId===frontId&&row.sourceDeviceId===item.sourceDeviceId);
  return stage?String(stage.payload.nome||'Etapa sem nome'):'Etapa não sincronizada';
}
export function stageIsDelayed(schedule:Record<string,unknown>,today:string):boolean{
  const deadline=String(schedule.previsto_fim||'');
  const progress=Number(schedule.percentual_realizado||0);
  const status=String(schedule.status||'').toLowerCase();
  return /^\d{4}-\d{2}-\d{2}$/.test(deadline)&&deadline<today&&progress<100&&!['concluido','concluida','cancelado','cancelada'].includes(status);
}
