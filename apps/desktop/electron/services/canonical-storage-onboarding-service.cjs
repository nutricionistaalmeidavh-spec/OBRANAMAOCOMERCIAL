class CanonicalStorageOnboardingService {
  constructor({ online, storage, serverDiscovery, lanSetup, refreshCapabilities = async () => {} } = {}) {
    if (!online || !storage || !serverDiscovery || !lanSetup) throw new Error('Dependências do vínculo de armazenamento da empresa estão incompletas.')
    this.online = online
    this.storage = storage
    this.serverDiscovery = serverDiscovery
    this.lanSetup = lanSetup
    this.refreshCapabilities = refreshCapabilities
  }

  required() {
    return this.online.state()?.storageRequired || null
  }

  async alreadyConnected(required) {
    const current = this.storage.state()
    if (!current?.serverId || String(current.serverId) !== String(required.serverId)) return false
    if (!['lan-host', 'lan-client', 'remote'].includes(String(current.operationalMode || ''))) return false
    try {
      const status = await this.lanSetup.status()
      return String(status?.serverId || '') === String(required.serverId) && status?.credential?.paired === true
    } catch {
      return false
    }
  }

  async complete({ address = '' } = {}) {
    const required = this.required()
    if (!required?.serverId) return { linked: true, storageStatus: 'not-required', storageRequired: null }

    const serverId = String(required.serverId)
    if (await this.alreadyConnected(required)) {
      this.online.clearRequiredStorage(serverId)
      await this.refreshCapabilities()
      return { linked: true, storageStatus: 'connected', serverId, storageRequired: null }
    }

    const operationalMode = required.mode === 'remote' ? 'remote' : 'lan-client'
    let baseUrl = String(address || '').trim()
    if (!baseUrl && operationalMode === 'lan-client') {
      let discovered = []
      try { discovered = await this.serverDiscovery.discover() } catch {}
      const server = (Array.isArray(discovered) ? discovered : []).find(item => String(item?.serverId || '') === serverId)
      baseUrl = String(server?.baseUrl || '')
    }
    if (!baseUrl) {
      return {
        linked: false,
        storageStatus: 'unavailable',
        serverId,
        storageRequired: required,
        message: operationalMode === 'remote'
          ? 'Informe o endereço HTTPS do servidor autorizado pela empresa.'
          : 'O computador principal da empresa não foi encontrado. Conecte este computador à mesma rede ou informe o endereço do servidor.'
      }
    }

    await this.storage.connectAddress(baseUrl, { expectedServerId: serverId, operationalMode })
    const status = await this.lanSetup.status()
    if (String(status?.serverId || '') !== serverId) throw new Error('O servidor encontrado não corresponde à fonte operacional da empresa.')

    if (status?.credential?.paired !== true) {
      const enrollment = await this.online.startLanDeviceEnrollment(serverId)
      await this.lanSetup.enroll({ enrollmentToken: enrollment.enrollmentToken })
    }

    this.online.clearRequiredStorage(serverId)
    await this.refreshCapabilities()
    return { linked: true, storageStatus: 'connected', serverId, storageRequired: null }
  }
}

module.exports = { CanonicalStorageOnboardingService }
