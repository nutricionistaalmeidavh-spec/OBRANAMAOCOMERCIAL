const fs = require('node:fs/promises')
const path = require('node:path')
const ExcelJS = require('exceljs')
const { z } = require('zod')
const { readWorkbook, sheetRows } = require('./spreadsheet-reader.cjs')

const AREAS = Object.freeze(['orcamento','estoque','compras','financeiro','folha'])
const EDITABLE = Object.freeze(['orcamento','financeiro'])
const COLUMNS_LIMIT = 35
const MAX_EXPORT_ROWS = 10000
const MAX_EDIT_ROWS = 500

function parseDecimal(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string' || !raw.trim()) return null
  const value=raw.trim().replace(/[\s\u00a0\u202f]/g,'')
  if (!/^[+-]?(?:\d{1,3}(?:\.\d{3})+,\d+|\d+,\d+|\d+(?:\.\d+)?)$/.test(value)) return null
  const normalized=value.includes(',')?value.replace(/\./g,'').replace(',','.'):value
  const number=Number(normalized)
  return Number.isFinite(number)?number:null
}
function detectFormula(value) {
  if (typeof value !== 'string') return false
  const trimmed=value.trimStart()
  return /^[=+@]/.test(trimmed) || (/^-/.test(trimmed) && parseDecimal(trimmed)===null) || /^[\t\r\n]/.test(value)
}
function safeSpreadsheetText(value) {
  const text=String(value??'')
  return detectFormula(text)?"'"+text:text
}
function parseTsv(text) {
  return String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n$/,'').split('\n').map(line=>line.split('\t'))
}
const id=z.coerce.number().int().positive()
const money=z.number().int().nonnegative()
const budgetRow=z.object({
  id,quantidade:z.union([z.number(),z.string()]).transform(parseDecimal).refine(value=>value!==null&&value>=0,'Quantidade inválida'),
  valor_unitario_centavos:money,
  descricao:z.string().trim().min(1).optional(),unidade:z.string().trim().min(1).optional(),
  codigo:z.string().nullable().optional(),tipo:z.enum(['material','mao_de_obra','equipamento','servico']).optional(),
  frente_id:z.number().int().positive().nullable().optional(),subfrente_id:z.number().int().positive().nullable().optional(),
  etapa_id:z.number().int().positive().nullable().optional(),
  updated_at:z.string().optional()
})
const financeRow=z.object({
  id, descricao:z.string().trim().min(1).optional(),
  valor_centavos:money.refine(value=>value>0,'Valor precisa ser maior que zero'),
  vencimento:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  competencia:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  updated_at:z.string().optional()
})
function validateBatch(area,rows) {
  if (!EDITABLE.includes(area)) throw new Error('Área não permite edição em lote.')
  if (!Array.isArray(rows)||rows.length===0||rows.length>MAX_EDIT_ROWS) throw new Error('Lote de edição vazio ou acima do limite de 500 linhas.')
  const schema=area==='orcamento'?budgetRow:financeRow
  const seen=new Set()
  return rows.map((row,index)=>{
    const result=schema.safeParse(row)
    if (!result.success) throw new Error('Linha '+(index+1)+': '+result.error.issues.map(issue=>issue.path.join('.')+' '+issue.message).join('; '))
    if (seen.has(result.data.id)) throw new Error('ID repetido na linha '+(index+1)+'.')
    seen.add(result.data.id)
    return result.data
  })
}
function assertLocal(moduleStorage,area) {
  const target=area==='orcamento'?'planning':'finance'
  const mode=moduleStorage?.state(target)?.state
  if (mode && mode!=='local'&&mode!=='migration-required') {
    throw new Error('Edição em lote indisponível enquanto os dados estão no servidor. Use o cadastro individual até a sincronização homologada.')
  }
}

class OperationalSheetService {
  constructor({db,moduleStorage,dialog}) { this.db=db; this.moduleStorage=moduleStorage; this.dialog=dialog }
  commit(payload={}) {
    const area=String(payload.area||'')
    const rows=validateBatch(area,payload.rows)
    assertLocal(this.moduleStorage,area)
    const obraId=Number(payload.obraId||0)
    const empresaId=Number(payload.empresaId||0)
    return this.db.db.transaction(()=>{
      const updated=[]
      for (const row of rows) {
        const table=area==='orcamento'?'itens_orcamentarios':'contas'
        const old=this.db.get(table,row.id)
        if(!old || old.deleted_at) throw new Error('Registro #'+row.id+' não encontrado ou excluído.')
        if (area==='orcamento' && (!obraId||Number(old.obra_id)!==obraId)) throw new Error('Item #'+row.id+' não pertence à obra selecionada.')
        if (area==='financeiro') {
          if (empresaId && Number(old.empresa_id)!==empresaId) throw new Error('Conta #'+row.id+' não pertence à empresa selecionada.')
          if(!['pendente','vencido'].includes(String(old.status||''))) throw new Error('Conta #'+row.id+' já possui movimento, baixa ou situação que impede editar em lote.')
          if(old.origem_tipo && old.origem_tipo!=='manual') throw new Error('Conta #'+row.id+' é gerada por outro módulo. Edite na origem.')
          const payments=this.db.db.prepare('SELECT COUNT(*) total FROM pagamentos_conta WHERE conta_id=?').get(row.id)
          if(Number(payments?.total||0)>0) throw new Error('Conta #'+row.id+' tem baixas e não pode ser editada em lote.')
        }
        if(row.updated_at && old.updated_at && row.updated_at!==old.updated_at) throw new Error('Registro #'+row.id+' foi alterado por outro usuário. Atualize a planilha.')
        const {id,updated_at,...values}=row
        const patch=area==='financeiro'?{...values,valor_bruto_centavos:values.valor_centavos}:values
        updated.push(this.db.save(table,{id,...patch}))
      }
      return {updated:updated.length,ids:updated.map(row=>row.id)}
    })()
  }
  async loadNoteItems() {
    const choice=await this.dialog.showOpenDialog({
      title:'Selecionar planilha de itens da nota (revisão sem gravação)',
      properties:['openFile'],
      filters:[{name:'Planilhas',extensions:['xlsx','xlsm','csv']}]
    })
    if(choice.canceled||!choice.filePaths?.length)return null
    let workbook
    if(path.extname(choice.filePaths[0]).toLowerCase()==='.csv'){
      // CSV do Excel brasileiro costuma utilizar ponto e vírgula.
      const sample=(await fs.readFile(choice.filePaths[0],'utf8')).replace(/^\uFEFF/,'').split(/\r?\n/,1)[0]
      const delimiter=(sample.match(/;/g)||[]).length>(sample.match(/,/g)||[]).length?';':','
      workbook=new ExcelJS.Workbook()
      await workbook.csv.readFile(choice.filePaths[0],{parserOptions:{delimiter}})
    }else{
      workbook=await readWorkbook(choice.filePaths[0])
    }
    const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
    const findIndex=(headers,keys)=>headers.findIndex(header=>keys.includes(normalize(header)))
    let selection=null
    for(const sheet of workbook.worksheets){
      const values=sheetRows(sheet)
      for(let line=0;line<Math.min(12,values.length);line++){
        const headers=values[line]||[]
        const desc=findIndex(headers,['descricao','produto','material','item','servico'])
        const qty=findIndex(headers,['quantidade','qtd','qtde'])
        if(desc>=0&&qty>=0){selection={values,line,desc,qty,unit:findIndex(headers,['unidade','und','un']),price:findIndex(headers,['valorunitario','precounitario','preco','valorunitariors'])};break}
      }
      if(selection)break
    }
    if(!selection)throw new Error('Não encontramos colunas Descrição e Quantidade. Confira os cabeçalhos da planilha.')
    const rows=[]
    for(let index=selection.line+1;index<selection.values.length;index++){
      const values=selection.values[index]||[]
      if(!values.some(value=>String(value??'').trim()))continue
      if(rows.length>=500)throw new Error('Limite de 500 itens por nota. Divida a planilha para revisar por partes.')
      const descricao=String(values[selection.desc]||'').trim()
      const quantidade=parseDecimal(values[selection.qty])
      const preco=selection.price<0?0:parseDecimal(values[selection.price])
      if(!descricao||quantidade===null||quantidade<=0||preco===null||preco<0){
        throw new Error('Linha '+(index+1)+': confira descrição, quantidade maior que zero e preço unitário não negativo.')
      }
      rows.push({descricao,quantidade:String(quantidade),unidade:String(values[selection.unit]||'un'),valor_unitario:String(preco).replace('.',',')})
    }
    if(!rows.length)throw new Error('A planilha não contém itens para importar.')
    return {rows,file:path.basename(choice.filePaths[0])}
  }

  async exportFile(payload={}) {
    const area=String(payload.area||'')
    const format=String(payload.format||'xlsx').toLowerCase()
    if(!AREAS.includes(area)||!['xlsx','csv'].includes(format)) throw new Error('Área ou formato de exportação inválido.')
    const columns=payload.columns
    const rows=payload.rows
    if(!Array.isArray(columns)||columns.length<1||columns.length>COLUMNS_LIMIT||!Array.isArray(rows)||rows.length>MAX_EXPORT_ROWS) {
      throw new Error('Exportação excede os limites permitidos.')
    }
    const fields=columns.map(column=>{
      if (!column||typeof column.key!=='string'||!/^[\w.]+$/.test(column.key)||typeof column.label!=='string'||column.label.length>100) throw new Error('Coluna inválida.')
      return {key:column.key,label:column.label}
    })
    const filename=String(payload.filename||area).replace(/[^a-z0-9_-]/gi,'-').slice(0,65)
    const dialogResult=await this.dialog.showSaveDialog({
      title:'Exportar planilha — '+area,
      defaultPath:filename+'.'+format,
      filters:[{name:format==='xlsx'?'Planilha Excel':'Valores separados',extensions:[format]}]
    })
    if(dialogResult.canceled||!dialogResult.filePath) return {canceled:true}
    const filePath=dialogResult.filePath.toLowerCase().endsWith('.'+format)?dialogResult.filePath:dialogResult.filePath+'.'+format
    const values=rows.map(row=>fields.map(field=>{
      const raw=row?.[field.key]
      return typeof raw==='number' && Number.isFinite(raw)?raw:safeSpreadsheetText(raw)
    }))
    if(format==='csv'){
      const csv=[fields.map(f=>f.label),...values].map(line=>line.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(';')).join('\r\n')
      await fs.writeFile(filePath,'\uFEFF'+csv,'utf8')
    } else {
      const workbook=new ExcelJS.Workbook()
      workbook.creator='Obra na Mão · ArtiSys'
      const sheet=workbook.addWorksheet('Dados')
      sheet.addRow(fields.map(f=>f.label))
      sheet.getRow(1).font={bold:true}
      sheet.views=[{state:'frozen',ySplit:1}]
      fields.forEach((f,index)=>{sheet.getColumn(index+1).width=Math.max(14,Math.min(45,f.label.length+8))})
      for(const row of values) sheet.addRow(row)
      sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,values.length+1),column:fields.length}}
      await workbook.xlsx.writeFile(filePath)
    }
    return {canceled:false,path:filePath,rows:rows.length,format}
  }
}
module.exports={OperationalSheetService,parseDecimal,safeSpreadsheetText,detectFormula,parseTsv,validateBatch}
