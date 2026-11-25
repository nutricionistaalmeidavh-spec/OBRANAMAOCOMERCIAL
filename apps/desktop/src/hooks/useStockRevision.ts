import { useEffect, useState } from 'react'
/** A small revision token, never a full table scan on a timer. Pause when hidden. */
export function useStockRevision(companyId:string,workId=''){
 const [version,setVersion]=useState(0)
 const [unavailable,setUnavailable]=useState(false)
 useEffect(()=>{
  let disposed=false,busy=false,previous:string|undefined,dirty=false,signals=0
  const filters={...(companyId?{empresa_id:Number(companyId)}:{}),...(workId?{obra_id:Number(workId)}:{})}
  const check=async()=>{
   if(disposed||busy||document.hidden||!window.fluxoDre.compras.stockRevision)return
   busy=true
   const signal=signals
   try{
    const result=await window.fluxoDre.compras.stockRevision(filters)
    if(disposed)return
    if(dirty||(previous!==undefined&&result.revision!==previous))setVersion(v=>v+1)
    previous=result.revision;dirty=signals!==signal;setUnavailable(false)
   }catch{if(!disposed){dirty=true;setUnavailable(true)}}finally{busy=false}
  }
  const invalidate=()=>{signals++;dirty=true;void check()}
  const off=window.fluxoDre.compras.onStockChanged?.(change=>{if(!workId||!change.obra_id||String(change.obra_id)===workId)invalidate()})
  const timer=window.setInterval(()=>void check(),15000)
  const focus=()=>void check()
  window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus)
  void check()
  return()=>{disposed=true;off?.();window.clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus)}
 },[companyId,workId])
 return {version,unavailable}
}
