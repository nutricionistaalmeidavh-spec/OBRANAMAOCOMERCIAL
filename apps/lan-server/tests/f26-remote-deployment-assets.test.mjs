import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root=path.resolve(import.meta.dirname,'../packaging/remote')
const read=name=>fs.readFileSync(path.join(root,name),'utf8')

test('reverse proxy example terminates TLS and keeps Obra server on loopback',()=>{
  const caddy=read('Caddyfile.template')
  const env=read('server.env.reverse-proxy.example')
  assert.match(caddy,/reverse_proxy\s+127\.0\.0\.1:4732/i)
  assert.match(env,/^OBRA_NA_MAO_SERVER_MODE=remote$/m)
  assert.match(env,/^OBRA_NA_MAO_SERVER_TRANSPORT=reverse-proxy$/m)
  assert.match(env,/^OBRA_NA_MAO_SERVER_HOST=127\.0\.0\.1$/m)
  assert.doesNotMatch(caddy,/tls\s+internal/i)
})

test('WireGuard example binds server only to a private VPN address and contains no private keys',()=>{
  const env=read('server.env.wireguard.example')
  const wg=read('wg0.conf.template')
  assert.match(env,/^OBRA_NA_MAO_SERVER_MODE=remote$/m)
  assert.match(env,/^OBRA_NA_MAO_SERVER_TRANSPORT=private-network$/m)
  assert.match(env,/^OBRA_NA_MAO_SERVER_HOST=10\.66\.0\.1$/m)
  assert.match(wg,/Address\s*=\s*10\.66\.0\.1\/24/i)
  assert.doesNotMatch(wg,/PrivateKey\s*=\s*[A-Za-z0-9+/]{20,}/i)
  assert.doesNotMatch(env,/(password|secret|token|private_key)\s*=/i)
})
