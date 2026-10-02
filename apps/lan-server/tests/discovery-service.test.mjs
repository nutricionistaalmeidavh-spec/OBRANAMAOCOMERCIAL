import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import {
  createDiscoveryService,
  DISCOVERY_GROUP,
  DISCOVERY_PORT,
  DISCOVERY_PROTOCOL_VERSION
} from '../src/discovery-service.mjs'

class FakeSocket extends EventEmitter {
  constructor(){ super(); this.sent=[]; this.memberships=[]; this.closed=false; this.ttl=null }
  bind(port,host,callback){ this.bound={port,host}; callback?.() }
  addMembership(group){ this.memberships.push(group) }
  setMulticastTTL(value){ this.ttl=value }
  send(payload,port,address,callback){ this.sent.push({payload:Buffer.from(payload),port,address}); callback?.() }
  close(callback){ this.closed=true; callback?.() }
}

test('discovery stays disabled when HTTP server is loopback-only', async()=>{
  let created=0
  const service=createDiscoveryService({
    host:'127.0.0.1', servicePort:4732, serverId:'srv-1', instanceName:'Escritorio',
    socketFactory:()=>{created++; return new FakeSocket()}
  })
  assert.deepEqual(await service.start(),{running:false,reason:'loopback-only'})
  assert.equal(created,0)
})

test('LAN discovery responds only to valid nonce-matched v1 queries with public technical metadata', async()=>{
  const socket=new FakeSocket()
  const service=createDiscoveryService({
    host:'0.0.0.0', servicePort:4732, serverId:'srv-1', instanceName:'Servidor Escritório',
    socketFactory:()=>socket
  })
  const state=await service.start()
  assert.equal(state.running,true)
  assert.deepEqual(socket.bound,{port:DISCOVERY_PORT,host:'0.0.0.0'})
  assert.deepEqual(socket.memberships,[DISCOVERY_GROUP])
  assert.equal(socket.ttl,1)

  socket.emit('message',Buffer.from(JSON.stringify({
    type:'obra-na-mao.discovery.query',
    version:DISCOVERY_PROTOCOL_VERSION,
    nonce:'abc-123'
  })),{address:'192.168.1.20',port:53120})

  assert.equal(socket.sent.length,1)
  const reply=JSON.parse(socket.sent[0].payload.toString('utf8'))
  assert.deepEqual(socket.sent[0].address,'192.168.1.20')
  assert.deepEqual(socket.sent[0].port,53120)
  assert.deepEqual(reply,{
    type:'obra-na-mao.discovery.response',
    version:DISCOVERY_PROTOCOL_VERSION,
    nonce:'abc-123',
    product:'Obra na Mão',
    apiVersion:'1',
    serverId:'srv-1',
    instanceName:'Servidor Escritório',
    port:4732
  })
  assert.equal(JSON.stringify(reply).match(/token|secret|setup|pair|company/i),null)

  socket.emit('message',Buffer.from('not-json'),{address:'192.168.1.21',port:53121})
  socket.emit('message',Buffer.from(JSON.stringify({type:'obra-na-mao.discovery.query',version:99,nonce:'x'})),{address:'192.168.1.21',port:53121})
  assert.equal(socket.sent.length,1)

  await service.stop()
  assert.equal(socket.closed,true)
})

test('discovery start/stop are idempotent', async()=>{
  const socket=new FakeSocket()
  const service=createDiscoveryService({
    host:'0.0.0.0',servicePort:4810,serverId:'srv-2',instanceName:'Matriz',socketFactory:()=>socket
  })
  const a=await service.start()
  const b=await service.start()
  assert.equal(a.running,true)
  assert.equal(b.running,true)
  await service.stop()
  await service.stop()
  assert.equal(socket.closed,true)
})
