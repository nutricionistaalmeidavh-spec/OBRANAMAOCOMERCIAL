// Diagnostic-only CDP driver. Runs against a disposable GitHub Windows runner.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');
const [mode, folder, rendererPort='9222'] = process.argv.slice(2);
const expectedUpdateVersion = process.env.CI_UPDATE_VERSION || '2.1.1';
if (mode === 'serve') {
  http.createServer((req,res) => {
    const name = decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1);
    if (!name || path.basename(name) !== name) { res.writeHead(404).end(); return; }
    const file = path.join(folder,name);
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    const stat = fs.statSync(file);
    if (!stat.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200,{'Content-Length':stat.size,'Content-Type':'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  }).listen(8877,'127.0.0.1');
} else {
  (async()=>{
    async function connect(port) {
      for (let attempt=0;attempt<60;attempt++) {
        try {
          const list = await (await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(5000)})).json();
          const target = list.find(x=>x.type==='page') || list[0];
          if (!target?.webSocketDebuggerUrl) throw Error('No CDP target');
          const socket = new WebSocket(target.webSocketDebuggerUrl);
          await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
          let id=0;const pending=new Map();
          socket.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}});
          return {
            close:()=>socket.close(),
            async evaluate(expression){
              const requestId=++id;
              const result=await Promise.race([
                new Promise((resolve,reject)=>{pending.set(requestId,{resolve,reject});socket.send(JSON.stringify({id:requestId,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));}),
                delay(90000).then(()=>{throw Error('CDP evaluation timeout: '+expression.slice(0,80))})
              ]);
              if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
              return result.result?.value;
            },
            async screenshot(file){
              const requestId=++id;
              try {
                const result=await Promise.race([
                  new Promise((resolve,reject)=>{pending.set(requestId,{resolve,reject});socket.send(JSON.stringify({id:requestId,method:'Page.captureScreenshot',params:{format:'png'}}));}),
                  delay(10000).then(()=>{throw Error('Screenshot timeout on Windows runner')})
                ]);
                fs.writeFileSync(file,Buffer.from(result.data,'base64'));
              } catch(error) { fs.writeFileSync(file+'.error.txt',error.stack); }
            }
          };
        } catch(error) { if(attempt===59)throw error; await delay(1000); }
      }
    }
    if (mode === 'snapshot') {
      const renderer = await connect(Number(rendererPort));
      const data = await renderer.evaluate(`(async()=>{const details=document.querySelector('details');if(details)details.open=true;return {text:document.body.innerText,details:details?.textContent||null,bootstrap:window.fluxoDre?await window.fluxoDre.app.bootstrap().catch(e=>({error:e.message})):null,documentRoot:window.fluxoDre?.documentos?.rootStatus?await window.fluxoDre.documentos.rootStatus().catch(e=>({error:e.message})):null}})()`);
      fs.writeFileSync(path.join(folder,'snapshot.json'),JSON.stringify(data,null,2));
      await renderer.screenshot(path.join(folder,'screenshot.png'));renderer.close();return;
    }
    const renderer = await connect(9222);
    for(let attempt=0;attempt<40;attempt++) {
      if(await renderer.evaluate(`typeof window.fluxoDre !== 'undefined'`))break;
      await delay(500);
    }
    fs.writeFileSync(path.join(folder,'initial-page.json'),JSON.stringify(await renderer.evaluate(`({text:document.body.innerText,details:document.querySelector('details')?.textContent||null})`),null,2));
    const before = await renderer.evaluate(`window.fluxoDre.app.bootstrap()`);
    fs.writeFileSync(path.join(folder,'baseline-bootstrap.json'),JSON.stringify(before,null,2));
    console.log('Baseline booted',JSON.stringify(before));
    const main = await connect(9230);
    const configured = await main.evaluate(`(()=>{const req=process.getBuiltinModule('module').createRequire(process.resourcesPath+'/app.asar/package.json');const updater=req('electron-updater').autoUpdater;updater.setFeedURL({provider:'generic',url:'http://127.0.0.1:8877'});updater.autoDownload=false;return {version:req('electron').app.getVersion(),executable:process.execPath};})()`);
    main.close();
    console.log('Pinned feed configured',JSON.stringify(configured));
    const checked = await renderer.evaluate(`window.fluxoDre.updater.check()`);
    console.log('Update check',JSON.stringify(checked));
    if(checked.availableVersion!==expectedUpdateVersion)throw Error('Pinned fixture did not advertise '+expectedUpdateVersion+': '+JSON.stringify(checked));
    const downloaded = await renderer.evaluate(`window.fluxoDre.updater.download()`);
    console.log('Update download',JSON.stringify(downloaded));
    if(downloaded.status!=='downloaded')throw Error('Update not downloaded: '+JSON.stringify(downloaded));
    fs.writeFileSync(path.join(folder,'button-update.json'),JSON.stringify({configured,before,checked,downloaded,action:'window.fluxoDre.updater.install()',note:'Same public IPC used by the button; only update feed redirected to pinned local release fixture.'},null,2));
    try { await Promise.race([renderer.evaluate(`window.fluxoDre.updater.install()`),delay(5000)]); } catch(error) { fs.writeFileSync(path.join(folder,'install-disconnect.txt'),error.stack); }
    renderer.close();
  })().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{setTimeout(()=>process.exit(process.exitCode||0),100).unref();});
}
