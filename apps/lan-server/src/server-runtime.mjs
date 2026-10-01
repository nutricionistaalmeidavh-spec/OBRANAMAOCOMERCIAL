function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    const onError = error => {
      server.off?.('error', onError)
      reject(error)
    }
    server.once?.('error', onError)
    server.listen(port, host, () => {
      server.off?.('error', onError)
      resolve()
    })
  })
}

function closeServer(server) {
  if (!server?.listening) return Promise.resolve()
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })
}

async function cleanup(resources) {
  if (!resources) return
  let serverError = null
  try {
    await closeServer(resources.server)
  } catch (error) {
    serverError = error
  }
  try {
    await resources.close?.()
  } catch (error) {
    if (!serverError) serverError = error
  }
  if (serverError) throw serverError
}

export function createRuntime({ host, port, bootstrap } = {}) {
  if (typeof bootstrap !== 'function') throw new Error('Runtime exige uma função de bootstrap.')
  if (!host) throw new Error('Runtime exige host válido.')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Runtime exige porta TCP válida.')

  let phase = 'idle'
  let resources = null
  let startPromise = null
  let stopPromise = null

  const api = {
    state: () => phase,
    resources: () => resources,
    async start() {
      if (phase === 'running') return api
      if (startPromise) return startPromise

      startPromise = (async () => {
        phase = 'starting'
        let created = null
        try {
          created = await bootstrap()
          if (!created?.server?.listen || !created?.server?.close) {
            throw new Error('Bootstrap do runtime não retornou um servidor HTTP válido.')
          }
          await listen(created.server, port, host)
          resources = created
          phase = 'running'
          return api
        } catch (error) {
          try {
            await cleanup(created)
          } catch {}
          resources = null
          phase = 'idle'
          throw error
        }
      })()

      try {
        return await startPromise
      } finally {
        startPromise = null
      }
    },
    async stop() {
      if (stopPromise) return stopPromise
      if (phase === 'idle') return

      stopPromise = (async () => {
        if (phase === 'starting' && startPromise) {
          try { await startPromise } catch { return }
        }
        if (phase === 'idle') return
        phase = 'stopping'
        const current = resources
        resources = null
        try {
          await cleanup(current)
        } finally {
          phase = 'idle'
        }
      })()

      try {
        return await stopPromise
      } finally {
        stopPromise = null
      }
    }
  }

  return api
}
