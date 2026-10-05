class RhCatalogSourceService {
  constructor({ local, dataAccess, moduleStorage }) {
    this.local = local
    this.dataAccess = dataAccess
    this.moduleStorage = moduleStorage
  }

  state() { return this.moduleStorage.state('rh').state }

  blocked() {
    throw new Error('O RH central ainda não está ativo neste computador; o catálogo não será alterado localmente como fallback.')
  }

  async resolveCompanyId(preferredId = null) {
    const explicit = Number(preferredId)
    if (Number.isSafeInteger(explicit) && explicit > 0) return explicit
    const companies = await this.dataAccess.list('empresas', { status: 'ativa' })
    const active = (companies || []).filter(company => !company.deleted_at && company.status !== 'inativa')
    if (active.length === 1) return Number(active[0].id)
    if (!active.length) throw new Error('Nenhuma empresa ativa foi encontrada para o catálogo central de RH.')
    throw new Error('Há mais de uma empresa ativa. Informe a empresa para alterar o catálogo central de RH.')
  }

  async list() {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.list()
    if (state === 'central-ready') return this.blocked()
    const empresaId = await this.resolveCompanyId()
    const [cargos, beneficios, links] = await Promise.all([
      this.dataAccess.list('cargos', { empresa_id: empresaId }),
      this.dataAccess.list('beneficios', { empresa_id: empresaId }),
      this.dataAccess.list('cargo_beneficios', { empresa_id: empresaId })
    ])
    return { cargos, beneficios, links, empresa_id: empresaId, source: 'central-rh' }
  }

  async saveCargo(data = {}) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.saveCargo(data)
    if (state === 'central-ready') return this.blocked()
    const current = data.id ? await this.dataAccess.get('cargos', Number(data.id)) : null
    const empresaId = await this.resolveCompanyId(data.empresa_id || current?.empresa_id)
    const nome = String(data.nome || current?.nome || '').trim()
    if (!nome) throw new Error('Informe o nome do cargo.')
    return this.dataAccess.save('cargos', {
      ...data,
      empresa_id: empresaId,
      nome,
      cbo: data.cbo ?? current?.cbo ?? null,
      salario_base_centavos: Math.max(0, Number(data.salario_base_centavos ?? current?.salario_base_centavos) || 0),
      ativo: data.ativo === 0 ? 0 : 1
    })
  }

  async saveBenefit(data = {}) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.saveBenefit(data)
    if (state === 'central-ready') return this.blocked()
    const current = data.id ? await this.dataAccess.get('beneficios', Number(data.id)) : null
    const empresaId = await this.resolveCompanyId(data.empresa_id || current?.empresa_id)
    const nome = String(data.nome || current?.nome || '').trim()
    if (!nome) throw new Error('Informe o nome do benefício.')
    return this.dataAccess.save('beneficios', {
      ...data,
      empresa_id: empresaId,
      nome,
      tipo: data.tipo || current?.tipo || 'outro',
      valor_padrao_centavos: Math.max(0, Number(data.valor_padrao_centavos ?? current?.valor_padrao_centavos) || 0),
      ativo: data.ativo === 0 ? 0 : 1
    })
  }

  async saveLink(data = {}) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.saveLink(data)
    if (state === 'central-ready') return this.blocked()
    const cargoId = Number(data.cargo_id), beneficioId = Number(data.beneficio_id)
    const [cargo, beneficio] = await Promise.all([
      this.dataAccess.get('cargos', cargoId),
      this.dataAccess.get('beneficios', beneficioId)
    ])
    if (!cargo || !beneficio) throw new Error('Cargo ou benefício não encontrado no RH central.')
    if (Number(cargo.empresa_id) !== Number(beneficio.empresa_id)) throw new Error('Cargo e benefício devem pertencer à mesma empresa.')
    const existing = (await this.dataAccess.list('cargo_beneficios', { empresa_id: cargo.empresa_id, cargo_id: cargoId, beneficio_id: beneficioId }))[0]
    await this.dataAccess.save('cargo_beneficios', {
      ...(existing || {}),
      empresa_id: Number(cargo.empresa_id),
      cargo_id: cargoId,
      beneficio_id: beneficioId,
      valor_centavos: Math.max(0, Number(data.valor_centavos) || 0),
      quinzena: Number(data.quinzena) === 2 ? 2 : 1,
      natureza: data.natureza === 'desconto' ? 'desconto' : 'credito',
      ativo: data.ativo === 0 ? 0 : 1
    })
    return true
  }

  async saveCompensationPolicy(payload = {}) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.saveCompensationPolicy(payload)
    if (state === 'central-ready') return this.blocked()
    if (!this.dataAccess.remote?.saveCompensationPolicy) throw new Error('Servidor central não oferece a operação canônica de remuneração.')

    const input = payload.cargo || {}
    const current = input.id ? await this.dataAccess.get('cargos', Number(input.id)) : null
    const empresaId = await this.resolveCompanyId(input.empresa_id || current?.empresa_id)
    const nome = String(input.nome || current?.nome || '').trim()
    if (!nome) throw new Error('Informe o nome do cargo.')

    const result = await this.dataAccess.remote.saveCompensationPolicy({
      cargo: {
        ...input,
        empresa_id: empresaId,
        nome,
        cbo: input.cbo ?? current?.cbo ?? null,
        salario_base_centavos: Math.max(0, Number(input.salario_base_centavos ?? current?.salario_base_centavos) || 0),
        ativo: input.ativo === 0 ? 0 : 1
      },
      links: (Array.isArray(payload.links) ? payload.links : []).map(link => ({
        id: link.id,
        revision: link.revision,
        beneficio_id: Number(link.beneficio_id),
        valor_centavos: Math.max(0, Number(link.valor_centavos) || 0),
        quinzena: Number(link.quinzena) === 2 ? 2 : 1,
        natureza: link.natureza === 'desconto' ? 'desconto' : 'credito',
        ativo: link.ativo === 0 ? 0 : 1
      }))
    })
    this.dataAccess.rememberRevision?.('cargos', result?.cargo)
    this.dataAccess.rememberMany?.('cargo_beneficios', result?.links || [])
    return result
  }

  async deactivate(type, id) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.local.deactivate(type, id)
    if (state === 'central-ready') return this.blocked()
    const table = type === 'cargo' ? 'cargos' : type === 'beneficio' ? 'beneficios' : null
    if (!table) throw new Error('Tipo de cadastro inválido.')
    const current = await this.dataAccess.get(table, Number(id))
    if (!current) throw new Error('Cadastro não encontrado no RH central.')
    await this.dataAccess.save(table, { id: Number(id), ativo: 0 })
    return true
  }
}

module.exports = { RhCatalogSourceService }
