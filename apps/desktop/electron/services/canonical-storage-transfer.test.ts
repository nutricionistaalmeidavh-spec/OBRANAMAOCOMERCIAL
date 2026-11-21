import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { CanonicalStorageOnboardingService } = require('./canonical-storage-onboarding-service.cjs')

function fixture(options: { role?: string; topology?: string; serverId?: string; devices?: Array<{id:string; name:string; status:string}>; failTopology?: boolean } = {}) {
  const serverId = options.serverId || 'principal-antigo-01'
  const devices = options.devices || [
    { id: 'old-pc', name: 'Computador antigo', status: 'active' },
    { id: 'new-pc', name: 'Computador novo', status: 'active' }
  ]
  const online = {
    state: vi.fn(() => ({ storageRequired: { mode: 'lan-server', serverId } })),
    session: vi.fn(async () => ({
      authorized: true,
      role: options.role || 'admin',
      device: { id: 'new-pc' },
      storageTopology: { mode: options.topology || 'lan-server', serverId }
    })),
    companyDevices: vi.fn(async () => ({ devices })),
    revokeCompanyDevice: vi.fn(async (_id:string) => ({ ok: true })),
    setStorageTopology: vi.fn(async () => {
      if (options.failTopology) throw new Error('Não foi possível atualizar')
      return { storageTopology: { mode: 'local-single', serverId: null } }
    })
  }
  const storage = { state: vi.fn(() => ({ operationalMode: 'local', serverId: null })) }
  const service = new CanonicalStorageOnboardingService({
    online, storage,
    serverDiscovery: { discover: vi.fn() },
    lanSetup: { status: vi.fn() }
  })
  return { service, online }
}

describe('transferência explícita do computador principal para o modo individual', () => {
  it('permite ao administrador consultar computadores antigos mesmo com login bloqueado pelo servidor', async () => {
    const { service } = fixture()
    await expect(service.prepareLocalTransfer()).resolves.toMatchObject({
      serverId: 'principal-antigo-01',
      devices: [{ id: 'old-pc', name: 'Computador antigo' }]
    })
  })

  it('não oferece transferência para colaborador ou servidor remoto', async () => {
    const member = fixture({ role: 'employee' })
    await expect(member.service.prepareLocalTransfer()).rejects.toThrow(/administrador/i)
    const remote = fixture({ topology: 'remote' })
    await expect(remote.service.prepareLocalTransfer()).rejects.toThrow(/topologia|configuração|origem/i)
    expect(member.online.revokeCompanyDevice).not.toHaveBeenCalled()
  })

  it('não revoga ninguém sem confirmação e identificação exata dos computadores', async () => {
    const { service, online } = fixture()
    await expect(service.transferToLocal({ expectedServerId: 'principal-antigo-01', otherDeviceIds: ['old-pc'] })).rejects.toThrow()
    await expect(service.transferToLocal({ confirmed: true, expectedServerId: 'principal-antigo-01', otherDeviceIds: ['desconhecido'] })).rejects.toThrow()
    await expect(service.transferToLocal({ confirmed: true, expectedServerId: 'outro-servidor', otherDeviceIds: ['old-pc'] })).rejects.toThrow()
    expect(online.revokeCompanyDevice).not.toHaveBeenCalled()
    expect(online.setStorageTopology).not.toHaveBeenCalled()
  })

  it('revoga somente outros dispositivos autorizados e só então atualiza o modo da empresa', async () => {
    const { service, online } = fixture()
    const result = await service.transferToLocal({
      confirmed: true, expectedServerId: 'principal-antigo-01', otherDeviceIds: ['old-pc']
    })
    expect(result).toMatchObject({ serverId: 'principal-antigo-01', storageStatus: 'local-transfer-authorized' })
    expect(online.revokeCompanyDevice).toHaveBeenCalledExactlyOnceWith('old-pc')
    expect(online.setStorageTopology).toHaveBeenCalledWith({ mode: 'local-single' })
    expect(online.state().storageRequired?.serverId).toBe('principal-antigo-01')
  })

  it('não libera o acesso local caso a nuvem rejeite a alteração', async () => {
    const { service } = fixture({ failTopology: true })
    await expect(service.transferToLocal({
      confirmed: true, expectedServerId: 'principal-antigo-01', otherDeviceIds: ['old-pc']
    })).rejects.toThrow('Não foi possível atualizar')
  })
})
