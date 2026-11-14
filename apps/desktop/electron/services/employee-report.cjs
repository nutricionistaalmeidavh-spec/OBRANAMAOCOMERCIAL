const fs = require('node:fs/promises')
const path = require('node:path')
const ExcelJS = require('exceljs')
const JSZip = require('jszip')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const { z } = require('zod')

const fields = {
  empresa: 'Empresa',
  cnpj: 'CNPJ',
  nome: 'Nome completo',
  cpf: 'CPF',
  data_nascimento: 'Data de nascimento',
  email: 'E-mail',
  telefone: 'Celular / telefone',
  beneficios: 'Benefícios fixos'
}
const formats = { xlsx: 'Excel', csv: 'CSV', pdf: 'PDF', docx: 'Word' }
const request = z.object({
  ids: z.array(z.number().int().positive()).nonempty(),
  empresaId: z.number().int().positive().nullable(),
  campos: z.array(z.enum(Object.keys(fields))).nonempty(),
  formato: z.enum(Object.keys(formats)),
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
})
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })

function buildReport(db, payroll, selection) {
  const ids = new Set(selection.ids)
  const employees = db.list('funcionarios', selection.empresaId === null ? {} : { empresa_id: selection.empresaId })
    .filter(employee => ids.has(employee.id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  if (employees.length !== ids.size) throw new Error('A seleção de funcionários mudou. Atualize a lista e tente novamente.')

  const selected = new Set(selection.campos)
  const includeBenefits = selected.has('beneficios')
  const companies = new Map(db.list('empresas').map(company => [company.id, company]))
  const benefitLabels = new Map()
  const records = employees.map(employee => {
    const company = companies.get(employee.empresa_id)
    const benefits = new Map()
    if (includeBenefits) {
      for (const benefit of payroll.fixedBenefits(employee, selection.competencia)) {
        benefitLabels.set(benefit.tipo, benefit.descricao)
        benefits.set(benefit.tipo, (benefit.natureza === 'desconto' ? -1 : 1) * benefit.valor / 100)
      }
    }
    return {
      ...employee,
      empresa: company?.nome_fantasia || company?.razao_social,
      cnpj: company?.cnpj,
      cpf: String(employee.cpf ?? '').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'),
      data_nascimento: String(employee.data_nascimento ?? '').replace(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/, '$3/$2/$1'),
      benefits
    }
  })
  const columns = Object.entries(fields).filter(([key]) => key !== 'beneficios' && selected.has(key))
    .map(([key, label]) => ({ key, label, benefit: false }))
  if (includeBenefits) {
    if (!benefitLabels.size) columns.push({ key: 'beneficios', label: fields.beneficios, benefit: true })
    for (const [key, label] of [...benefitLabels].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))) {
      columns.push({ key, label, benefit: true })
    }
  }
  const title = includeBenefits ? `Relatório de funcionários — benefícios ${selection.competencia}` : 'Relatório de funcionários'
  const headers = columns.map(column => column.label)
  const rows = records.map(record => columns.map(({ key, benefit }) => (benefit ? record.benefits.get(key) : record[key]) ?? ''))
  return { title, headers, rows, columns }
}

function csvCell(value) {
  if (typeof value === 'number') return decimal.format(value)
  // Prevent spreadsheet programs from interpreting exported text as formulas.
  const safe = /^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/u.test(value) ? "'" + value : value
  return '"' + safe.replaceAll('"', '""') + '"'
}

async function excel({ title, headers, rows, columns }) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Funcionários', { views: [{ state: 'frozen', ySplit: 2 }] })
  sheet.addRow([title])
  sheet.mergeCells(1, 1, 1, headers.length)
  sheet.getRow(1).font = { bold: true, size: 14 }
  sheet.addRow(headers).font = { bold: true }
  rows.forEach(row => sheet.addRow(row))
  columns.forEach((column, index) => {
    const excelColumn = sheet.getColumn(index + 1)
    excelColumn.width = Math.min(54, Math.max(column.label.length + 3, rows.reduce((width, row) => Math.max(width, String(row[index]).length + 2), 18)))
    excelColumn.alignment = { vertical: 'middle', wrapText: true }
    if (column.benefit) excelColumn.numFmt = '"R$" #,##0.00;-"R$" #,##0.00'
  })
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

function reportLines({ headers, rows }) {
  return rows.map(row => headers.map((label, index) => {
    const value = row[index]
    return [label, typeof value === 'number' ? money.format(value) : value || '—']
  }))
}

async function pdf(report) {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const supported = new Set(font.getCharacterSet())
  const pdfText = value => [...value.replace(/\s+/gu, ' ')].map(char => supported.has(char.codePointAt(0)) ? char : '?').join('')
  let page, y
  const addPage = () => {
    page = document.addPage([595.28, 841.89])
    y = 800
    page.drawText(pdfText(report.title), { x: 38, y, size: 14, font: bold })
    y -= 28
  }
  addPage()
  for (const record of reportLines(report)) {
    for (const [label, value] of record) {
      const content = pdfText(`${label}: ${value}`)
      for (const line of wrapPdfText(content, font)) {
        if (y < 40) addPage()
        page.drawText(line, { x: 38, y, size: 10, font, color: rgb(0.12, 0.17, 0.24) })
        y -= 14
      }
    }
    y -= 12
  }
  return document.save()
}

function wrapPdfText(content, font) {
  const lines = []
  let line = ''
  for (const word of content.split(' ')) {
    const next = line ? line + ' ' + word : word
    if (font.widthOfTextAtSize(next, 10) <= 518) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = ''
    for (const char of word) {
      if (font.widthOfTextAtSize(line + char, 10) > 518) {
        lines.push(line)
        line = ''
      }
      line += char
    }
  }
  if (line) lines.push(line)
  return lines
}

const xmlText = value => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/gu, '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const wordRun = (value, bold = false) => `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xmlText(value)}</w:t></w:r>`

async function word(report) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  const body = reportLines(report).map(record => record.map(([label, value]) =>
    `<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>${wordRun(label + ': ', true)}${wordRun(value)}</w:p>`
  ).join('') + '<w:p/>').join('')
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p>${wordRun(report.title, true)}</w:p>${body}</w:body></w:document>`)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

const render = {
  xlsx: excel,
  csv: ({ headers, rows }) => '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n',
  pdf,
  docx: word
}

async function exportEmployeeReport({ db, payroll, dialog, window }, payload) {
  const parsed = request.safeParse(payload)
  if (!parsed.success) throw new Error('Confira os funcionários, campos, competência e formato do relatório.')
  const { formato, competencia } = parsed.data
  const report = buildReport(db, payroll, parsed.data)
  const result = await dialog.showSaveDialog(window, {
    title: 'Salvar relatório de funcionários',
    defaultPath: `funcionarios-${competencia}.${formato}`,
    filters: [{ name: formats[formato], extensions: [formato] }]
  })
  if (result.canceled || !result.filePath) return null
  if (path.extname(result.filePath).toLowerCase() !== '.' + formato) {
    throw new Error(`Use a extensão .${formato} para salvar neste formato.`)
  }
  await fs.writeFile(result.filePath, await render[formato](report))
  return path.basename(result.filePath)
}

module.exports = { exportEmployeeReport }
