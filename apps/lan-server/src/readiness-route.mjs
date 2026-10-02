function sendJson(response, statusCode, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload), 'cache-control': 'no-store', ...extraHeaders })
  response.end(payload)
}

export function attachReadinessRoute(server, healthService) {
  if (!server?.listeners || !server?.removeAllListeners || !server?.on) throw new Error('Servidor HTTP inválido para readiness.')
  if (!healthService?.readinessResponse) throw new Error('Health service inválido para readiness.')
  const baseHandlers = server.listeners('request')
  if (!baseHandlers.length) throw new Error('Servidor HTTP não possui handler base de request.')
  server.removeAllListeners('request')
  server.on('request', (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost')
    if (url.pathname === '/ready') {
      if (request.method !== 'GET') return sendJson(response, 405, { error: 'method_not_allowed' }, { allow: 'GET' })
      const result = healthService.readinessResponse()
      return sendJson(response, result.statusCode, result.body)
    }
    for (const handler of baseHandlers) handler.call(server, request, response)
  })
  return server
}
