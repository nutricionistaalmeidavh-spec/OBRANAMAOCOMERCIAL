export type SnapshotState='current'|'stale'|'unknown';
export type SnapshotFreshness={state:SnapshotState;label:string;dateLabel:string|null};

const OFFLINE_AFTER_MS=15*60*1000;
const br=(date:Date)=>date.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

/**
 * An explicit publication time is required before calling any KPI current.
 * desktopSeenAt is the office Desktop heartbeat: it tells "data unchanged" apart
 * from "Desktop switched off", which the publication time alone cannot.
 */
export function snapshotFreshness(value:unknown,now:Date=new Date(),desktopSeenAt?:unknown):SnapshotFreshness{
  const base=publicationFreshness(value,now);
  if(typeof desktopSeenAt!=='string'||!desktopSeenAt.trim())return base;
  const seen=new Date(desktopSeenAt),seenTime=seen.getTime();
  if(!Number.isFinite(seenTime)||seenTime>now.getTime()+5*60_000)return base;
  if(now.getTime()-seenTime>OFFLINE_AFTER_MS)
    return {state:'stale',label:`Desktop do escritório desligado desde ${br(seen)}${base.dateLabel?' · dados de '+base.dateLabel:''}. Os números voltam a atualizar quando ele for ligado.`,dateLabel:base.dateLabel};
  if(base.dateLabel)return {state:'current',label:'Desktop conectado · dados de '+base.dateLabel,dateLabel:base.dateLabel};
  return base;
}

function publicationFreshness(value:unknown,now:Date):SnapshotFreshness{
  if(typeof value!=='string'||!value.trim())return {state:'unknown',label:'Sem data de atualização do Desktop',dateLabel:null};
  const published=new Date(value),time=published.getTime(),current=now.getTime();
  if(!Number.isFinite(time)||!Number.isFinite(current)||time>current+5*60_000)
    return {state:'unknown',label:'Data de atualização não verificável',dateLabel:null};
  const dateLabel=published.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const state=current-time>=24*60*60*1000?'stale':'current';
  return {state,label:state==='stale'?'Desatualizado · última publicação '+dateLabel:'Publicado pelo Desktop em '+dateLabel,dateLabel};
}
