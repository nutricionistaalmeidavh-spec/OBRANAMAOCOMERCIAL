// Only for disposable CI Electron CDP snapshots. No data or credentials inspected.
function selectRendererTarget(targets){
 const pages=(Array.isArray(targets)?targets:[]).filter(x=>x?.type==='page'&&x.webSocketDebuggerUrl)
 if(!pages.length)throw new Error('Nenhuma página do renderer Electron encontrada no CDP.')
 const loaded=pages.find(x=>/^(file:\/\/|app:\/\/|https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/)/i.test(x.url||''))
 return loaded||pages.find(x=>!/(?:^about:blank$|^devtools:|^chrome:)/i.test(x.url||''))||pages[0]
}
function readableBodyExpression(){
 return "(document.body?.innerText||'').trim()"
}
module.exports={selectRendererTarget,readableBodyExpression}
