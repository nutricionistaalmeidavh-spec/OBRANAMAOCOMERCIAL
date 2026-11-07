const fs = require('node:fs')
const path = require('node:path')
const { sanitizeName } = require('./file-service.cjs')
const { employeeIdentityIssues } = require('./employee-identity.cjs')
const { filterBenefitsByPolicy, receiptDocumentSelection } = require('./receipt-policy-service.cjs')

const MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

class RhDocumentService {
  constructor({ rh, localTime, fileService, dataAccess }) {
    this.rh = rh
    this.localTime = localTime
    this.fileService = fileService
    this.dataAccess = dataAccess
  }

  state() { return this.rh.state() }

  blocked() {
    throw new Error('O RH central ainda não está ativo neste computador; documentos não serão gerados a partir de dados locais como fallback.')
  }

  async centralContext(payload, { autoFill = true } = {}) {
    let context = await this.rh.timeDocumentContext(payload)
    if (autoFill && !context?.marks?.length) {
      await this.rh.timeAutoFill({ funcionario_id: payload.funcionario_id, competencia: payload.competencia, overwrite: false, expectedRevision: context?.point?.revision })
      context = await this.rh.timeDocumentContext(payload)
    }
    if (!context?.employee || !context?.company || !context?.point) throw new Error('Contexto RH central incompleto para geração de documentos.')
    const issues = employeeIdentityIssues(context.employee, context.company)
    if (!context.cargo || !String(context.cargo.nome || '').trim()) issues.push('cargo/função')
    if (issues.length) throw new Error(`Complete o cadastro de ${String(context.employee.nome || 'funcionário')} antes de gerar documentos mensais: ${issues.join(', ')}.`)
    return {
      ...context,
      benefits: filterBenefitsByPolicy(context.benefits || [], context.company?.politica_recibos)
    }
  }

  async printableCentralEntry(employeeId, competencia, paymentDate, payload = {}) {
    const context = await this.centralContext({ funcionario_id: employeeId, competencia })
    const data = { employee: context.employee, point: context.point, marks: context.marks || [] }
    return {
      funcionario_id: context.employee.id,
      nome: context.employee.nome,
      ok: true,
      pointHtml: receiptDocumentSelection(payload, context.company.politica_recibos).point ? this.localTime.pointHtml(data, context.company, context.cargo) : null,
      receiptHtml: receiptDocumentSelection(payload, context.company.politica_recibos).receipts ? this.localTime.receiptHtml(data, context.company, context.cargo, context.benefits, paymentDate) : null
    }
  }

  async generateCentralDocuments(payload) {
    const context = await this.centralContext(payload)
    const { point: pointSelected, receipts: receiptsSelected } = receiptDocumentSelection(payload, context.company.politica_recibos)
    if (!pointSelected && !receiptsSelected) throw new Error('Selecione fichas de ponto e/ou recibos para gerar.')

    const data = { employee: context.employee, point: context.point, marks: context.marks || [] }
    const companyName = context.company?.nome_fantasia || context.company?.razao_social || 'Empresa'
    const folders = this.fileService.employeeFolders(context.employee, companyName)
    const parts = String(context.point.competencia).split('-')
    const monthlyFolder = path.join(folders.base, 'Recibos', parts[0], `${parts[1]} - ${MONTHS[Number(parts[1]) - 1]}`)
    const unsignedFolder = path.join(monthlyFolder, 'Não assinados')
    const signedFolder = path.join(monthlyFolder, 'Assinados')
    fs.mkdirSync(unsignedFolder, { recursive: true })
    fs.mkdirSync(signedFolder, { recursive: true })

    const stamp = Date.now()
    const result = {
      folder: monthlyFolder,
      unsignedFolder,
      signedFolder,
      source: 'central-rh',
      storage: 'central',
      registeredInLocalDatabase: false,
      registeredInCentralDatabase: true
    }

    if (pointSelected) {
      const pointPath = path.join(unsignedFolder, `Ficha de ponto - ${data.point.competencia} - ${sanitizeName(data.employee.nome)} - ${stamp}.pdf`)
      await this.localTime.printHtml(this.localTime.pointHtml(data, context.company, context.cargo), pointPath)
      const registered=await this.fileService.registerCentralFile(pointPath,{
        empresa_id:context.employee.empresa_id,obra_id:context.employee.obra_atual_id||null,funcionario_id:context.employee.id,
        categoria:'ponto',titulo:`Ficha de ponto - ${data.point.competencia}`,status_assinatura:'nao_assinado',versao:1
      })
      result.point = { ...registered, localPath:pointPath }
    }
    if (receiptsSelected && context.benefits.length) {
      const receiptPath = path.join(unsignedFolder, `Recibos de benefícios - ${data.point.competencia} - ${sanitizeName(data.employee.nome)} - ${stamp}.pdf`)
      await this.localTime.printHtml(this.localTime.receiptHtml(data, context.company, context.cargo, context.benefits, payload.paymentDate), receiptPath)
      const registered=await this.fileService.registerCentralFile(receiptPath,{
        empresa_id:context.employee.empresa_id,obra_id:context.employee.obra_atual_id||null,funcionario_id:context.employee.id,
        categoria:'recibo_beneficios',titulo:`Recibos de benefícios - ${data.point.competencia}`,status_assinatura:'nao_assinado',versao:1
      })
      result.receipt = { ...registered, localPath:receiptPath }
    }
    return result
  }

  async generateDocuments(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.localTime.generateDocuments(payload)
    if (state === 'central-ready') return this.blocked()
    return this.generateCentralDocuments(payload)
  }

  async centralEmployees() {
    const rows = await this.dataAccess.list('funcionarios', { status: 'ativo' })
    return (rows || []).filter(employee => !employee.deleted_at && employee.status === 'ativo')
  }

  async prepareCentralEntries(payload, employeeIds = null) {
    const selected = employeeIds ? new Set(employeeIds.map(Number)) : null
    const employees = (await this.centralEmployees()).filter(employee => !selected || selected.has(Number(employee.id)))
    const entries = []
    for (const employee of employees) {
      try { entries.push(await this.printableCentralEntry(employee.id, payload.competencia, payload.paymentDate, payload)) }
      catch (error) { entries.push({ funcionario_id: employee.id, nome: employee.nome, ok: false, error: error instanceof Error ? error.message : String(error) }) }
    }
    return entries
  }

  async generateForAll(payload) {
    const result = await this.generateBatch(payload)
    if (!result?.printed || result.canceled || !payload?.print || payload.reprint) return result
    const payments = []
    for (const entry of result.results || []) {
      if (!entry.ok) continue
      try {
        const key = { funcionario_id: entry.funcionario_id, competencia: payload.competencia }
        const current = await this.rh.getEmployee(key)
        const paid = new Set((current.payments || []).filter(item => item.status === 'pago').map(item => Number(item.quinzena)))
        const installments = [...new Set((current.launches || []).filter(item => item.status === 'pendente').map(item => Number(item.quinzena)))].filter(item => (item === 1 || item === 2) && !paid.has(item))
        for (const quinzena of installments) {
          await this.rh.confirm({ ...key, quinzena, data: payload.paymentDate, observacoes: 'Baixa automática após geração e envio do lote mensal para impressão.' })
        }
        payments.push({ funcionario_id: entry.funcionario_id, nome: entry.nome, ok: true, installments })
      } catch (error) {
        payments.push({ funcionario_id: entry.funcionario_id, nome: entry.nome, ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    }
    return { ...result, payments }
  }

  async generateBatch(payload) {
    const state = this.state()
    if (state === 'local' || state === 'migration-required') return this.localTime.generateForAll(payload)
    if (state === 'central-ready') return this.blocked()

    if (payload?.reprint) {
      const entries = await this.prepareCentralEntries(payload)
      const printed = await this.localTime.printEntries(entries, payload)
      return { ...printed, reprint: true, source: 'central-rh', storage: 'central' }
    }

    const employees = await this.centralEmployees()
    const results = []
    for (const employee of employees) {
      try {
        results.push({ funcionario_id: employee.id, nome: employee.nome, ok: true, documents: await this.generateCentralDocuments({ ...payload, funcionario_id: employee.id }) })
      } catch (error) {
        results.push({ funcionario_id: employee.id, nome: employee.nome, ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    }

    if (!payload?.print) return results
    const successfulIds = results.filter(item => item.ok).map(item => item.funcionario_id)
    const entries = await this.prepareCentralEntries(payload, successfulIds)
    const printed = await this.localTime.printEntries(entries, payload)
    return { ...printed, results: [...printed.results, ...results.filter(item => !item.ok)], source: 'central-rh', storage: 'local-derived' }
  }
}

module.exports = { RhDocumentService }
