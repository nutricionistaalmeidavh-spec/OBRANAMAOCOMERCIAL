const {test}=require('node:test')
const assert=require('node:assert/strict')
const {selectRendererTarget,readableBodyExpression}=require('./windows-cdp-target.cjs')

test('prefers loaded Electron application window over blank DevTools page',()=>{
 const pages=[
  {type:'page',url:'about:blank',webSocketDebuggerUrl:'ws://blank'},
  {type:'page',url:'file:///C:/Program%20Files/Obra/index.html',webSocketDebuggerUrl:'ws://app'},
  {type:'other',url:'chrome://inspect',webSocketDebuggerUrl:'ws://other'}
 ]
 assert.equal(selectRendererTarget(pages).webSocketDebuggerUrl,'ws://app')
})

test('body readiness probe cannot crash when renderer document is not yet mounted',()=>{
 const expression=readableBodyExpression()
 const evaluate=new Function('document',`return ${expression}`)
 assert.equal(evaluate({body:null}),'')
 assert.equal(evaluate({body:{innerText:'    Obra na Mão   '}}),'Obra na Mão')
})

test('connects to the Electron main-process debugger when there is no page target',()=>{
 const targets=[{type:'node',url:'file:///app.asar/main.cjs',webSocketDebuggerUrl:'ws://electron-main'}]
 assert.equal(selectRendererTarget(targets).webSocketDebuggerUrl,'ws://electron-main')
})

test('only accepts debugger targets with a websocket endpoint',()=>{
 assert.throws(()=>selectRendererTarget([{type:'other',url:'about:blank'}]),/CDP|debugger/i)
})

test('prefers application page when both Electron main and renderer are available',()=>{
 const targets=[
  {type:'node',url:'file:///app.asar/main.cjs',webSocketDebuggerUrl:'ws://electron-main'},
  {type:'page',url:'file:///app.asar/index.html',webSocketDebuggerUrl:'ws://renderer'}
 ]
 assert.equal(selectRendererTarget(targets).webSocketDebuggerUrl,'ws://renderer')
})
