// Diagnostic-only CDP driver. Runs against a disposable GitHub Windows runner.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');
const [mode, folder] = process.argv.slice(2);
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
          const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
          const target = list.find(x=>x.type==='page') || list[0];
          if (!target?.webSocketDebuggerUrl) throw Error('No CDP target');
          const socket = new WebSocket(target.webSocketDebuggerUrl);
          await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
          let id=0;const pending=new Map();
          socket.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}});
          return {close:()=>socket.close(),async evaluate(expression){const requestId=++id;const result=await Promise.race([new Promise((resolve,reject)=>{pending.set(requestId,{resolve,reject});socket.send(JSON.stringify({id:requestId,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));}),delay(90000).then(()=>{throw Error('CDP evaluation timeout')})]);if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result?.value;},async screenshot(file){const requestId=++id;const result=await new Promise((resolve,reject)=>{pending.set(requestId,{resolve,reject});socket.send(JSON.stringify({id:requestId,method:'Page.captureScreenshot',params:{format:'png'}}));});fs.writeFileSync(file,Buffer.from(result.data,'base64'));}};
        } catch(error) { if(attempt===59)throw error; await delay(1000); }
      }
    }
    if (mode === 'snapshot') {
      const renderer = await connect(9222);
      const data = await renderer.evaluate(`(async()=>({text:document.body.innerText,bootstrap:window.fluxoDre?await window.fluxoDre.app.bootstrap().catch(e=>({error:e.message})):null}))()`);
      fs.writeFileSync(path.join(folder,'snapshot.json'),JSON.stringify(data,null,2));
      await renderer.screenshot(path.join(folder,'screenshot.png'));renderer.close();return;
    }
    const main = await connect(9230);
    const configured = await main.evaluate(`(()=>{const updater=process.mainModule.require('electron-updater').autoUpdater;updater.setFeedURL({provider:'generic',url:'http://127.0.0.1:8877'});updater.autoDownload=false;return {version:process.mainModule.require('electron').app.getVersion(),executable:process.execPath};})()`);
    main.close();
    const renderer = await connect(9222);
    const before = await renderer.evaluate(`window.fluxoDre.app.bootstrap()`);
    await renderer.screenshot(path.join(folder,'before.png'));
    const checked = await renderer.evaluate(`window.fluxoDre.updater.check()`);
    if(checked.availableVersion!=='2.1.1')throw Error('Pinned fixture did not advertise 2.1.1: '+JSON.stringify(checked));
    const downloaded = await renderer.evaluate(`window.fluxoDre.updater.download()`);
    if(downloaded.status!=='downloaded')throw Error('Update not downloaded: '+JSON.stringify(downloaded));
    fs.writeFileSync(path.join(folder,'button-update.json'),JSON.stringify({configured,before,checked,downloaded,action:'window.fluxoDre.updater.install()',note:'Same public IPC used by the button; only update feed redirected to pinned local release fixture.'},null,2));
    try { await renderer.evaluate(`window.fluxoDre.updater.install()`); } catch(error) { fs.writeFileSync(path.join(folder,'install-disconnect.txt'),error.stack); }
    renderer.close();
  })().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{setTimeout(()=>process.exit(process.exitCode||0),100).unref();});
}
