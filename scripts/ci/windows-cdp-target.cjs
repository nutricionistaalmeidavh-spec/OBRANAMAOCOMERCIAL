// Diagnostic-only CDP target selection for disposable Windows CI installs.
// Renderer pages and the Electron main-process Node inspector are separate targets.
function selectRendererTarget(targets){
 const available=(Array.isArray(targets)?targets:[]).filter(x=>x?.webSocketDebuggerUrl)
 if(!available.length)throw new Error('Nenhum alvo de depuração CDP disponível.')
 const pages=available.filter(x=>x.type==='page')
 const activeUrl=x=>/^(file:\/\/|app:\/\/|https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/)/i.test(x.url||'')
 return pages.find(activeUrl)
  ||pages.find(x=>!/(?:^about:blank$|^devtools:|^chrome:)/i.test(x.url||''))
  ||pages[0]
  ||available.find(activeUrl)
  ||available.find(x=>!/(?:^about:blank$|^devtools:|^chrome:)/i.test(x.url||''))
  ||available[0]
}
function readableBodyExpression(){
 return "(document.body?.innerText||'').trim()"
}
module.exports={selectRendererTarget,readableBodyExpression}
