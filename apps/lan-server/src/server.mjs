import http from 'node:http'

export const LAN_API_VERSION = '1'
export const LAN_SERVER_VERSION = '0.2.0'

const MAX_BODY_BYTES = 1024 * 1024
const ENTITY_ROUTE = /^\/api\/v1\/(empresas|clientes|obras)(?:\/(\d+))?\/?$/

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

function methodNotAllowed(response, allow) {
  return sendJson(response, 405, { error: 'method_not_allowed' }, { allow: allow.join(', ') })
}

async function readJson(request) {
  const chunks = []
  let total = 0
  for await (const chunk of request) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) {
      const error = new Error('Corpo da requisição excede 1 MB.')
      error.code = 'payload_too_large'
      throw error
    }
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON deve ser um objeto.')
    return parsed
  } catch (cause) {
    const error = new Error('Corpo JSON inválido.')
    error.code = 'invalid_json'
    error.cause = cause
    throw error
  }
}

async function handleEntityRequest(request, response, url, repository, match) {
  if (!repository) return sendJson(response, 503, { error: 'repository_unavailable', message: 'Banco central do servidor indisponível.' })

  const table = match[1]
  const id = match[2] ? Number(match[2]) : null

  if (id === null) {
    if (request.method === 'GET') {
      const filters = Object.fromEntries(url.searchParams.entries())
      return sendJson(response, 200, repository.list(table, filters))
    }
    if (request.method === 'POST') {
      const data = await readJson(request)
      const saved = repository.save(table, data)
      return sendJson(response, 201, saved)
    }
    return methodNotAllowed(response, ['GET', 'POST'])
  }

  if (request.method === 'GET') {
    const item = repository.get(table, id)
    return item ? sendJson(response, 200, item) : sendJson(response, 404, { error: 'not_found' })
  }
  if (request.method === 'PUT') {
    const data = await readJson(request)
    const saved = repository.save(table, { ...data, id })
    return saved ? sendJson(response, 200, saved) : sendJson(response, 404, { error: 'not_found' })
  }
  if (request.method === 'DELETE') {
    const removed = repository.remove(table, id)
    return removed ? sendJson(response, 200, { ok: true }) : sendJson(response, 404, { error: 'not_found' })
  }
  return methodNotAllowed(response, ['GET', 'PUT', 'DELETE'])
}

export function createLanServer({ serverVersion = LAN_SERVER_VERSION, repository = null } = {}) {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost')

      if (url.pathname === '/health') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        return sendJson(response, 200, { status: 'ok', product: 'Obra na Mão', apiVersion: LAN_API_VERSION })
      }

      if (url.pathname === '/version') {
        if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
        return sendJson(response, 200, { product: 'Obra na Mão', apiVersion: LAN_API_VERSION, serverVersion })
      }

      const entityMatch = url.pathname.match(ENTITY_ROUTE)
      if (entityMatch) return await handleEntityRequest(request, response, url, repository, entityMatch)

      return sendJson(response, 404, { error: 'not_found' })
    } catch (error) {
      if (error?.code === 'invalid_json') return sendJson(response, 400, { error: 'invalid_json', message: error.message })
      if (error?.code === 'payload_too_large') return sendJson(response, 413, { error: 'payload_too_large', message: error.message })
      const message = error instanceof Error ? error.message : String(error)
      return sendJson(response, 400, { error: 'validation_error', message })
    }
  })
}
