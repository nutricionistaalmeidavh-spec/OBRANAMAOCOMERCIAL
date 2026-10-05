export type FieldLifecycleHandlers={screen?:()=>void;sheet?:()=>void}

export function registerFieldLifecycle(handlers:FieldLifecycleHandlers){
  let unsubscribe:(()=>void)|null=null
  let disposed=false
  const attach=()=>{
    if(disposed||unsubscribe||!window.fieldLifecycle)return
    unsubscribe=window.fieldLifecycle.register(handlers)
  }
  if(window.fieldLifecycle)attach()
  else document.addEventListener('field:lifecycle-ready',attach,{once:true})
  return()=>{
    disposed=true
    document.removeEventListener('field:lifecycle-ready',attach)
    unsubscribe?.()
    unsubscribe=null
  }
}
