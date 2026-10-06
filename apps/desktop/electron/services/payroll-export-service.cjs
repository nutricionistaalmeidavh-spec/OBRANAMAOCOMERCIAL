const fs = require('node:fs')
const path = require('node:path')
const ExcelJS = require('exceljs')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const { PAYROLL_OVERVIEW_COLUMNS } = require('./domain-core.cjs')

const GROUPS = [
  { key:'remuneracao', label:'Remuneração' },
  { key:'beneficios', label:'Benefícios' },
  { key:'descontos', label:'Descontos' },
  { key:'encargos', label:'Encargos' }
]

const columnGroup = (key) => String(key || '').split('.')[0]
const columnField = (key) => String(key || '').split('.')[1]
const cents = (value) => Number(value || 0)
const reais = (value) => cents(value) / 100
const brl = (value) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(reais(value))
const competence = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/)
  return match ? `${match[2]}/${match[1]}` : String(value || '')
}
const safeBaseName = (value) => String(value || 'folha').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()
const pdfText = (value) => String(value ?? '').replace(/[\r\n\t]+/g,' ').replace(/[–—]/g,'-').replace(/•/g,'-')

function overviewValue(row, key) {
  const group = columnGroup(key)
  const field = columnField(key)
  return cents(row?.[group]?.[`${field}_centavos`])
}

function filterLine(payload, overview) {
  const parts = [`Competência: ${competence(overview.competencia || payload.competencia)}`]
  if (payload.empresa_nome) parts.push(`Empresa: ${payload.empresa_nome}`)
  else if (overview.filters?.empresa_id) parts.push(`Empresa #${overview.filters.empresa_id}`)
  if (payload.obra_nome) parts.push(`Obra: ${payload.obra_nome}`)
  else if (overview.filters?.obra_id) parts.push(`Obra #${overview.filters.obra_id}`)
  return parts.join(' | ')
}

function applyExcelHeader(cell) {
  cell.font = { bold:true, color:{argb:'FFFFFFFF'} }
  cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF17305F'} }
  cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true }
  cell.border = { bottom:{style:'thin',color:{argb:'FFD4DCE8'}} }
}

function applyExcelMoney(cell, discount = false) {
  cell.numFmt = '"R$" #,##0.00;-"R$" #,##0.00'
  cell.alignment = { horizontal:'right' }
}

class PayrollExportService {
  constructor({ payroll, dialog }) {
    if (!payroll?.overview) throw new Error('Fonte da folha indisponível para exportação.')
    if (!dialog?.showSaveDialog) throw new Error('Diálogo de exportação indisponível.')
    this.payroll = payroll
    this.dialog = dialog
  }

  async data(payload = {}) {
    const overview = await this.payroll.overview({
      competencia:payload.competencia,
      empresa_id:payload.empresa_id || null,
      obra_id:payload.obra_id || null
    })
    if (!overview) throw new Error('Não foi possível carregar a visão geral da folha.')
    return overview
  }

  defaultName(payload, extension) {
    return `visao-geral-folha-${safeBaseName(payload.competencia || 'competencia')}.${extension}`
  }

  async choosePath(payload, extension) {
    const result = await this.dialog.showSaveDialog({
      title: extension === 'xlsx' ? 'Exportar visão geral para Excel' : 'Exportar visão geral para PDF',
      defaultPath: this.defaultName(payload, extension),
      filters: extension === 'xlsx'
        ? [{ name:'Planilha Excel', extensions:['xlsx'] }]
        : [{ name:'Documento PDF', extensions:['pdf'] }]
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath.toLowerCase().endsWith(`.${extension}`) ? result.filePath : `${result.filePath}.${extension}`
  }

  async export(payload = {}) {
    const format = String(payload.format || '').toLowerCase()
    if (!['xlsx','pdf'].includes(format)) throw new Error('Formato de exportação inválido.')
    const overview = await this.data(payload)
    if (format === 'xlsx') return this.exportExcel(payload, overview)
    return this.exportPdf(payload, overview)
  }

  async exportExcel(payload, overview) {
    const filePath = await this.choosePath(payload, 'xlsx')
    if (!filePath) return { canceled:true, format:'xlsx' }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Obra na Mão'
    workbook.created = new Date()
    const sheet = workbook.addWorksheet('Visão geral', {
      views:[{state:'frozen',xSplit:1,ySplit:5}]
    })

    const totalColumns = 1 + PAYROLL_OVERVIEW_COLUMNS.length + 2
    sheet.mergeCells(1,1,1,totalColumns)
    sheet.getCell(1,1).value = 'Obra na Mão - Visão geral da folha'
    sheet.getCell(1,1).font = {bold:true,size:16,color:{argb:'FF17305F'}}
    sheet.mergeCells(2,1,2,totalColumns)
    sheet.getCell(2,1).value = filterLine(payload, overview)
    sheet.getCell(2,1).font = {size:10,color:{argb:'FF5E6A80'}}

    let col = 2
    for (const group of GROUPS) {
      const groupColumns = PAYROLL_OVERVIEW_COLUMNS.filter(item=>columnGroup(item.key)===group.key)
      if (!groupColumns.length) continue
      sheet.mergeCells(4,col,4,col+groupColumns.length-1)
      const cell=sheet.getCell(4,col)
      cell.value=group.label
      applyExcelHeader(cell)
      col += groupColumns.length
    }
    sheet.mergeCells(4,col,5,col)
    sheet.getCell(4,col).value='Total funcionário'
    applyExcelHeader(sheet.getCell(4,col))
    sheet.mergeCells(4,col+1,5,col+1)
    sheet.getCell(4,col+1).value='Custo empresa'
    applyExcelHeader(sheet.getCell(4,col+1))

    sheet.mergeCells(4,1,5,1)
    sheet.getCell(4,1).value='Funcionário / despesa'
    applyExcelHeader(sheet.getCell(4,1))
    PAYROLL_OVERVIEW_COLUMNS.forEach((column,index)=>{
      const cell=sheet.getCell(5,index+2)
      cell.value=column.label
      applyExcelHeader(cell)
    })

    let rowIndex=6
    for (const employee of overview.employees || []) {
      const row=sheet.getRow(rowIndex++)
      row.getCell(1).value=employee.cargo_nome ? `${employee.funcionario_nome} — ${employee.cargo_nome}` : employee.funcionario_nome
      PAYROLL_OVERVIEW_COLUMNS.forEach((column,index)=>{
        const value=overviewValue(employee,column.key)
        const cell=row.getCell(index+2)
        cell.value=reais(columnGroup(column.key)==='descontos' ? -Math.abs(value) : value)
        applyExcelMoney(cell,columnGroup(column.key)==='descontos')
      })
      row.getCell(totalColumns-1).value=reais(employee.total_funcionario_centavos)
      row.getCell(totalColumns).value=reais(employee.custo_empresa_centavos)
      applyExcelMoney(row.getCell(totalColumns-1))
      applyExcelMoney(row.getCell(totalColumns))
    }

    if ((overview.company_expenses || []).length) {
      const section=sheet.getRow(rowIndex++)
      sheet.mergeCells(section.number,1,section.number,totalColumns)
      section.getCell(1).value='Despesas da empresa'
      section.getCell(1).font={bold:true,color:{argb:'FF17305F'}}
      section.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF1F4F9'}}
      for (const expense of overview.company_expenses) {
        const row=sheet.getRow(rowIndex++)
        row.getCell(1).value=expense.categoria_nome ? `${expense.descricao} — ${expense.categoria_nome}` : expense.descricao
        row.getCell(totalColumns).value=reais(expense.valor_centavos)
        applyExcelMoney(row.getCell(totalColumns))
      }
    }

    const totalRow=sheet.getRow(rowIndex)
    totalRow.getCell(1).value='TOTAL DA COMPETÊNCIA'
    totalRow.font={bold:true,color:{argb:'FF17305F'}}
    totalRow.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF1F4F9'}}
    PAYROLL_OVERVIEW_COLUMNS.forEach((column,index)=>{
      const value=cents(overview.totals?.by_column_centavos?.[column.key])
      const cell=totalRow.getCell(index+2)
      cell.value=reais(columnGroup(column.key)==='descontos' ? -Math.abs(value) : value)
      applyExcelMoney(cell,columnGroup(column.key)==='descontos')
    })
    totalRow.getCell(totalColumns-1).value=reais(overview.totals?.total_funcionarios_centavos)
    totalRow.getCell(totalColumns).value=reais(overview.totals?.custo_competencia_centavos)
    applyExcelMoney(totalRow.getCell(totalColumns-1))
    applyExcelMoney(totalRow.getCell(totalColumns))

    sheet.getColumn(1).width=34
    for(let index=2;index<=totalColumns;index++) sheet.getColumn(index).width=index>=totalColumns-1?18:15
    await workbook.xlsx.writeFile(filePath)

    return {
      canceled:false, format:'xlsx', path:filePath,
      employees:(overview.employees||[]).length,
      expenses:(overview.company_expenses||[]).length,
      total_centavos:cents(overview.totals?.custo_competencia_centavos)
    }
  }

  async exportPdf(payload, overview) {
    const filePath = await this.choosePath(payload, 'pdf')
    if (!filePath) return { canceled:true, format:'pdf' }

    const pdf = await PDFDocument.create()
    const regular = await pdf.embedFont(StandardFonts.Helvetica)
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
    const pageSize=[841.89,595.28]
    const margin=34
    const lineHeight=15
    const dark=rgb(0.09,0.19,0.37)
    const muted=rgb(0.38,0.43,0.52)
    const border=rgb(0.86,0.88,0.92)

    const newPage=(title,subtitle='')=>{
      const page=pdf.addPage(pageSize)
      const {height}=page.getSize()
      page.drawText(pdfText(title),{x:margin,y:height-margin,size:15,font:bold,color:dark})
      if(subtitle) page.drawText(pdfText(subtitle),{x:margin,y:height-margin-19,size:8.5,font:regular,color:muted})
      return {page,y:height-margin-43}
    }
    const drawRow=(ctx,cells,widths,{header=false,boldRow=false}={})=>{
      const {page}=ctx
      const height=20
      let x=margin
      for(let i=0;i<cells.length;i++){
        const width=widths[i]
        page.drawRectangle({x,y:ctx.y-height+4,width,height,borderColor:border,borderWidth:.5,color:header?rgb(.95,.96,.98):rgb(1,1,1)})
        const text=pdfText(cells[i])
        const font=header||boldRow?bold:regular
        const size=header?7:7.5
        let display=text
        while(display.length>2 && font.widthOfTextAtSize(display,size)>width-8) display=display.slice(0,-1)
        if(display!==text) display=display.slice(0,-3)+'...'
        page.drawText(display,{x:x+4,y:ctx.y-10,size,font,color:dark})
        x+=width
      }
      ctx.y-=height
    }
    const ensure=(ctx,needed,title,subtitle)=>{
      if(ctx.y-needed>margin)return ctx
      return newPage(title,subtitle)
    }

    let ctx=newPage('Visão geral da folha',filterLine(payload,overview))
    const summary=[
      ['Funcionários',String((overview.employees||[]).length)],
      ['Despesas da empresa',String((overview.company_expenses||[]).length)],
      ['Total funcionários',brl(overview.totals?.total_funcionarios_centavos)],
      ['Custo funcionários',brl(overview.totals?.custo_funcionarios_centavos)],
      ['Despesas empresa',brl(overview.totals?.despesas_empresa_centavos)],
      ['Custo da competência',brl(overview.totals?.custo_competencia_centavos)]
    ]
    drawRow(ctx,['Indicador','Valor'],[250,250],{header:true})
    summary.forEach(row=>drawRow(ctx,row,[250,250],{boldRow:row[0]==='Custo da competência'}))

    for(const group of GROUPS){
      const columns=PAYROLL_OVERVIEW_COLUMNS.filter(item=>columnGroup(item.key)===group.key)
      ctx=newPage(group.label,filterLine(payload,overview))
      const usable=pageSize[0]-(margin*2)
      const moneyWidth=Math.max(68,Math.floor((usable-170-190)/Math.max(1,columns.length)))
      const widths=[170,...columns.map(()=>moneyWidth),95,95]
      drawRow(ctx,['Funcionário',...columns.map(item=>item.label),'Total funcionário','Custo empresa'],widths,{header:true})
      for(const employee of overview.employees||[]){
        ctx=ensure(ctx,lineHeight+12,group.label,filterLine(payload,overview))
        drawRow(ctx,[employee.funcionario_nome,...columns.map(column=>{
          const value=overviewValue(employee,column.key)
          return brl(columnGroup(column.key)==='descontos'?-Math.abs(value):value)
        }),brl(employee.total_funcionario_centavos),brl(employee.custo_empresa_centavos)],widths)
      }
      const totals=['TOTAL',...columns.map(column=>{
        const value=cents(overview.totals?.by_column_centavos?.[column.key])
        return brl(columnGroup(column.key)==='descontos'?-Math.abs(value):value)
      }),brl(overview.totals?.total_funcionarios_centavos),brl(overview.totals?.custo_funcionarios_centavos)]
      drawRow(ctx,totals,widths,{boldRow:true})
    }

    if((overview.company_expenses||[]).length){
      ctx=newPage('Despesas da empresa',filterLine(payload,overview))
      const widths=[330,190,140,110]
      drawRow(ctx,['Descrição','Categoria','Vencimento','Valor'],widths,{header:true})
      for(const expense of overview.company_expenses){
        ctx=ensure(ctx,lineHeight+12,'Despesas da empresa',filterLine(payload,overview))
        drawRow(ctx,[expense.descricao,expense.categoria_nome||'Outras despesas',expense.vencimento||'',brl(expense.valor_centavos)],widths)
      }
      drawRow(ctx,['TOTAL','','',brl(overview.totals?.despesas_empresa_centavos)],widths,{boldRow:true})
    }

    const bytes=await pdf.save()
    fs.writeFileSync(filePath,bytes)
    return {
      canceled:false, format:'pdf', path:filePath,
      employees:(overview.employees||[]).length,
      expenses:(overview.company_expenses||[]).length,
      total_centavos:cents(overview.totals?.custo_competencia_centavos)
    }
  }
}

module.exports={ PayrollExportService, overviewValue, filterLine }
