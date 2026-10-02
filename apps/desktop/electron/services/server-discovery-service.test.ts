import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'

const require=createRequire(import.meta.url)
const {
  ServerDiscoveryService,
  DISCOVERY_GROUP,
  DISCOVERY_PORT
}=require('./server-discovery-service.cjs')

class FakeSocket extends EventEmitter {
  sent:any[]=[]
  bound=false
  closed=false
  bind(_port:number,callback:()=>void){this.bound=true;callback()}
  setMulticastTTL(_ttl:number){}
  send(payload:Buffer,port:number,address:string,callback?:()=>void){this.sent.push({payload,port,address});callback?.()}
  close(){this.closed=true}
}

const response=(status:number,body:any)=>({ok:status>=200&&status<300,status,json:async()=>body})

describe('ServerDiscoveryService',()=>{
  it('descobre, valida por HTTP e deduplica servidores usando o IP real do datagrama',async()=>{
    const socket=new FakeSocket()
    const fetchImpl=vi.fn(async(url:string)=>{
      if(url.endsWith('/health'))return response(200,{status:'ok',product:'Obra na Mão',apiVersion:'1'})
      if(url.endsWith('/ready'))return response(200,{ready:true,status:'ready',identity:{serverId:'srv-1'}})
      throw new Error('URL inesperada')
    })
    const service=new ServerDiscoveryService({
      socketFactory:()=>socket,
      fetchImpl,
      randomNonce:()=> 'nonce-test'
    })

    const pending=service.discover({timeoutMs:20})
    await new Promise(resolve=>setTimeout(resolve,0))
    expect(socket.sent).toHaveLength(1)
    expect(socket.sent[0].port).toBe(DISCOVERY_PORT)
    expect(socket.sent[0].address).toBe(DISCOVERY_GROUP)
    const query=JSON.parse(socket.sent[0].payload.toString('utf8'))
    expect(query).toMatchObject({type:'obra-na-mao.discovery.query',version:1,nonce:'nonce-test'})

    const payload=Buffer.from(JSON.stringify({
      type:'obra-na-mao.discovery.response',version:1,nonce:'nonce-test',
      product:'Obra na Mão',apiVersion:'1',serverId:'srv-1',instanceName:'Escritório',port:4732,
      host:'10.10.10.10',token:'must-not-be-trusted'
    }))
    socket.emit('message',payload,{address:'192.168.1.50',port:4733})
    socket.emit('message',payload,{address:'192.168.1.50',port:4733})

    const result=await pending
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      serverId:'srv-1',name:'Escritório',host:'192.168.1.50',port:4732,
      baseUrl:'http://192.168.1.50:4732',ready:true
    })
    expect((result[0] as any).token).toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledWith('http://192.168.1.50:4732/health',expect.any(Object))
    expect(fetchImpl).toHaveBeenCalledWith('http://192.168.1.50:4732/ready',expect.any(Object))
    expect(socket.closed).toBe(true)
  })

  it('ignora resposta com nonce errado ou servidor incompatível',async()=>{
    const socket=new FakeSocket()
    const service=new ServerDiscoveryService({socketFactory:()=>socket,fetchImpl:vi.fn(),randomNonce:()=> 'nonce-ok'})
    const pending=service.discover({timeoutMs:10})
    await new Promise(resolve=>setTimeout(resolve,0))
    socket.emit('message',Buffer.from(JSON.stringify({
      type:'obra-na-mao.discovery.response',version:1,nonce:'outro',
      product:'Obra na Mão',apiVersion:'1',serverId:'srv-x',instanceName:'X',port:4732
    })),{address:'192.168.1.20',port:4733})
    await expect(pending).resolves.toEqual([])
  })
})
