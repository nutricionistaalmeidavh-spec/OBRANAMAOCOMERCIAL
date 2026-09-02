const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { dialog } = require('electron')
const { assertSpreadsheetInput } = require('./spreadsheet-guard.cjs')
const { readWorkbook, sheetRows, encodeCell } = require('./spreadsheet-reader.cjs')

const MONTHS = {
  janeiro: '01', fevereiro: '02', marco: '03', 'março': '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
}

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function cents(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100)
  const parsed = Number(String(value || '').replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function cellName(row, col) {
  return encodeCell({ r: row, c: col })
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function competenceFromPath(filePath) {
  const lower = filePath.toLowerCase()
  const year = lower.match(/(?:^|[\\/])(20\d{2})(?:[\\/]|$)/)?.[1] || lower.match(/_(\d{2})\b/)?.[1]
  let yyyy = year && year.length === 2 ? `20${year}` : year
  if (!yyyy) yyyy = String(new Date().getFullYear())
  for (const [name, mm] of Object.entries(MONTHS)) if (lower.includes(name)) return `${yyyy}-${mm}`
  const month = lower.match(/m[eê]s\s*(\d{1,2})/)?.[1] || lower.match(/(?:^|[_\-\s])(\d{1,2})[_\-\s]*(?:20)?\d{2}/)?.[1]
  return `${yyyy}-${String(Math.min(12, Math.max(1, Number(month) || new Date().getMonth() + 1))).padStart(2, '0')}`
}

function header(rows, col) {
  return [rows[5]?.[col], rows[6]?.[col], rows[7]?.[col]].map(text).filter(Boolean).join(' ')
}

class WorkImportService {
  constructor({ db }) { this.db = db }

  async chooseAndImport() {
    const result = await dialog.showOpenDialog({
      title: 'Selecionar proposta e mapa de medição',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Planilhas Excel', extensions: ['xlsx', 'xlsm'] }]
    })
    if (result.canceled || !result.filePaths.length) return { canceled: true }
    return this.importFiles(result.filePaths)
  }

  async importFiles(filePaths) {
    const proposal = filePaths.find((file) => /or[cç]amento|proposta/i.test(path.basename(file))) || filePaths.find((file) => /\.xls$/i.test(file))
    const maps = filePaths.filter((file) => file !== proposal)
    if (!proposal && !maps.length) throw new Error('Selecione ao menos uma proposta ou mapa de medição.')
    const parsedProposal = proposal ? await this.parseProposal(proposal) : null
    const parsedMaps = []
    for (const file of maps) parsedMaps.push({ file, parsed: await this.parseMap(file) })
    const firstMap = parsedMaps[0]?.parsed || null
    return this.db.db.transaction(() => {
      const company = this.ensureCompany()
      const client = this.ensureClient(parsedProposal?.clientName || 'OTICON')
      const work = this.ensureWork({
        companyId: company.id,
        clientId: client.id,
        name: parsedProposal?.workName || firstMap?.workName || 'Residencial Chianti',
        contracted: parsedProposal?.contracted || firstMap?.contracted || 0,
        source: proposal || maps[0]
      })
      const budget = parsedProposal ? this.importBudgetFromProposal(work.id, parsedProposal, proposal) : { created: 0 }
      let measurements = []
      for (const item of parsedMaps) measurements.push(this.importMap(work, item.parsed, item.file))
      return { obra: work, orcamento: budget, medicoes: measurements, arquivos: filePaths.map((file) => ({ file, hash: sha256(file) })) }
    })()
  }

  async parseProposal(filePath) {
    assertSpreadsheetInput(filePath)
    const workbook = await readWorkbook(filePath)
    const sheet = workbook.worksheets[0]
    const sheetName = sheet.name
    const rows = sheetRows(sheet)
    const title = rows.flat().map(text).find((value) => /residencial|chianti/i.test(value)) || 'Residencial Chianti'
    const service = rows.flat().map(text).find((value) => /^servi[cç]o:/i.test(value)) || 'Mão de obra de instalações hidráulicas'
    const total = rows.flat().filter((value) => typeof value === 'number').sort((a, b) => b - a)[0] || 0
    const items = []
    for (let r = 0; r < rows.length; r++) {
      if (typeof rows[r]?.[0] !== 'number' || !text(rows[r]?.[1])) continue
      if (/total/i.test(text(rows[r]?.[2]))) continue
      const lines = [rows[r]?.[1], rows[r + 1]?.[1], rows[r + 2]?.[1]].map(text).filter(Boolean)
      items.push({ codigo: String(rows[r][0]), descricao: lines.join(' '), unidade: 'vb', quantidade: 1, valor: 0 })
    }
    return { sheetName, clientName: title.replace(/^.*propr\.?:/i, '').replace(/residencial chianti/i, '').replace(/[-:]/g, '').trim() || 'OTICON', workName: /chianti/i.test(title) ? 'Residencial Chianti' : title, service, contracted: cents(total), items }
  }

  async parseMap(filePath) {
    assertSpreadsheetInput(filePath)
    const workbook = await readWorkbook(filePath)
    const sheet = workbook.worksheets[0]
    const rows = sheetRows(sheet)
    const contracted = cents(rows[40]?.[15] || rows[39]?.[15] || 0)
    const services = []
    for (let c = 1; c <= 14; c++) {
      const name = header(rows, c)
      if (name && !/^subtotal$/i.test(name)) services.push({ col: c, name, percent: Number(rows[39]?.[c]) || null })
    }
    const lines = []
    for (let r = 8; r <= 35; r++) {
      const local = text(rows[r]?.[0])
      if (!local || /^total|itens pagos|percentual/i.test(local)) continue
      for (const service of services) {
        const value = cents(rows[r]?.[service.col])
        if (value > 0) lines.push({ local, service: service.name, value, percent: service.percent, cell: cellName(r, service.col) })
      }
    }
    const gross = lines.reduce((sum, item) => sum + item.value, 0)
    return { sheetName, workName: 'Residencial Chianti', competencia: competenceFromPath(filePath), contracted, services, lines, gross }
  }

  ensureCompany() {
    return this.db.db.prepare('SELECT * FROM empresas WHERE deleted_at IS NULL ORDER BY id LIMIT 1').get() ||
      this.db.save('empresas', { razao_social: 'MARCIO HENRIQUE DE ALMEIDA HIDRAULICA', nome_fantasia: 'MH Hidráulica', cnpj: '', cidade: '', uf: 'SP', ativo: 1 })
  }

  ensureClient(name) {
    const clean = text(name) || 'OTICON'
    return this.db.db.prepare('SELECT * FROM clientes WHERE deleted_at IS NULL AND nome=?').get(clean) ||
      this.db.save('clientes', { nome: clean, tipo: 'construtora', ativo: 1 })
  }

  ensureWork(data) {
    const existing = this.db.db.prepare('SELECT * FROM obras WHERE deleted_at IS NULL AND lower(nome)=lower(?)').get(data.name)
    if (existing) {
      if (data.contracted > 0 && (!existing.valor_contratado_centavos || existing.valor_contratado_centavos < data.contracted)) {
        return this.db.save('obras', { ...existing, valor_contratado_centavos: data.contracted, cliente_id: data.clientId || existing.cliente_id })
      }
      return existing
    }
    return this.db.save('obras', { empresa_id: data.companyId, cliente_id: data.clientId, nome: data.name, codigo: 'CHIANTI', valor_contratado_centavos: data.contracted, data_inicio: new Date().toISOString().slice(0, 10), status: 'ativa', observacoes: `Criada por importação: ${path.basename(data.source || '')}` })
  }

  importBudgetFromProposal(obraId, parsed, filePath) {
    let created = 0
    for (const item of parsed.items) {
      const exists = this.db.db.prepare('SELECT id FROM itens_orcamentarios WHERE deleted_at IS NULL AND obra_id=? AND codigo=?').get(obraId, item.codigo)
      if (exists) continue
      this.db.save('itens_orcamentarios', { obra_id: obraId, codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, quantidade: item.quantidade, valor_unitario_centavos: item.valor, tipo: 'servico', observacoes: `Importado de ${path.basename(filePath)}` })
      created++
    }
    return { created, total_centavos: parsed.contracted }
  }

  importMap(work, parsed, filePath) {
    const existing = this.db.db.prepare('SELECT * FROM medicoes WHERE deleted_at IS NULL AND obra_id=? AND numero=?').get(work.id, parsed.competencia)
    const medicao = this.db.saveMeasurement({ id: existing && existing.id, obra_id: work.id, numero: parsed.competencia, competencia: parsed.competencia, data: new Date().toISOString().slice(0, 10), status: 'aprovada', descricao: `Mapa de medição ${parsed.competencia}`, valor_bruto_centavos: parsed.gross, valor_liquido_centavos: parsed.gross, retencoes_centavos: 0, descontos_centavos: 0, observacoes: `Importado de ${path.basename(filePath)}`, itens: [] })
    this.db.db.prepare('UPDATE medicao_mapa_itens SET deleted_at=CURRENT_TIMESTAMP WHERE obra_id=? AND competencia=? AND deleted_at IS NULL').run(work.id, parsed.competencia)
    const insert = this.db.db.prepare('INSERT INTO medicao_mapa_itens(obra_id,medicao_id,competencia,local_nome,servico_nome,valor_periodo_centavos,percentual_contrato,origem_arquivo,origem_aba,origem_celula) VALUES (?,?,?,?,?,?,?,?,?,?)')
    for (const line of parsed.lines) insert.run(work.id, medicao.id, parsed.competencia, line.local, line.service, line.value, line.percent, filePath, parsed.sheetName, line.cell)
    this.ensureBudgetFromMap(work.id, parsed, filePath)
    return { medicao, linhas: parsed.lines.length, valor_centavos: parsed.gross }
  }

  ensureBudgetFromMap(obraId, parsed, filePath) {
    const contracted = parsed.contracted || this.db.get('obras', obraId)?.valor_contratado_centavos || 0
    for (const service of parsed.services) {
      const code = `MAP-${String(service.col).padStart(2, '0')}`
      const exists = this.db.db.prepare('SELECT id FROM itens_orcamentarios WHERE deleted_at IS NULL AND obra_id=? AND codigo=?').get(obraId, code)
      if (exists) continue
      this.db.save('itens_orcamentarios', { obra_id: obraId, codigo: code, descricao: service.name, unidade: '%', quantidade: 1, valor_unitario_centavos: service.percent ? Math.round(contracted * service.percent) : 0, tipo: 'servico', observacoes: `Serviço do mapa de medições: ${path.basename(filePath)}` })
    }
  }
}

module.exports = { WorkImportService, competenceFromPath }
