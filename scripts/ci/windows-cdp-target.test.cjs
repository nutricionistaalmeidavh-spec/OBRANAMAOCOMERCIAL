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

test('never selects a non-page target as the renderer',()=>{
 assert.throws(()=>selectRendererTarget([{type:'other',webSocketDebuggerUrl:'ws://other',url:'about:blank'}]),/página|renderer/i)
})
