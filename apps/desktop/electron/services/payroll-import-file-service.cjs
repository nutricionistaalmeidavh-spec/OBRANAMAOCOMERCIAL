const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const ExcelJS = require('exceljs')
const { dialog } = require('electron')
const { assertSpreadsheetInput } = require('./spreadsheet-guard.cjs')
const { readWorkbook, sheetRows, rowsAsObjects } = require('./spreadsheet-reader.cjs')

const FIELDS = [
  'tipo_linha','funcionario','cpf','salario','vale_adiantamento','diarias','empreitas',
  'alimentacao','transporte','outros_beneficios','faltas','outros_descontos',
  'inss','fgts','outros_encargos','despesa','categoria','valor_despesa','vencimento'
]

const ALIASES = {
  tipo_linha:['tipo','tipo linha','tipo de linha'],
  funcionario:['funcionario','funcionário','colaborador','nome','funcionário / despesa','funcionario / despesa'],
  cpf:['cpf','documento'],
  salario:['salario','salário','remuneracao','remuneração'],
  vale_adiantamento:['vale','adiantamento','vale / adiantamento','vale/adiantamento','vale salario','vale salário'],
  diarias:['diarias','diárias','diaria','diária'],
  empreitas:['empreitas','empreita'],
  alimentacao:['alimentacao','alimentação','vale alimentacao','vale alimentação','refeicao','refeição'],
  transporte:['transporte','vale transporte','vale-transporte'],
  outros_beneficios:['outros beneficios','outros benefícios','beneficios outros','benefícios outros'],
  faltas:['faltas','falta'],
  outros_descontos:['outros descontos','descontos outros'],
  inss:['inss'],
  fgts:['fgts'],
  outros_encargos:['outros encargos','encargos outros','seconci'],
  despesa:['despesa','despesa empresa','conta','descricao despesa','descrição despesa'],
  categoria:['categoria','categoria despesa','grupo'],
  valor_despesa:['valor despesa','valor da despesa','valor empresa','valor conta'],
  vencimento:['vencimento','data vencimento']
}

const TEMPLATE_HEADERS = [
  'Tipo','Funcionário / despesa','CPF','Salário','Vale / adiantamento','Diárias','Empreitas',
  'Alimentação','Transporte','Outros benefícios','Faltas','Outros descontos','INSS','FGTS',
  'Outros encargos','Categoria','Valor despesa','Vencimento'
]

function norm(value){
  return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
}
function money(value){
  if(typeof value==='number'&&Number.isFinite(value))return Math.round(value*100)
  const text=String(value??'').trim().replace(/R\$/gi,'').replace(/\s/g,'')
  if(!text)return 0
  const normalized=text.includes(',')?text.replace(/\./g,'').replace(',','.') : text
  const number=Number(normalized)
  return Number.isFinite(number)?Math.round(number*100):0
}
function date(value){
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10)
  const text=String(value??'').trim()
  if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text
  const match=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/)
  if(!match)return ''
  const year=match[3].length===2?`20${match[3]}`:match[3]
  return `${year}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`
}
function detectMapping(headers){
  return Object.fromEntries(FIELDS.map(field=>[
    field,
    headers.find(header=>(ALIASES[field]||[]).some(alias=>norm(header)===norm(alias)))||''
  ]))
}
function scoreMapping(map){
  return Object.values(map).filter(Boolean).length
}
function findHeaderIndex(rows){
  return rows.slice(0,20).reduce((best,row,index)=>{
    const map=detectMapping(row.map(value=>String(value||'')))
    const score=scoreMapping(map)
    return score>best.score?{index,score}:best
  },{index:0,score:-1}).index
}
function rowValue(row,map,field){return map[field]?row[map[field]]:undefined}
function normalizedValues(row,map){
  return {
    salario_centavos:money(rowValue(row,map,'salario')),
    vale_adiantamento_centavos:money(rowValue(row,map,'vale_adiantamento')),
    diarias_centavos:money(rowValue(row,map,'diarias')),
    empreitas_centavos:money(rowValue(row,map,'empreitas')),
    alimentacao_centavos:money(rowValue(row,map,'alimentacao')),
    transporte_centavos:money(rowValue(row,map,'transporte')),
    outros_beneficios_centavos:money(rowValue(row,map,'outros_beneficios')),
    faltas_centavos:money(rowValue(row,map,'faltas')),
    outros_descontos_centavos:money(rowValue(row,map,'outros_descontos')),
    inss_centavos:money(rowValue(row,map,'inss')),
    fgts_centavos:money(rowValue(row,map,'fgts')),
    outros_encargos_centavos:money(rowValue(row,map,'outros_encargos'))
  }
}
function hasEmployeeValues(values){return Object.values(values).some(value=>Number(value)>0)}

class PayrollImportFileService {
  constructor(){this.pending=new Map()}

  async choose(){
    const picked=await dialog.showOpenDialog({
      title:'Importar folha e despesas da empresa',
      properties:['openFile'],
      filters:[{name:'Planilhas',extensions:['xlsx','xlsm','csv']}]
    })
    if(picked.canceled)return null
    return this.analyze(picked.filePaths[0])
  }

  async analyze(filePath){
    assertSpreadsheetInput(filePath)
    const workbook=await readWorkbook(filePath)
    const token=crypto.randomUUID()
    const sheets=workbook.SheetNames.map(name=>{
      const rows=sheetRows(workbook.getWorksheet(name))
      const headerIndex=findHeaderIndex(rows)
      const headers=(rows[headerIndex]||[]).map((item,index)=>String(item||`Coluna ${index+1}`).trim())
      const suggestedMapping=detectMapping(headers)
      return {
        name,headerIndex,headers,
        rows:Math.max(0,rows.length-headerIndex-1),
        templateScore:TEMPLATE_HEADERS.filter(header=>headers.some(item=>norm(item)===norm(header))).length,
        suggestedMapping
      }
    })
    const hash=crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    this.pending.set(token,{filePath,hash,workbook,sheets})
    return {token,file:path.basename(filePath),hash,sheets}
  }

  payload(token,options={}){
    const pending=this.pending.get(token)
    if(!pending)throw new Error('A seleção expirou. Escolha a planilha novamente.')
    const sheet=pending.sheets.find(item=>item.name===options.sheet)||pending.sheets[0]
    if(!sheet)throw new Error('A planilha não possui uma aba válida.')
    const mode=options.mode==='template'?'template':'universal'
    const mapping={...sheet.suggestedMapping,...(options.mapping||{})}
    const rawRows=rowsAsObjects(sheetRows(pending.workbook.getWorksheet(sheet.name)),sheet.headerIndex)
    const rows=[]
    rawRows.forEach((row,index)=>{
      if(!Object.values(row).some(value=>String(value??'').trim()!==''))return
      const rowNumber=index+sheet.headerIndex+2
      const type=norm(rowValue(row,mapping,'tipo_linha'))
      const person=String(rowValue(row,mapping,'funcionario')||'').trim()
      const expense=String(rowValue(row,mapping,'despesa')||'').trim()
      const values=normalizedValues(row,mapping)
      const expenseValue=money(rowValue(row,mapping,'valor_despesa'))
      const explicitExpense=/despesa|empresa|imposto|conta/.test(type)
      const explicitEmployee=/funcionario|colaborador|folha/.test(type)
      const kind=explicitExpense?'expense':explicitEmployee?'employee':(!hasEmployeeValues(values)&&expenseValue>0?'expense':'employee')
      if(kind==='employee'){
        if(!person&&!hasEmployeeValues(values))return
        rows.push({
          id:`row-${rowNumber}`,row_number:rowNumber,cell:`${sheet.name}!${rowNumber}`,kind,
          funcionario:person,cpf:String(rowValue(row,mapping,'cpf')||'').replace(/\D/g,''),
          values,raw:row
        })
      }else{
        const description=expense||person
        if(!description||expenseValue<=0)return
        rows.push({
          id:`row-${rowNumber}`,row_number:rowNumber,cell:`${sheet.name}!${rowNumber}`,kind,
          descricao:description,categoria:String(rowValue(row,mapping,'categoria')||'').trim(),
          valor_centavos:expenseValue,vencimento:date(rowValue(row,mapping,'vencimento')),raw:row
        })
      }
    })
    return {
      file:{name:path.basename(pending.filePath),path:pending.filePath,hash:pending.hash,sheet:sheet.name},
      mode,mapping,headers:sheet.headers,rows
    }
  }

  async preview(token,options){return this.payload(token,options)}

  async saveTemplate(){
    const picked=await dialog.showSaveDialog({
      title:'Salvar modelo de folha — Obra na Mão',
      defaultPath:'Modelo-Folha-Obra-na-Mao.xlsx',
      filters:[{name:'Planilha Excel',extensions:['xlsx']}]
    })
    if(picked.canceled||!picked.filePath)return null
    const workbook=new ExcelJS.Workbook()
    const sheet=workbook.addWorksheet('Folha')
    sheet.addRow(TEMPLATE_HEADERS)
    sheet.addRow(['Funcionário','João da Silva','00000000000',2800,600,180,'',350,120,'',90,'',224,224,'','','',''])
    sheet.addRow(['Despesa empresa','Simples Nacional','','','','','','','','','','','','','','Impostos',4350,'20/10/2026'])
    sheet.getRow(1).font={bold:true}
    sheet.views=[{state:'frozen',ySplit:1,xSplit:2}]
    sheet.columns=TEMPLATE_HEADERS.map((header,index)=>({header,key:`c${index}`,width:index===1?28:18}))
    await workbook.xlsx.writeFile(picked.filePath)
    return {path:picked.filePath,file:path.basename(picked.filePath)}
  }

  release(token){this.pending.delete(token);return true}
}

module.exports={PayrollImportFileService,FIELDS,ALIASES,TEMPLATE_HEADERS,detectMapping,money,norm}
