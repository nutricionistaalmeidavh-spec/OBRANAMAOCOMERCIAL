// Pure helpers shared by the Obra360 field screen and regression tests.
// These are intentionally not a second stock ledger.
const text=value=>String(value??'').trim().replace(/\s+/g,' ');
const array=value=>Array.isArray(value)?value:[];
const number=value=>Number(String(value??'').trim().replace(',','.'));

export function materialLine(input={}){
  const id=text(input.id),descricao=text(input.descricao),unidade=text(input.unidade||'un');
  const quantidade=Math.round(number(input.quantidade)*1e6)/1e6;
  if(!descricao||descricao.length>250||!unidade||unidade.length>24)throw new Error('Informe o material e a unidade.');
  if(!Number.isFinite(quantidade)||quantidade<=0||quantidade>1e9)throw new Error('Informe uma quantidade válida, maior que zero.');
  return {id,descricao,unidade,quantidade,...(input.frente_id?{frente_id:input.frente_id}:{})};
}

export function materialReviewSummary(day={}){
  const materials=array(day.materials);
  const valid=materials.every(row=>{try{materialLine(row);return true}catch{return false}});
  return {ready:day.materialsReviewed===true&&valid,count:materials.length,reviewed:day.materialsReviewed===true,valid};
}

export function rdoSourceFingerprint(day={}){
  const sessions=array(day.sessions);
  return JSON.stringify({
    date:day.date||'',
    attendance:day.attendance||{},
    presentCount:day.presentCount||0,
    absentCount:day.absentCount||0,
    sessions,
    assignments:array(day.assignments),
    plans:array(day.plans),
    events:array(day.events),
    note:day.note||'',
    materials:array(day.materials),
    materialsReviewed:day.materialsReviewed===true
  });
}

export function reconcileRdoStatus(day={}){
  if(day.rdoStatus==='ready_for_desktop'&&day.rdoClosedFingerprint!==rdoSourceFingerprint(day)){
    return {...day,rdoStatus:'draft',rdoClosedFingerprint:null,rdoIntegration:'pending_changes'};
  }
  return {...day};
}
