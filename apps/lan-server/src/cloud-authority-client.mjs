function normalizedBaseUrl(value) {
  const url = new URL(String(value || '').trim())
  const allowInsecure = process.env.OBRA_NA_MAO_ALLOW_INSECURE_CLOUD === '1'
  if (url.protocol !== 'https:' && !(allowInsecure && url.protocol === 'http:')) {
    throw new Error('Cloud authority exige HTTPS.')
  }
  url.pathname = url.pathname.replace(/\/$/, '')
  return url.toString().replace(/\/$/, '')
}

async function parseResponse(response) {
  let payload = null
  try { payload = await response.json() } catch {}
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `Cloud authority respondeu ${response.status}`
    throw new Error(message)
  }
  return payload || {}
}

export class CloudAuthorityClient {
  constructor({ baseUrl, fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
    if (typeof fetchImpl !== 'function') throw new Error('Cliente HTTP da autoridade Cloud indisponível.')
    this.baseUrl = normalizedBaseUrl(baseUrl)
    this.fetchImpl = fetchImpl
    this.timeoutMs = Number(timeoutMs) || 10000
  }

  async request(path, { body, headers = {} } = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    timer.unref?.()
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      })
      return await parseResponse(response)
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Tempo limite ao consultar a autoridade Cloud.')
      throw new Error(error instanceof Error ? error.message : 'Falha ao consultar a autoridade Cloud.')
    } finally {
      clearTimeout(timer)
    }
  }

  async redeemClaim({ serverId, claimToken }) {
    if (!serverId || !claimToken) throw new Error('Dados do claim LAN incompletos.')
    return await this.request('/api/lan/claim/redeem', { body: { serverId: String(serverId), claimToken: String(claimToken) } })
  }

  async redeemEnrollment({ serverToken, serverId, enrollmentToken, installationId }) {
    if (!serverToken || !serverId || !enrollmentToken || !installationId) throw new Error('Dados da matrícula LAN incompletos.')
    return await this.request('/api/lan/enroll/redeem', {
      headers: { authorization: `Bearer ${String(serverToken)}` },
      body: {
        serverId: String(serverId),
        enrollmentToken: String(enrollmentToken),
        installationId: String(installationId)
      }
    })
  }

  async snapshot({ serverToken }) {
    if (!serverToken) throw new Error('Token do servidor LAN não informado.')
    return await this.request('/api/lan/server/snapshot', { headers: { authorization: `Bearer ${String(serverToken)}` } })
  }
}
