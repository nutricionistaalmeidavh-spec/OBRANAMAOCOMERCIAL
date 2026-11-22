export type SnapshotState='current'|'stale'|'unknown';
export type SnapshotFreshness={state:SnapshotState;label:string;dateLabel:string|null};

/** An explicit publication time is required before calling any KPI current. */
export function snapshotFreshness(value:unknown,now:Date=new Date()):SnapshotFreshness{
  if(typeof value!=='string'||!value.trim())return {state:'unknown',label:'Sem data de atualização do Desktop',dateLabel:null};
  const published=new Date(value),time=published.getTime(),current=now.getTime();
  if(!Number.isFinite(time)||!Number.isFinite(current)||time>current+5*60_000)
    return {state:'unknown',label:'Data de atualização não verificável',dateLabel:null};
  const dateLabel=published.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const state=current-time>=24*60*60*1000?'stale':'current';
  return {state,label:state==='stale'?'Desatualizado · última publicação '+dateLabel:'Publicado pelo Desktop em '+dateLabel,dateLabel};
}
