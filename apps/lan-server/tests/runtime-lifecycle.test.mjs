import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { createRuntime } from '../src/server-runtime.mjs'

class FakeServer extends EventEmitter {
  constructor() {
    super()
    this.listenCalls = 0
    this.closeCalls = 0
    this.listening = false
  }

  listen(port, host, callback) {
    this.listenCalls += 1
    this.port = port
    this.host = host
    this.listening = true
    queueMicrotask(() => callback?.())
    return this
  }

  close(callback) {
    this.closeCalls += 1
    this.listening = false
    queueMicrotask(() => callback?.())
    return this
  }
}

test('createRuntime is embeddable and does not bootstrap or register signals before start', () => {
  let bootstrapCalls = 0
  const beforeInt = process.listenerCount('SIGINT')
  const beforeTerm = process.listenerCount('SIGTERM')
  const runtime = createRuntime({
    host: '127.0.0.1',
    port: 4732,
    bootstrap: () => {
      bootstrapCalls += 1
      return { server: new FakeServer() }
    }
  })

  assert.equal(bootstrapCalls, 0)
  assert.equal(runtime.state(), 'idle')
  assert.equal(process.listenerCount('SIGINT'), beforeInt)
  assert.equal(process.listenerCount('SIGTERM'), beforeTerm)
})

test('start bootstraps and listens exactly once even when called twice', async () => {
  let bootstrapCalls = 0
  const server = new FakeServer()
  const runtime = createRuntime({
    host: '127.0.0.1',
    port: 4732,
    bootstrap: async () => {
      bootstrapCalls += 1
      return { server }
    }
  })

  const first = await runtime.start()
  const second = await runtime.start()

  assert.equal(first, second)
  assert.equal(runtime.state(), 'running')
  assert.equal(bootstrapCalls, 1)
  assert.equal(server.listenCalls, 1)
  assert.equal(server.host, '127.0.0.1')
  assert.equal(server.port, 4732)
})

test('stop closes server and resources exactly once and is safe to repeat', async () => {
  const server = new FakeServer()
  let closeCalls = 0
  const runtime = createRuntime({
    host: '127.0.0.1',
    port: 4732,
    bootstrap: () => ({ server, close: () => { closeCalls += 1 } })
  })

  await runtime.start()
  await runtime.stop()
  await runtime.stop()

  assert.equal(runtime.state(), 'idle')
  assert.equal(server.closeCalls, 1)
  assert.equal(closeCalls, 1)
})

test('bootstrap failure leaves runtime idle and allows a later retry', async () => {
  let attempts = 0
  const server = new FakeServer()
  const runtime = createRuntime({
    host: '127.0.0.1',
    port: 4732,
    bootstrap: () => {
      attempts += 1
      if (attempts === 1) throw new Error('bootstrap failed')
      return { server }
    }
  })

  await assert.rejects(() => runtime.start(), /bootstrap failed/)
  assert.equal(runtime.state(), 'idle')

  await runtime.start()
  assert.equal(runtime.state(), 'running')
  assert.equal(attempts, 2)
  assert.equal(server.listenCalls, 1)
})

test('listen failure cleans partially bootstrapped resources', async () => {
  const server = new FakeServer()
  server.listen = function listen() {
    this.listenCalls += 1
    queueMicrotask(() => this.emit('error', new Error('EADDRINUSE')))
    return this
  }
  let closeCalls = 0
  const runtime = createRuntime({
    host: '127.0.0.1',
    port: 4732,
    bootstrap: () => ({ server, close: () => { closeCalls += 1 } })
  })

  await assert.rejects(() => runtime.start(), /EADDRINUSE/)
  assert.equal(runtime.state(), 'idle')
  assert.equal(closeCalls, 1)
})
