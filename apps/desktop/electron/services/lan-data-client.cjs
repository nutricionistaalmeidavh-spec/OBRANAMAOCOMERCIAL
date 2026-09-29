const REMOTE_TABLES = new Set(['empresas', 'clientes', 'obras'])

class LanDataClient {
  constructor({ storage, fetchImpl = globalThis.fetch, timeoutMs = 5000 }) {
    this.storage = storage
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
  }

  assertTable(table) {
    if (!REMOTE_TABLES.has(table)) throw new Error('Entidade ainda não disponível no servidor da empresa.')
  }

  connection() {
    const state = this.storage.state()
    if (state.mode !== 'server' || !state.baseUrl) throw new Error('Servidor da empresa não está configurado.')
    return state
  }

  async request(method, path, { query, body } = {}) {
    const state = this.connection()
    const url = new URL(`${state.baseUrl}${path}`)
    for (const [key, value] of Object.entries(query || {})) {
      if (value === '' || value === null || value === undefined) continue
      url.searchParams.set(key, String(value))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await this.fetchImpl(url.toString(), {
        method,
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      })
      let payload = null
      try { payload = await response.json() } catch {}
      if (!response?.ok) {
        const message = payload?.message || `Servidor da empresa respondeu HTTP ${response?.status ?? 'inválido'}.`
        throw new Error(message)
      }
      return payload
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Tempo esgotado ao acessar o servidor da empresa.')
      if (error instanceof Error && (/Servidor da empresa respondeu HTTP|Entidade ainda não disponível|não está configurado|Tempo esgotado/.test(error.message) || error.message)) throw error
      throw new Error('Não foi possível acessar o servidor da empresa.')
    } finally {
      clearTimeout(timer)
    }
  }

  async list(table, filters = {}) {
    this.assertTable(table)
    return this.request('GET', `/api/v1/${table}`, { query: filters })
  }

  async get(table, id) {
    this.assertTable(table)
    return this.request('GET', `/api/v1/${table}/${Number(id)}`)
  }

  async save(table, data) {
    this.assertTable(table)
    const id = data?.id ? Number(data.id) : null
    const body = { ...(data || {}) }
    delete body.id
    return this.request(id ? 'PUT' : 'POST', id ? `/api/v1/${table}/${id}` : `/api/v1/${table}`, { body })
  }

  async remove(table, id) {
    this.assertTable(table)
    await this.request('DELETE', `/api/v1/${table}/${Number(id)}`)
    return true
  }
}

module.exports = { LanDataClient, REMOTE_TABLES }
