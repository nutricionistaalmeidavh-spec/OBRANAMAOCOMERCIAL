const fs = require('node:fs')
const path = require('node:path')

const MAX_SPREADSHEET_BYTES = 25 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xlsm', '.csv'])

function assertSpreadsheetInput(filePath) {
  if (!filePath || typeof filePath !== 'string') throw new Error('Planilha inválida.')
  const extension = path.extname(filePath).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error(extension === '.xls' ? 'Formato .xls legado não suportado. Salve a planilha como .xlsx.' : 'Formato de planilha não permitido.')
  const stat = fs.statSync(filePath)
  if (!stat.isFile() || stat.size > MAX_SPREADSHEET_BYTES) throw new Error('A planilha excede o limite de 25 MB.')
}

module.exports = { assertSpreadsheetInput, MAX_SPREADSHEET_BYTES }
