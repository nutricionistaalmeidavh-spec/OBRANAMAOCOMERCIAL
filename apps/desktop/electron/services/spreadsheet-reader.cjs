const fs = require('node:fs')
const path = require('node:path')
const ExcelJS = require('exceljs')
const { assertSpreadsheetInput } = require('./spreadsheet-guard.cjs')

async function readWorkbook(filePath) {
  assertSpreadsheetInput(filePath)
  const workbook = new ExcelJS.Workbook()
  if (path.extname(filePath).toLowerCase() === '.csv') await workbook.csv.readFile(filePath)
  else await workbook.xlsx.readFile(filePath)
  return workbook
}

function plainValue(value) {
  if (value && typeof value === 'object') {
    if ('result' in value) return plainValue(value.result)
    if ('text' in value) return value.text
    if ('richText' in value) return value.richText.map((part) => part.text).join('')
  }
  return value ?? ''
}

function sheetRows(sheet) {
  const rows = []
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = []
    for (let col = 1; col <= sheet.columnCount; col += 1) values[col - 1] = plainValue(row.getCell(col).value)
    rows[rowNumber - 1] = values
  })
  return rows
}

function rowsAsObjects(rows, headerIndex) {
  const headers = rows[headerIndex] || []
  return rows.slice(headerIndex + 1).map((row) => Object.fromEntries(headers.map((header, index) => [String(header || `Coluna ${index + 1}`).trim(), row[index] ?? ''])))
}

function encodeCell({ r, c }) {
  let column = ''
  let value = c + 1
  while (value > 0) { const remainder = (value - 1) % 26; column = String.fromCharCode(65 + remainder) + column; value = Math.floor((value - 1) / 26) }
  return `${column}${r + 1}`
}

function parseExcelDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() }
  return null
}

module.exports = { readWorkbook, sheetRows, rowsAsObjects, encodeCell, parseExcelDate }
