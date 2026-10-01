import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const entrypoint = path.resolve(import.meta.dirname, '../src/index.mjs')

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = address.port
      server.close(error => error ? reject(error) : resolve(port))
    })
  })
}

function waitForReady(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get({ host: '127.0.0.1', port, path: '/ready', timeout: 1000 }, response => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', chunk => { body += chunk })
        response.on('end', () => {
          if (response.statusCode === 200) return resolve(JSON.parse(body))
          if (Date.now() >= deadline) return reject(new Error(`readiness status ${response.statusCode}: ${body}`))
          setTimeout(probe, 100)
        })
      })
      request.on('error', error => {
        if (Date.now() >= deadline) return reject(error)
        setTimeout(probe, 100)
      })
      request.on('timeout', () => request.destroy())
    }
    probe()
  })
}

function startServer({ dataDir, port }) {
  const child = spawn(process.execPath, [entrypoint], {
    env: { ...process.env, OBRA_NA_MAO_SERVER_HOST: '127.0.0.1', OBRA_NA_MAO_SERVER_PORT: String(port), OBRA_NA_MAO_SERVER_DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', chunk => { stdout += String(chunk) })
  child.stderr.on('data', chunk => { stderr += String(chunk) })
  return { child, output: () => ({ stdout, stderr }) }
}

function terminate(child, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) return resolve(child.exitCode)
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('headless server did not stop after SIGTERM')) }, timeoutMs)
    child.once('exit', code => { clearTimeout(timer); resolve(code) })
    child.kill('SIGTERM')
  })
}

test('headless process starts without Electron, becomes ready and preserves server identity across restart', { timeout: 40000 }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-headless-'))
  const firstPort = await reservePort()
  const first = startServer({ dataDir, port: firstPort })
  try {
    const firstReady = await waitForReady(firstPort)
    assert.equal(firstReady.ready, true)
    assert.ok(firstReady.identity.serverId)
    assert.equal(await terminate(first.child), 0)

    const secondPort = await reservePort()
    const second = startServer({ dataDir, port: secondPort })
    try {
      const secondReady = await waitForReady(secondPort)
      assert.equal(secondReady.ready, true)
      assert.equal(secondReady.identity.serverId, firstReady.identity.serverId)
      assert.equal(await terminate(second.child), 0)
    } finally {
      if (second.child.exitCode === null) second.child.kill('SIGKILL')
    }
  } finally {
    if (first.child.exitCode === null) first.child.kill('SIGKILL')
    fs.rmSync(dataDir, { recursive: true, force: true })
  }
})
