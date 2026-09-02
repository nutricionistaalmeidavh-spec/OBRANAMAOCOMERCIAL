const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { dialog } = require('electron')
const { assertSpreadsheetInput } = require('./spreadsheet-guard.cjs')
const { readWorkbook, sheetRows, rowsAsObjects, parseExcelDate } = require('./spreadsheet-reader.cjs')

const AREAS = {
  financeiro: { label: 'Financeiro', fields: ['descricao','valor','tipo','competencia','vencimento','categoria','obra','fornecedor','cliente'] },
  obras: { label: 'Obras', fields: ['nome','codigo','cliente','endereco','responsavel','valor','data_inicio','previsao_termino','status'] },
  orcamento: { label: 'Orcamento', fields: ['obra','frente','descricao','codigo','unidade','quantidade','valor_unitario','tipo','etapa','local'] },
  funcionarios: { label: 'Funcionarios', fields: ['nome','cpf','telefone','email','cargo','salario','departamento','obra','status'] },
  compras: { label: 'Compras', fields: ['obra','frente','descricao','fornecedor','valor','quantidade','unidade','data','vencimento','status','nota_fiscal'] },
  contratos: { label: 'Contratos', fields: ['obra','frente','numero','descricao','cliente','fornecedor','valor','data_inicio','data_fim','status','tipo','retencao','garantia'] },
  aditivos: { label: 'Aditivos', fields: ['contrato','numero','descricao','valor','data','status','impacto_prazo_dias'] },
  medicoes: { label: 'Medicoes', fields: ['obra','frente','contrato','numero','competencia','data','periodo_inicio','periodo_fim','descricao','valor','retencao','desconto','status'] },
  ponto: { label: 'Ponto', fields: ['funcionario','competencia','data','entrada','saida','horas','observacoes'] },
  documentos: { label: 'Documentos', fields: ['obra','frente','funcionario','categoria','titulo','vencimento','observacoes'] },
  estoque: { label: 'Estoque', fields: ['obra','frente','descricao','unidade','quantidade','tipo','data','observacoes'] }
}

const ALIASES = {
  descricao: ['descricao','descrição','historico','histórico','lancamento','lançamento','item','servico','serviço','material','nome'],
  valor: ['valor','total','valor total','valor r$','vlr','preco','preço'],
  tipo: ['tipo','natureza','movimento'],
  competencia: ['competencia','competência','mes','mês','periodo','período'],
  vencimento: ['vencimento','data vencimento','data pagamento'],
  categoria: ['categoria','classificacao','classificação','grupo','centro de custo'],
  obra: ['obra','empreendimento','projeto','centro de custo'],
  frente: ['frente','frente de servico','frente de serviço','especialidade'],
  fornecedor: ['fornecedor','credor','parceiro'],
  cliente: ['cliente','contratante'],
  nome: ['nome','funcionario','funcionário','colaborador','obra'],
  codigo: ['codigo','código','cod','id obra'],
  endereco: ['endereco','endereço','localizacao','localização'],
  responsavel: ['responsavel','responsável','engenheiro','gestor'],
  data_inicio: ['inicio','início','data inicio','data início'],
  data_fim: ['fim','data fim','termino','término'],
  previsao_termino: ['previsao termino','previsão término','termino','término','fim','data fim'],
  status: ['status','situacao','situação'],
  unidade: ['unidade','un','und'],
  quantidade: ['quantidade','qtd','quant'],
  valor_unitario: ['valor unitario','valor unitário','preco unitario','preço unitário'],
  etapa: ['etapa','fase'],
  local: ['local','ambiente','setor'],
  cpf: ['cpf'],
  telefone: ['telefone','celular','fone'],
  email: ['email','e-mail'],
  cargo: ['cargo','funcao','função'],
  salario: ['salario','salário','remuneracao','remuneração'],
  departamento: ['departamento','setor'],
  contrato: ['contrato','numero contrato','n contrato','nº contrato'],
  numero: ['numero','número','n','nº'],
  retencao: ['retencao','retenção'],
  desconto: ['desconto','descontos'],
  garantia: ['garantia'],
  impacto_prazo_dias: ['impacto prazo','dias prazo','prazo dias'],
  funcionario: ['funcionario','funcionário','colaborador','nome'],
  entrada: ['entrada','hora entrada'],
  saida: ['saida','saída','hora saida','hora saída'],
  horas: ['horas','total horas'],
  titulo: ['titulo','título','documento'],
  nota_fiscal: ['nota fiscal','nf','numero nf','número nf'],
  observacoes: ['observacoes','observações','obs'],
  data: ['data','emissao','emissão']
}

function norm(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function money(value) {
  if (typeof value === 'number') return Math.round(value * 100)
  const text = String(value ?? '').trim().replace(/R\$/gi, '').replace(/\./g, '').replace(',', '.')
  const number = Number(text)
  return Number.isFinite(number) ? Math.round(number * 100) : 0
}
function date(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') {
    const parsed = parseExcelDate(value)
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  const text = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3]
    return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  }
  return ''
}
function competence(value) {
  const parsed = date(value)
  if (parsed) return parsed.slice(0, 7)
  const text = String(value ?? '').trim()
  return /^\d{4}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 7)
}
function detect(headers) {
  return Object.fromEntries(Object.entries(AREAS).map(([area, definition]) => [
    area,
    definition.fields.reduce((score, field) => score + ((ALIASES[field] || []).some((alias) => headers.some((header) => norm(header) === norm(alias))) ? 1 : 0), 0)
  ]))
}
function mapping(headers, area) {
  const values = {}
  for (const field of AREAS[area].fields) values[field] = headers.find((header) => (ALIASES[field] || []).some((alias) => norm(header) === norm(alias))) || ''
  return values
}
function value(row, map, field) { return map[field] ? row[map[field]] : undefined }
function required(area) {
  return ({
    financeiro: ['descricao','valor'], obras: ['nome'], orcamento: ['obra','descricao','valor_unitario'], funcionarios: ['nome'],
    compras: ['obra','descricao','valor'], contratos: ['obra','descricao','valor'], aditivos: ['contrato','descricao','valor'],
    medicoes: ['obra','numero','valor'], ponto: ['funcionario','competencia'], documentos: ['titulo'], estoque: ['obra','descricao','quantidade']
  })[area] || ['descricao']
}

class UniversalImportService {
  constructor({ db }) { this.db = db; this.pending = new Map() }

  async choose() {
    const picked = await dialog.showOpenDialog({ title: 'Selecionar planilha ou CSV', properties: ['openFile'], filters: [{ name: 'Planilhas', extensions: ['xlsx','xlsm','csv'] }] })
    if (picked.canceled) return null
    return this.analyze(picked.filePaths[0])
  }

  async analyze(filePath) {
    assertSpreadsheetInput(filePath)
    const workbook = await readWorkbook(filePath)
    const token = crypto.randomUUID()
    const sheets = workbook.SheetNames.map((name) => {
      const rows = sheetRows(workbook.getWorksheet(name))
      const headerIndex = rows.slice(0, 20).reduce((best, row, index) => {
        const score = Object.values(detect(row)).reduce((sum, item) => sum + item, 0)
        return score > best.score ? { index, score } : best
      }, { index: 0, score: -1 }).index
      const headers = rows[headerIndex].map((item, index) => String(item || `Coluna ${index + 1}`).trim())
      const scores = detect(headers)
      const area = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]
      return { name, headers, headerIndex, rows: Math.max(0, rows.length - headerIndex - 1), scores, area, sample: rows.slice(headerIndex + 1, headerIndex + 6) }
    })
    const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    this.pending.set(token, { filePath, hash, workbook, sheets })
    return { token, file: path.basename(filePath), hash, sheets: sheets.map(({ name, headers, headerIndex, rows, scores, area }) => ({ name, headers, headerIndex, rows, scores, area })) }
  }

  async preview(token, options) {
    const pending = this.pending.get(token)
    if (!pending) throw new Error('A selecao expirou. Escolha o arquivo novamente.')
    const sheet = pending.sheets.find((item) => item.name === options.sheet)
    if (!sheet) throw new Error('Aba nao encontrada.')
    const area = AREAS[options.area] ? options.area : sheet.area
    const map = { ...mapping(sheet.headers, area), ...(options.mapping || {}) }
    const rows = rowsAsObjects(sheetRows(pending.workbook.getWorksheet(sheet.name)), sheet.headerIndex).slice(0, 200)
    const valid = rows.filter((row) => Object.values(row).some(Boolean))
    return { area, label: AREAS[area].label, headers: sheet.headers, mapping: map, rows: valid.slice(0, 12), total: valid.length, missing: required(area).filter((field) => !map[field]), createMissing: ['categoria','obra','frente','fornecedor','cliente','cargo','funcionario','contrato'].filter((field) => map[field]) }
  }

  async commit(token, options) {
    const pending = this.pending.get(token)
    if (!pending) throw new Error('A selecao expirou. Escolha o arquivo novamente.')
    const preview = await this.preview(token, options)
    if (preview.missing.length) throw new Error(`Mapeie os campos obrigatorios: ${preview.missing.join(', ')}.`)
    const sheet = pending.sheets.find((item) => item.name === options.sheet)
    const rows = rowsAsObjects(sheetRows(pending.workbook.getWorksheet(sheet.name)), sheet.headerIndex)
    const area = preview.area
    const map = preview.mapping
    return this.db.db.transaction(() => {
      if (this.db.db.prepare("SELECT id FROM importacoes WHERE hash=? AND aba=? AND status='concluida'").get(pending.hash, `universal:${sheet.name}`)) throw new Error('Esta aba ja foi importada.')
      let company = this.db.db.prepare('SELECT * FROM empresas WHERE deleted_at IS NULL ORDER BY id LIMIT 1').get()
      if (!company) company = this.db.save('empresas', { razao_social: 'Empresa importada', nome_fantasia: 'Empresa importada', status: 'ativa' })
      const imported = this.db.save('importacoes', { arquivo: pending.filePath, hash: pending.hash, aba: `universal:${sheet.name}`, status: 'processando', resumo: '{}' })
      let created = 0
      let count = 0
      const raw = this.db.db.prepare('INSERT INTO importacao_linhas(importacao_id,competencia,celula,tipo,nome_origem,valor_centavos,dados_brutos,entidade_tipo,entidade_id,status) VALUES (?,?,?,?,?,?,?,?,?,?)')
      const findOrCreate = (table, column, name, data) => {
        if (!name) return null
        let item = this.db.db.prepare(`SELECT * FROM ${table} WHERE lower(${column})=lower(?)${table === 'obras' || table === 'fornecedores' || table === 'clientes' ? ' AND deleted_at IS NULL' : ''}`).get(String(name).trim())
        if (!item) { item = this.db.save(table, data); created++ }
        return item
      }
      const workByName = (name) => findOrCreate('obras', 'nome', String(name || '').trim(), { empresa_id: company.id, nome: String(name || '').trim(), status: 'planejada' })
      const frontByName = (work, name) => {
        const text = String(name || '').trim()
        if (!work || !text) return null
        let item = this.db.db.prepare('SELECT * FROM frentes_obra WHERE obra_id=? AND lower(nome)=lower(?) AND deleted_at IS NULL').get(work.id, text)
        if (!item) { item = this.db.save('frentes_obra', { obra_id: work.id, nome: text, status: 'ativa' }); created++ }
        return item
      }
      const contractByNumber = (number) => this.db.db.prepare('SELECT * FROM contratos_obra WHERE lower(COALESCE(numero,descricao))=lower(?) AND deleted_at IS NULL ORDER BY id DESC LIMIT 1').get(String(number || '').trim())

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index]
        if (!Object.values(row).some(Boolean)) continue
        let entity = null
        if (area === 'financeiro') {
          const description = String(value(row, map, 'descricao') || '').trim()
          const amount = money(value(row, map, 'valor'))
          if (!description || amount <= 0) continue
          const type = /receb|receita|entrada|credit/i.test(String(value(row, map, 'tipo') || '')) ? 'receber' : 'pagar'
          const categoryName = String(value(row, map, 'categoria') || (type === 'receber' ? 'Receitas de contratos' : 'Outras despesas')).trim()
          const category = findOrCreate('categorias_financeiras', 'nome', categoryName, { nome: categoryName, natureza: type === 'receber' ? 'receita' : 'despesa', grupo_dre: type === 'receber' ? 'receita_operacional' : 'operacional', ativa: 1 })
          const work = workByName(value(row, map, 'obra'))
          const supplier = findOrCreate('fornecedores', 'nome', String(value(row, map, 'fornecedor') || '').trim(), { nome: String(value(row, map, 'fornecedor') || '').trim(), status: 'ativo' })
          const client = findOrCreate('clientes', 'nome', String(value(row, map, 'cliente') || '').trim(), { nome: String(value(row, map, 'cliente') || '').trim(), status: 'ativo' })
          const due = date(value(row, map, 'vencimento')) || `${competence(value(row, map, 'competencia'))}-28`
          entity = this.db.save('contas', { tipo: type, empresa_id: company.id, obra_id: work?.id || null, fornecedor_id: supplier?.id || null, cliente_id: client?.id || null, categoria_id: category?.id || null, descricao: description, competencia: competence(value(row, map, 'competencia') || due), vencimento: due, valor_bruto_centavos: amount, valor_centavos: amount, status: 'pendente', origem_tipo: 'importacao_universal', origem_id: imported.id })
        } else if (area === 'obras') {
          const name = String(value(row, map, 'nome') || '').trim()
          if (!name) continue
          const client = findOrCreate('clientes', 'nome', String(value(row, map, 'cliente') || '').trim(), { nome: String(value(row, map, 'cliente') || '').trim(), status: 'ativo' })
          entity = findOrCreate('obras', 'nome', name, { empresa_id: company.id, nome: name, codigo: String(value(row, map, 'codigo') || ''), cliente_id: client?.id || null, endereco: String(value(row, map, 'endereco') || ''), responsavel: String(value(row, map, 'responsavel') || ''), valor_contratado_centavos: money(value(row, map, 'valor')), data_inicio: date(value(row, map, 'data_inicio')), previsao_termino: date(value(row, map, 'previsao_termino')), status: String(value(row, map, 'status') || 'planejada') })
        } else if (area === 'orcamento') {
          const work = workByName(value(row, map, 'obra'))
          const front = frontByName(work, value(row, map, 'frente'))
          const description = String(value(row, map, 'descricao') || '').trim()
          if (!work || !description) continue
          entity = this.db.save('itens_orcamentarios', { obra_id: work.id, frente_id: front?.id || null, codigo: String(value(row, map, 'codigo') || ''), descricao: description, unidade: String(value(row, map, 'unidade') || 'un'), quantidade: Number(value(row, map, 'quantidade') || 1), valor_unitario_centavos: money(value(row, map, 'valor_unitario')), tipo: String(value(row, map, 'tipo') || 'servico').replace(/\s+/g, '_') })
        } else if (area === 'funcionarios') {
          const name = String(value(row, map, 'nome') || '').trim()
          if (!name) continue
          const role = findOrCreate('cargos', 'nome', String(value(row, map, 'cargo') || '').trim(), { nome: String(value(row, map, 'cargo') || '').trim(), ativo: 1 })
          const work = workByName(value(row, map, 'obra'))
          entity = findOrCreate('funcionarios', 'nome', name, { empresa_id: company.id, nome: name, cpf: String(value(row, map, 'cpf') || '') || null, telefone: String(value(row, map, 'telefone') || ''), email: String(value(row, map, 'email') || ''), cargo_id: role?.id || null, obra_atual_id: work?.id || null, salario_centavos: money(value(row, map, 'salario')), departamento: String(value(row, map, 'departamento') || ''), status: String(value(row, map, 'status') || 'ativo') })
        } else if (area === 'compras') {
          const work = workByName(value(row, map, 'obra'))
          const front = frontByName(work, value(row, map, 'frente'))
          const supplier = findOrCreate('fornecedores', 'nome', String(value(row, map, 'fornecedor') || '').trim(), { nome: String(value(row, map, 'fornecedor') || '').trim(), status: 'ativo' })
          const description = String(value(row, map, 'descricao') || '').trim()
          if (!work || !description) continue
          const amount = money(value(row, map, 'valor'))
          const order = this.db.save('pedidos_compra', { obra_id: work.id, frente_id: front?.id || null, fornecedor_id: supplier?.id || null, descricao: description, valor_centavos: amount, entrega_prevista: date(value(row, map, 'vencimento')), status: String(value(row, map, 'status') || 'emitido') })
          this.db.save('pedido_compra_itens', { pedido_compra_id: order.id, descricao: description, unidade: String(value(row, map, 'unidade') || 'un'), quantidade_pedida: Number(value(row, map, 'quantidade') || 1), valor_centavos: amount })
          entity = order
        } else if (area === 'contratos') {
          const work = workByName(value(row, map, 'obra'))
          const front = frontByName(work, value(row, map, 'frente'))
          const client = findOrCreate('clientes', 'nome', String(value(row, map, 'cliente') || '').trim(), { nome: String(value(row, map, 'cliente') || '').trim(), status: 'ativo' })
          const supplier = findOrCreate('fornecedores', 'nome', String(value(row, map, 'fornecedor') || '').trim(), { nome: String(value(row, map, 'fornecedor') || '').trim(), status: 'ativo' })
          const description = String(value(row, map, 'descricao') || '').trim()
          if (!work || !description) continue
          entity = this.db.save('contratos_obra', { obra_id: work.id, frente_id: front?.id || null, cliente_id: client?.id || null, fornecedor_id: supplier?.id || null, numero: String(value(row, map, 'numero') || ''), tipo: String(value(row, map, 'tipo') || 'principal'), descricao: description, valor_centavos: money(value(row, map, 'valor')), retencao_centavos: money(value(row, map, 'retencao')), garantia: String(value(row, map, 'garantia') || ''), data_inicio: date(value(row, map, 'data_inicio')), data_fim: date(value(row, map, 'data_fim')), status: String(value(row, map, 'status') || 'ativo') })
        } else if (area === 'aditivos') {
          const contract = contractByNumber(value(row, map, 'contrato'))
          if (!contract) continue
          entity = this.db.save('contrato_aditivos', { contrato_id: contract.id, numero: String(value(row, map, 'numero') || ''), descricao: String(value(row, map, 'descricao') || '').trim(), valor_centavos: money(value(row, map, 'valor')), data: date(value(row, map, 'data')), status: String(value(row, map, 'status') || 'solicitado'), impacto_prazo_dias: Number(value(row, map, 'impacto_prazo_dias') || 0) })
        } else if (area === 'medicoes') {
          const work = workByName(value(row, map, 'obra'))
          const front = frontByName(work, value(row, map, 'frente'))
          const contract = contractByNumber(value(row, map, 'contrato'))
          if (!work) continue
          const amount = money(value(row, map, 'valor'))
          const ret = money(value(row, map, 'retencao'))
          const disc = money(value(row, map, 'desconto'))
          entity = this.db.save('medicoes', { obra_id: work.id, frente_id: front?.id || null, contrato_id: contract?.id || null, numero: String(value(row, map, 'numero') || `IMP-${index + 1}`), competencia: competence(value(row, map, 'competencia')), data: date(value(row, map, 'data')) || new Date().toISOString().slice(0, 10), periodo_inicio: date(value(row, map, 'periodo_inicio')), periodo_fim: date(value(row, map, 'periodo_fim')), status: String(value(row, map, 'status') || 'rascunho'), descricao: String(value(row, map, 'descricao') || ''), valor_bruto_centavos: amount, retencoes_centavos: ret, descontos_centavos: disc, valor_liquido_centavos: Math.max(0, amount - ret - disc) })
        } else if (area === 'ponto') {
          const employee = findOrCreate('funcionarios', 'nome', String(value(row, map, 'funcionario') || '').trim(), { empresa_id: company.id, nome: String(value(row, map, 'funcionario') || '').trim(), status: 'ativo' })
          if (!employee) continue
          let month = this.db.db.prepare('SELECT * FROM pontos_mensais WHERE funcionario_id=? AND competencia=?').get(employee.id, competence(value(row, map, 'competencia')))
          if (!month) month = this.db.save('pontos_mensais', { funcionario_id: employee.id, competencia: competence(value(row, map, 'competencia')), status: 'aberto' })
          entity = this.db.save('ponto_marcacoes', { ponto_mensal_id: month.id, data: date(value(row, map, 'data')) || `${month.competencia}-01`, tipo: 'trabalho', entrada: String(value(row, map, 'entrada') || ''), saida: String(value(row, map, 'saida') || ''), observacoes: String(value(row, map, 'observacoes') || '') })
        } else if (area === 'documentos') {
          const work = workByName(value(row, map, 'obra'))
          const front = frontByName(work, value(row, map, 'frente'))
          const employee = findOrCreate('funcionarios', 'nome', String(value(row, map, 'funcionario') || '').trim(), { empresa_id: company.id, nome: String(value(row, map, 'funcionario') || '').trim(), status: 'ativo' })
          entity = this.db.save('documentos', { empresa_id: company.id, obra_id: work?.id || null, frente_id: front?.id || null, funcionario_id: employee?.id || null, categoria: String(value(row, map, 'categoria') || 'documento_importado'), titulo: String(value(row, map, 'titulo') || 'Documento importado'), vencimento: date(value(row, map, 'vencimento')), observacoes: String(value(row, map, 'observacoes') || ''), status_assinatura: 'geral', versao: 1 })
        } else if (area === 'estoque') {
          const work = workByName(value(row, map, 'obra'))
          const front = frontByName(work, value(row, map, 'frente'))
          if (!work) continue
          entity = this.db.save('movimentacoes_estoque', { obra_id: work.id, frente_id: front?.id || null, descricao: String(value(row, map, 'descricao') || '').trim(), unidade: String(value(row, map, 'unidade') || 'un'), quantidade: Number(value(row, map, 'quantidade') || 0), tipo: String(value(row, map, 'tipo') || 'entrada'), data: date(value(row, map, 'data')) || new Date().toISOString().slice(0, 10), observacoes: String(value(row, map, 'observacoes') || '') })
        }
        if (entity) {
          count++
          raw.run(imported.id, area === 'financeiro' ? competence(value(row, map, 'competencia')) : null, `${sheet.name}!${index + sheet.headerIndex + 2}`, area, String(value(row, map, 'descricao') || value(row, map, 'nome') || value(row, map, 'titulo') || ''), money(value(row, map, 'valor')), JSON.stringify(row), area, entity.id, 'importado')
        }
      }
      this.db.db.prepare("UPDATE importacoes SET status='concluida',resumo=?,concluida_em=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify({ area, linhas: count, cadastros_criados: created }), imported.id)
      this.pending.delete(token)
      return { importacao_id: imported.id, area, imported: count, created }
    })()
  }
}

module.exports = { UniversalImportService, AREAS, mapping, detect, norm, money, date }
