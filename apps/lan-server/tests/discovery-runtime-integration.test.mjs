import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const source=fs.readFileSync(path.resolve(import.meta.dirname,'../src/index.mjs'),'utf8')

test('headless runtime starts and stops LAN discovery with the same server identity',()=>{
  assert.match(source,/createDiscoveryService/)
  assert.match(source,/identity\.state\(\)/)
  assert.match(source,/discovery\.start\(\)/)
  assert.match(source,/discovery\.stop\(\)/)
  assert.match(source,/instanceName/)
})
