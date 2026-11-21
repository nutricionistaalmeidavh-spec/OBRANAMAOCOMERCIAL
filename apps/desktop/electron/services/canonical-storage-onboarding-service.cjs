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

  async prepareLocalTransfer() {
    const required = this.required()
    if (!required?.serverId || required.mode !== 'lan-server') {
      throw new Error('Esta operação não está vinculada a um computador principal local.')
    }
    const session = await this.online.session()
    if (session?.role !== 'admin') {
      throw new Error('Somente o administrador da empresa pode transferir o computador principal.')
    }
    if (!session?.device?.id) throw new Error('Não foi possível identificar este computador autorizado.')
    const topology = session.storageTopology
    // A prior attempt may have updated Cloudflare but failed configuring local storage.
    // Recovery is idempotent and must never re-enable an old server silently.
    if (topology?.mode === 'local-single') {
      return { serverId: String(required.serverId), devices: [], alreadyLocal: true }
    }
    if (topology?.mode !== 'lan-server' || String(topology.serverId || '') !== String(required.serverId)) {
      throw new Error('A topologia da empresa foi alterada. Verifique a configuração atual antes de prosseguir.')
    }
    const response = await this.online.companyDevices()
    const devices = (Array.isArray(response?.devices) ? response.devices : [])
      .filter(device => device?.status === 'active' && String(device.id || '') !== String(session.device.id))
      .map(device => ({ id: String(device.id), name: String(device.name || 'Computador'), email: String(device.email || '') }))
      .sort((a, b) => a.id.localeCompare(b.id))
    return { serverId: String(required.serverId), devices, alreadyLocal: false }
  }

  async transferToLocal({ confirmed = false, expectedServerId = '', otherDeviceIds = [] } = {}) {
    if (confirmed !== true) throw new Error('Confirme a transferência e o aviso sobre os dados do computador antigo.')
    const preview = await this.prepareLocalTransfer()
    if (String(expectedServerId) !== preview.serverId) {
      throw new Error('A identificação do servidor foi alterada. Confira novamente antes de transferir.')
    }
    const expected = preview.devices.map(device => device.id).sort()
    const provided = Array.isArray(otherDeviceIds) ? otherDeviceIds.map(String).sort() : []
    if (expected.length !== provided.length || expected.some((id, index) => id !== provided[index])) {
      throw new Error('A lista de computadores ativos mudou. Revise os dispositivos antes de transferir.')
    }
    if (!preview.alreadyLocal) {
      for (const device of preview.devices) await this.online.revokeCompanyDevice(device.id)
      const result = await this.online.setStorageTopology({ mode: 'local-single' })
      if (result?.storageTopology?.mode !== 'local-single') {
        throw new Error('O servidor não confirmou a alteração para uso individual.')
      }
    }
    // Do not clear the required binding here: the Electron main process must
    // configure storage locally first. A failure keeps the login blocked.
    return { serverId: preview.serverId, storageStatus: 'local-transfer-authorized' }
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
