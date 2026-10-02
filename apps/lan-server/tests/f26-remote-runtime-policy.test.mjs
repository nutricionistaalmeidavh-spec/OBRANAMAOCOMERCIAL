import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { loadRuntimeConfig } from '../src/runtime-config.mjs'

const HOME=path.resolve('/tmp/obra-na-mao-f26')

test('runtime keeps LAN/local-network safe defaults',()=>{
  const config=loadRuntimeConfig({env:{},homeDir:HOME})
  assert.equal(config.mode,'lan')
  assert.equal(config.transport,'local-network')
  assert.equal(config.host,'127.0.0.1')
})

test('remote reverse-proxy mode is accepted only on loopback',()=>{
  const config=loadRuntimeConfig({env:{
    OBRA_NA_MAO_SERVER_MODE:'remote',
    OBRA_NA_MAO_SERVER_TRANSPORT:'reverse-proxy',
    OBRA_NA_MAO_SERVER_HOST:'127.0.0.1'
  },homeDir:HOME})
  assert.equal(config.mode,'remote')
  assert.equal(config.transport,'reverse-proxy')
  assert.equal(config.host,'127.0.0.1')
  assert.throws(()=>loadRuntimeConfig({env:{
    OBRA_NA_MAO_SERVER_MODE:'remote',
    OBRA_NA_MAO_SERVER_TRANSPORT:'reverse-proxy',
    OBRA_NA_MAO_SERVER_HOST:'0.0.0.0'
  },homeDir:HOME}),/loopback|127\.0\.0\.1|segur/i)
})

test('remote private-network mode requires an explicit private interface address',()=>{
  const config=loadRuntimeConfig({env:{
    OBRA_NA_MAO_SERVER_MODE:'remote',
    OBRA_NA_MAO_SERVER_TRANSPORT:'private-network',
    OBRA_NA_MAO_SERVER_HOST:'10.66.0.1'
  },homeDir:HOME})
  assert.equal(config.mode,'remote')
  assert.equal(config.transport,'private-network')
  assert.equal(config.host,'10.66.0.1')
  for(const host of ['0.0.0.0','::','203.0.113.10']){
    assert.throws(()=>loadRuntimeConfig({env:{
      OBRA_NA_MAO_SERVER_MODE:'remote',
      OBRA_NA_MAO_SERVER_TRANSPORT:'private-network',
      OBRA_NA_MAO_SERVER_HOST:host
    },homeDir:HOME}),/privad|interface|segur/i)
  }
})

test('remote cannot use local-network transport',()=>{
  assert.throws(()=>loadRuntimeConfig({env:{
    OBRA_NA_MAO_SERVER_MODE:'remote',
    OBRA_NA_MAO_SERVER_TRANSPORT:'local-network',
    OBRA_NA_MAO_SERVER_HOST:'127.0.0.1'
  },homeDir:HOME}),/transporte|remote|remoto/i)
})
