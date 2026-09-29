import http from 'node:http'

export const LAN_API_VERSION = '1'
export const LAN_SERVER_VERSION = '0.1.0'

function sendJson(response, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    ...extraHeaders
  })
  response.end(payload)
}

export function createLanServer({ serverVersion = LAN_SERVER_VERSION } = {}) {
  return http.createServer((request, response) => {
    if (request.method !== 'GET') {
      return sendJson(response, 405, { error: 'method_not_allowed' }, { allow: 'GET' })
    }

    const url = new URL(request.url || '/', 'http://localhost')
    if (url.pathname === '/health') {
      return sendJson(response, 200, { status: 'ok', product: 'Obra na Mão', apiVersion: LAN_API_VERSION })
    }
    if (url.pathname === '/version') {
      return sendJson(response, 200, { product: 'Obra na Mão', apiVersion: LAN_API_VERSION, serverVersion })
    }
    return sendJson(response, 404, { error: 'not_found' })
  })
}
