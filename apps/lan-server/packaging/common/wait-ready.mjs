import http from 'node:http'

function probe({ host, port, requestTimeoutMs }) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host, port, path: '/ready', timeout: requestTimeoutMs }, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { body += chunk })
      response.on('end', () => {
        if (response.statusCode !== 200) return resolve({ ready: false, retryable: true, statusCode: response.statusCode, body })
        try {
          const parsed = JSON.parse(body)
          if (parsed?.ready === true) return resolve({ ready: true, payload: parsed })
          resolve({ ready: false, retryable: true, statusCode: response.statusCode, body })
        } catch (error) {
          reject(new Error('Resposta /ready inválida: JSON esperado.', { cause: error }))
        }
      })
    })
    request.on('timeout', () => request.destroy(new Error('readiness request timeout')))
    request.on('error', reject)
  })
}

export async function waitForReady({ host = '127.0.0.1', port = 4732, timeoutMs = 30000, intervalMs = 250, requestTimeoutMs = 1500 } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastError = null
  while (Date.now() <= deadline) {
    try {
      const result = await probe({ host, port, requestTimeoutMs })
      if (result.ready) return result.payload
    } catch (error) {
      if (/Resposta \/ready inválida/.test(String(error?.message || ''))) throw error
      lastError = error
    }
    if (Date.now() + intervalMs > deadline) break
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Obra na Mão Server não ficou ready em ${timeoutMs}ms.`, { cause: lastError || undefined })
}
