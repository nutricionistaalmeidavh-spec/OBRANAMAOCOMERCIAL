(()=>{
  if(window.fieldLifecycle)return;
  const screenHandlers=new Set();
  const sheetHandlers=new Set();
  let screenScheduled=false;
  let sheetScheduled=false;

  const run=(handlers)=>{
    for(const handler of [...handlers]){
      try{handler()}catch(error){console.error('[field-lifecycle]',error)}
    }
  };
  const schedule=(kind)=>{
    if(kind==='screen'){
      if(screenScheduled)return;
      screenScheduled=true;
      queueMicrotask(()=>{screenScheduled=false;run(screenHandlers)});
      return;
    }
    if(sheetScheduled)return;
    sheetScheduled=true;
    queueMicrotask(()=>{sheetScheduled=false;run(sheetHandlers)});
  };

  document.addEventListener('field:rendered',()=>schedule('screen'));
  document.addEventListener('field:sheet-rendered',()=>schedule('sheet'));

  window.fieldLifecycle={
    register({screen,sheet}={}){
      if(typeof screen==='function')screenHandlers.add(screen);
      if(typeof sheet==='function')sheetHandlers.add(sheet);
      if(typeof screen==='function')queueMicrotask(()=>screen());
      if(typeof sheet==='function'&&document.getElementById('sheet')?.childElementCount)queueMicrotask(()=>sheet());
      return()=>{
        if(typeof screen==='function')screenHandlers.delete(screen);
        if(typeof sheet==='function')sheetHandlers.delete(sheet);
      };
    },
    refresh(){schedule('screen')},
    refreshSheet(){schedule('sheet')},
    counts(){return{screen:screenHandlers.size,sheet:sheetHandlers.size}}
  };
})();