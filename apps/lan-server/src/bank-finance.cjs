'use strict'

const { createHash } = require('node:crypto')
const { BankP0Service } = require('./bank-p0.cjs')
const { BankP2Service } = require('./bank-p2.cjs')

const MAX_BYTES = 4 * 1024 * 1024
const MAX_TRANSACTIONS = 10000
const sha = value => createHash('sha256').update(value).digest('hex')
const numberId = (value, label) => {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(label + ' inválido.')
  return id
}
const dateISO = (value) => {
  const raw = String(value || '').trim()
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    match = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
    if (match) match = [raw, match[3], match[2], match[1]]
  }
  if (!match) {
    match = raw.match(/^(\d{4})(\d{2})(\d{2})/)
  }
  if (!match) throw new Error('Data inválida: ' + raw)
  const [year, month, day] = match.slice(1).map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) {
    throw new Error('Data inválida: ' + raw)
  }
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
}
const moneyCents = (value) => {
  let input = String(value ?? '').trim().replace(/R\$/gi, '').replace(/\s/g, '')
  const negative = input.startsWith('-') || (input.startsWith('(') && input.endsWith(')'))
  input = input.replace(/^[-+(]/, '').replace(/\)$/, '')
  if (!/^\d[\d.,]*$/.test(input)) throw new Error('Valor inválido: ' + String(value))
  const point = input.lastIndexOf('.')
  const comma = input.lastIndexOf(',')
  const index = Math.max(point, comma)
  const fractionalDigits = index >= 0 ? input.length - index - 1 : 0
  const decimal = index >= 0 && fractionalDigits <= 2
  const whole = (decimal ? input.slice(0, index) : input).replace(/[.,]/g, '')
  const fraction = decimal ? input.slice(index + 1).padEnd(2, '0') : '00'
  if (!/^\d+$/.test(whole) || !/^\d{2}$/.test(fraction)) throw new Error('Valor inválido: ' + String(value))
  const cents = Number(whole) * 100 + Number(fraction)
  if (!Number.isSafeInteger(cents)) throw new Error('Valor excede o limite permitido.')
  return negative ? -cents : cents
}
const normalized = (text) => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const decode = (bytes) => {
  const utf = bytes.toString('utf8').replace(/^\uFEFF/, '')
  return utf.includes('\uFFFD') ? bytes.toString('latin1').replace(/^\uFEFF/, '') : utf
}
const unescapeXml = text => String(text || '').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
const ofxField = (block, tag) => {
  const match = block.match(new RegExp('<' + tag + '>([^\\r\\n<]*)', 'i'))
  return unescapeXml(match?.[1] || '').trim()
}
const csvRows = (content, delimiter) => {
  const rows = []
  let row = [], value = '', quoted = false
  for (let i = 0; i < content.length; i++) {
    const c = content[i]
    if (quoted && c === '"' && content[i + 1] === '"') { value += '"'; i++; continue }
    if (c === '"') { quoted = !quoted; continue }
    if (c === delimiter && !quoted) { row.push(value.trim()); value = ''; continue }
    if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && content[i + 1] === '\n') i++
      row.push(value.trim()); value = ''
      if (row.some(cell => cell !== '')) rows.push(row)
      row = []
      continue
    }
    value += c
  }
  if (quoted) throw new Error('CSV possui aspas não fechadas.')
  row.push(value.trim())
  if (row.some(cell => cell !== '')) rows.push(row)
  return rows
}
const detectDelimiter = line => {
  const counts = [';', '\t', ','].map(d => ({ d, size: csvRows(line, d)[0]?.length || 0 }))
  counts.sort((a, b) => b.size - a.size)
  return counts[0].size > 1 ? counts[0].d : ';'
}
const pickIndex = (headers, candidates) => headers.findIndex(label => candidates.includes(normalized(label)))
const csvMapping = (headers, supplied = {}) => {
  const aliases = {
    date: ['data', 'date', 'data movimento', 'data lancamento', 'dt', 'dtposted'],
    description: ['descricao', 'historico', 'detalhes', 'description', 'memo', 'lancamento', 'nome'],
    amount: ['valor', 'amount', 'valor r$', 'vlr', 'montante'],
    credit: ['entrada', 'credito', 'creditos', 'valor credito', 'recebimento'],
    debit: ['saida', 'debito', 'debitos', 'valor debito', 'pagamento'],
    id: ['id', 'fitid', 'identificador', 'codigo transacao', 'numero transacao']
  }
  const out = {}
  for (const key of Object.keys(aliases)) {
    const override = supplied[key]
    if (override !== undefined && override !== null && override !== '') {
      const index = Number(override)
      if (!Number.isInteger(index) || index < 0 || index >= headers.length) throw new Error('Coluna do CSV inválida: ' + key)
      out[key] = index
    } else out[key] = pickIndex(headers, aliases[key])
  }
  if (out.date < 0 || out.description < 0 || (out.amount < 0 && (out.credit < 0 || out.debit < 0))) {
    throw new Error('Mapeie as colunas de data, descrição e valor (ou entrada e saída) antes de importar.')
  }
  return out
}
const parseCSV = (content, supplied = {}) => {
  const firstLine = content.split(/\r?\n/).find(line => line.trim()) || ''
  const delimiter = [';', ',', '\t'].includes(supplied.delimiter) ? supplied.delimiter : detectDelimiter(firstLine)
  const rows = csvRows(content, delimiter)
  if (rows.length < 2) throw new Error('O CSV precisa conter cabeçalho e movimentações.')
  const headers = rows.shift()
  const mapping = csvMapping(headers, supplied)
  const parsed = [], invalid = []
  rows.forEach((cells, i) => {
    try {
      const at = key => mapping[key] >= 0 ? String(cells[mapping[key]] || '').trim() : ''
      const date = dateISO(at('date'))
      const description = at('description').replace(/\s+/g, ' ').trim()
      if (!description) throw new Error('Descrição vazia.')
      const amount = mapping.amount >= 0 ? moneyCents(at('amount')) : moneyCents(at('credit') || '0') - moneyCents(at('debit') || '0')
      if (!amount) throw new Error('Valor zero.')
      parsed.push({ date, description, amountCents: amount, fitid: at('id'), line: i + 2 })
    } catch (error) { invalid.push({ line: i + 2, reason: error.message }) }
  })
  return { rows: parsed, invalid, headers, mapping: { ...mapping, delimiter }, total: rows.length }
}
const parseOFX = (content) => {
  const parsed = [], invalid = []
  const matches = [...content.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi)]
  if (!matches.length) throw new Error('OFX sem movimentações STMTTRN.')
  matches.forEach((match, i) => {
    const block = match[1]
    try {
      const date = dateISO(ofxField(block, 'DTPOSTED'))
      const description = (ofxField(block, 'MEMO') || ofxField(block, 'NAME') || ofxField(block, 'TRNTYPE')).replace(/\s+/g, ' ').trim()
      if (!description) throw new Error('Descrição vazia.')
      const amount = moneyCents(ofxField(block, 'TRNAMT'))
      if (!amount) throw new Error('Valor zero.')
      parsed.push({ date, description, amountCents: amount, fitid: ofxField(block, 'FITID'), line: i + 1 })
    } catch (error) { invalid.push({ line: i + 1, reason: error.message }) }
  })
  return { rows: parsed, invalid, headers: [], mapping: {}, total: matches.length }
}
function assignKeys(rows) {
  const seen = new Map()
  return rows.map(row => {
    const base = [row.date, row.amountCents, normalized(row.description)].join('|')
    const ordinal = (seen.get(base) || 0) + 1
    seen.set(base, ordinal)
    const key = row.fitid ? 'fitid:' + normalized(row.fitid) : 'fingerprint:' + sha(base + '|' + ordinal)
    return { ...row, key }
  })
}
function parseFile({ format, content, mapping = {} }) {
  const parsed = format === 'ofx' ? parseOFX(content) : format === 'csv' ? parseCSV(content, mapping) : null
  if (!parsed) throw new Error('Use um arquivo OFX ou CSV.')
  if (parsed.total > MAX_TRANSACTIONS) throw new Error('Extrato excede 10.000 linhas.')
  if (parsed.rows.length === 0) throw new Error('Extrato sem lançamentos válidos.')
  return { ...parsed, rows: assignKeys(parsed.rows) }
}
class BankFinanceService {
  constructor({ db }) {
    if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') throw new Error('Banco financeiro indisponível.')
    this.db = db
    this.p0 = new BankP0Service({ db })
    this.p2 = new BankP2Service({ db, p0:this.p0 })
  }
  company(empresaId) {
    const id = numberId(empresaId, 'Empresa')
    const company = this.db.prepare('SELECT id FROM empresas WHERE id=? AND deleted_at IS NULL').get(id)
    if (!company) throw new Error('Empresa não encontrada.')
    return id
  }
  account(empresaId, bankId) {
    const id = this.company(empresaId)
    const account = this.db.prepare('SELECT * FROM contas_bancarias WHERE id=? AND empresa_id=? AND deleted_at IS NULL').get(numberId(bankId, 'Conta bancária'), id)
    if (!account) throw new Error('Conta bancária não encontrada nesta empresa.')
    return account
  }
  listAccounts({ empresaId }) {
    const id = this.company(empresaId)
    return this.db.prepare('SELECT id,empresa_id,nome,banco_nome,agencia,conta_identificador,tipo_conta,saldo_inicial_centavos,saldo_referencia_data,ativo,created_at FROM contas_bancarias WHERE empresa_id=? AND deleted_at IS NULL ORDER BY ativo DESC,nome COLLATE NOCASE,id').all(id)
  }
  saveAccount(payload) {
    const empresaId = this.company(payload.empresaId)
    const nome = String(payload.nome || '').trim()
    const banco = String(payload.bancoNome || '').trim()
    if (nome.length < 2 || nome.length > 120 || banco.length < 2 || banco.length > 120) throw new Error('Informe nome da conta e banco com pelo menos 2 caracteres.')
    const tipo = String(payload.tipoConta || 'corrente')
    if (!['corrente', 'poupanca', 'pagamento', 'outra'].includes(tipo)) throw new Error('Tipo de conta inválido.')
    const saldo = Number(payload.saldoInicialCentavos || 0)
    if (!Number.isSafeInteger(saldo)) throw new Error('Saldo inicial inválido.')
    const data = dateISO(payload.saldoReferenciaData)
    const agencia = String(payload.agencia || '').slice(0, 60)
    const identificador = String(payload.contaIdentificador || '').slice(0, 80)
    if (payload.id) {
      const existing = this.account(empresaId, payload.id)
      const hasImports = this.db.prepare('SELECT id FROM extrato_importacoes WHERE conta_bancaria_id=? LIMIT 1').get(existing.id)
      if (hasImports && (saldo !== existing.saldo_inicial_centavos || data !== existing.saldo_referencia_data)) throw new Error('Saldo inicial e data não podem mudar depois da primeira importação.')
      if(saldo !== existing.saldo_inicial_centavos || data !== existing.saldo_referencia_data) this.p2.assertBalanceReference(empresaId,data < existing.saldo_referencia_data ? data : existing.saldo_referencia_data)
      this.db.prepare('UPDATE contas_bancarias SET nome=?,banco_nome=?,agencia=?,conta_identificador=?,tipo_conta=?,saldo_inicial_centavos=?,saldo_referencia_data=?,ativo=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND empresa_id=?').run(nome,banco,agencia,identificador,tipo,saldo,data,payload.ativo === undefined ? existing.ativo : payload.ativo === false ? 0 : 1,existing.id,empresaId)
      return this.account(empresaId, existing.id)
    }
    const requestId = String(payload.requestId || '').trim()
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new Error('Identificador de operação inválido.')
    const previous = this.db.prepare('SELECT * FROM contas_bancarias WHERE request_id=?').get(requestId)
    if (previous) {
      if (previous.empresa_id !== empresaId) throw new Error('Identificador já utilizado por outra empresa.')
      return previous
    }
    this.p2.assertBalanceReference(empresaId,data)
    this.db.prepare('INSERT INTO contas_bancarias(empresa_id,nome,banco_nome,agencia,conta_identificador,tipo_conta,saldo_inicial_centavos,saldo_referencia_data,ativo,request_id) VALUES (?,?,?,?,?,?,?,?,1,?)').run(empresaId,nome,banco,agencia,identificador,tipo,saldo,data,requestId)
    return this.db.prepare('SELECT * FROM contas_bancarias WHERE request_id=?').get(requestId)
  }
  // Saldo absoluto ao fim do dia. Nunca gravar como transação: importações
  // posteriores podem conter as mesmas datas e continuariam reconciliáveis.
  listManualBalances({ empresaId, contaBancariaId }) {
    const account=this.account(empresaId,contaBancariaId)
    return this.db.prepare('SELECT id,empresa_id,conta_bancaria_id,data,saldo_centavos,justificativa,created_by,created_at FROM finance_bank_manual_balances WHERE empresa_id=? AND conta_bancaria_id=? ORDER BY data DESC,id DESC LIMIT 100').all(account.empresa_id,account.id)
  }
  recordManualBalance(payload) {
    const bank=this.account(payload.empresaId,payload.contaBancariaId)
    if(!bank.ativo)throw Error('Ative a conta bancária para informar o saldo.')
    const data=dateISO(payload.data)
    if(data<bank.saldo_referencia_data)throw Error('A data do saldo manual não pode anteceder o saldo inicial da conta.')
    const saldo=Number(payload.saldoCentavos)
    if(!Number.isSafeInteger(saldo))throw Error('Saldo manual inválido.')
    const justificativa=String(payload.justificativa||'').trim()
    if(justificativa.length<8||justificativa.length>500)throw Error('Informe justificativa entre 8 e 500 caracteres.')
    const actor=String(payload.actorId||'').trim()
    if(actor.length<2||actor.length>120)throw Error('Responsável inválido.')
    const request=String(payload.requestId||'').trim()
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(request))throw Error('Identificador de operação inválido.')
    const hash=sha(JSON.stringify([bank.empresa_id,bank.id,data,saldo,justificativa]))
    const db=this.db
    db.exec('BEGIN IMMEDIATE')
    try{
      const old=db.prepare('SELECT * FROM finance_bank_manual_balances WHERE request_id=?').get(request)
      if(old){
        if(old.request_hash!==hash)throw Error('Identificador de operação reutilizado com dados diferentes.')
        db.exec('COMMIT')
        return old
      }
      this.p2.assertBalanceReference(bank.empresa_id,data)
      db.prepare('INSERT INTO finance_bank_manual_balances(empresa_id,conta_bancaria_id,data,saldo_centavos,justificativa,created_by,request_id,request_hash) VALUES (?,?,?,?,?,?,?,?)').run(bank.empresa_id,bank.id,data,saldo,justificativa,actor,request,hash)
      const saved=db.prepare('SELECT * FROM finance_bank_manual_balances WHERE request_id=?').get(request)
      db.exec('COMMIT')
      return saved
    }catch(error){db.exec('ROLLBACK');throw error}
  }
  bankInput(payload) {
    const account = this.account(payload.empresaId, payload.contaBancariaId)
    if (!account.ativo) throw new Error('Ative a conta bancária antes de importar.')
    const name = String(payload.fileName || '').trim().slice(0, 200)
    const format = String(payload.format || name.split('.').pop() || '').toLowerCase()
    if (!['ofx', 'csv'].includes(format)) throw new Error('Selecione um arquivo OFX ou CSV.')
    const base64 = String(payload.contentBase64 || '')
    if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) throw new Error('Arquivo inválido.')
    const bytes = Buffer.from(base64, 'base64')
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('O arquivo deve ter até 4 MB.')
    const fileHash = sha(bytes)
    const mapping = payload.mapping && typeof payload.mapping === 'object' && !Array.isArray(payload.mapping) ? payload.mapping : {}
    const parsed = parseFile({ format, content: decode(bytes), mapping })
    const previewHash = sha([account.id, account.empresa_id, format, fileHash, JSON.stringify(parsed.mapping)].join('|'))
    return { account, name, format, fileHash, previewHash, parsed }
  }
  inspect(payload) {
    const input = this.bankInput(payload)
    const existingImport = this.db.prepare('SELECT id,created_at FROM extrato_importacoes WHERE conta_bancaria_id=? AND arquivo_sha256=?').get(input.account.id,input.fileHash)
    const latestManual = this.db.prepare('SELECT data FROM finance_bank_manual_balances WHERE empresa_id=? AND conta_bancaria_id=? ORDER BY data DESC,id DESC LIMIT 1').get(input.account.empresa_id,input.account.id)
    const seen = new Set(), preview = []
    let duplicateCount = 0, importableCount = 0
    for (const row of input.parsed.rows) {
      const duplicatedInFile = seen.has(row.key)
      seen.add(row.key)
      const found = this.db.prepare('SELECT id FROM transacoes_bancarias WHERE conta_bancaria_id=? AND chave_transacao=?').get(input.account.id,row.key)
      const duplicate = !!existingImport || duplicatedInFile || !!found
      if (duplicate) duplicateCount++
      else importableCount++
      if (preview.length < 150) preview.push({ ...row, duplicate })
    }
    return {
      fileName: input.name, format: input.format, previewHash: input.previewHash,
      duplicatedFile: !!existingImport, previousImportId: existingImport?.id || null,
      headers: input.parsed.headers, mapping: input.parsed.mapping,
      total: input.parsed.total, importable: importableCount, duplicates: duplicateCount,
      coveredByManualBalance: latestManual ? input.parsed.rows.filter(row=>row.date<=latestManual.data).length : 0,
      manualBalanceDate: latestManual?.data || null,
      invalid: input.parsed.invalid.length, invalidRows: input.parsed.invalid.slice(0, 40), preview
    }
  }
  previewImport(payload) { return this.inspect(payload) }
  confirmImport(payload) {
    const input = this.bankInput(payload)
    if (!payload.previewHash || payload.previewHash !== input.previewHash) throw new Error('Arquivo ou mapeamento mudou. Revise novamente a prévia.')
    if (input.parsed.invalid.length && payload.acceptInvalid !== true) throw new Error('Revise as linhas inválidas ou confirme explicitamente a importação parcial.')
    const db = this.db
    db.exec('BEGIN IMMEDIATE')
    try {
      const old = db.prepare('SELECT * FROM extrato_importacoes WHERE conta_bancaria_id=? AND arquivo_sha256=?').get(input.account.id,input.fileHash)
      if (old) { db.exec('COMMIT'); return { duplicateFile: true, importId: old.id, imported: 0, duplicates: input.parsed.rows.length, rejected: input.parsed.invalid.length } }
      for(const transaction of input.parsed.rows) this.p2.assertOpen(input.account.empresa_id,transaction.date)
      const ins = db.prepare('INSERT INTO extrato_importacoes(empresa_id,conta_bancaria_id,nome_arquivo,formato,arquivo_sha256,mapeamento_json,total_linhas,importadas,duplicadas,rejeitadas) VALUES (?,?,?,?,?,?,?,?,?,?)').run(input.account.empresa_id,input.account.id,input.name,input.format,input.fileHash,JSON.stringify(input.parsed.mapping),input.parsed.total,0,0,input.parsed.invalid.length)
      const importId = Number(ins.lastInsertRowid)
      const has = db.prepare('SELECT id FROM transacoes_bancarias WHERE conta_bancaria_id=? AND chave_transacao=?')
      const save = db.prepare('INSERT INTO transacoes_bancarias(empresa_id,conta_bancaria_id,importacao_id,chave_transacao,data,descricao,valor_centavos,origem_identificador,origem_linha) VALUES (?,?,?,?,?,?,?,?,?)')
      let imported = 0, duplicates = 0
      const local = new Set()
      for (const tx of input.parsed.rows) {
        if (local.has(tx.key) || has.get(input.account.id,tx.key)) { duplicates++; continue }
        local.add(tx.key)
        save.run(input.account.empresa_id,input.account.id,importId,tx.key,tx.date,tx.description,tx.amountCents,tx.fitid || null,tx.line)
        imported++
      }
      db.prepare('UPDATE extrato_importacoes SET importadas=?,duplicadas=? WHERE id=?').run(imported,duplicates,importId)
      db.exec('COMMIT')
      return { duplicateFile: false, importId, imported, duplicates, rejected: input.parsed.invalid.length }
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
  listImports({ empresaId, contaBancariaId }) {
    const a = this.account(empresaId, contaBancariaId)
    return this.db.prepare('SELECT id,nome_arquivo,formato,total_linhas,importadas,duplicadas,rejeitadas,created_at FROM extrato_importacoes WHERE empresa_id=? AND conta_bancaria_id=? ORDER BY id DESC LIMIT 100').all(a.empresa_id,a.id)
  }
  suggestReconciliation(payload) { return this.p0.suggestReconciliation(payload) }
  confirmReconciliation(payload) {
    const item=this.p0.movement(payload.empresaId,payload.contaBancariaId,payload.transacaoId)
    this.p2.assertOpen(item.bank.empresa_id,item.transaction.data)
    return this.p0.confirmReconciliation(payload)
  }
  reverseReconciliation(payload) {
    const batch=this.p0.reconciliationById(payload.loteId)
    const item=this.p0.movement(payload.empresaId,batch.contaBancariaId,batch.transacaoId)
    this.p2.assertOpen(item.bank.empresa_id,item.transaction.data)
    return this.p0.reverseReconciliation(payload)
  }
  listReconciliations(payload) { return this.p0.listReconciliations(payload) }
  cashFlow(payload) { return this.p0.cashFlow(payload) }
  listWorks(payload) { return this.p0.listWorks(payload) }
  listPlannedAccounts(payload) { return this.p0.listPlannedAccounts(payload) }
  assignPlannedBank(payload) { return this.p0.assignPlannedBank(payload) }
  auditPeriod(payload) { return this.p2.auditPeriod(payload) }
  closePeriod(payload) { return this.p2.closePeriod(payload) }
  reopenPeriod(payload) { return this.p2.reopenPeriod(payload) }
  periodStatus(payload) { return this.p2.periodStatus(payload) }
  periodEvents(payload) { return this.p2.periodEvents(payload) }
  simulateCashFlow(payload) { return this.p2.simulateCashFlow(payload) }
  cashReport(payload) { return this.p2.cashReport(payload) }
  captureForecast(payload) { return this.p2.captureForecast(payload) }
  listForecasts(payload) { return this.p2.listForecasts(payload) }
  listTransactions({ empresaId, contaBancariaId, obraId, status='all', startDate, endDate, search='', limit=500, offset=0 }) {
    const a = this.account(empresaId, contaBancariaId)
    const pageSize=Number(limit),skip=Number(offset)
    if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>500)throw Error('Limite por página inválido (1–500).')
    if(!Number.isSafeInteger(skip)||skip<0||skip>1000000)throw Error('Deslocamento de página inválido.')
    if (!['all','pending','partial','reconciled'].includes(String(status))) throw new Error('Situação de conciliação inválida.')
    const clauses=['t.empresa_id=?','t.conta_bancaria_id=?']
    const params=[a.empresa_id,a.id]
    if (startDate) { clauses.push('t.data>=?');params.push(dateISO(startDate)) }
    if (endDate) { clauses.push('t.data<=?');params.push(dateISO(endDate)) }
    if (search) { clauses.push('LOWER(t.descricao) LIKE ?');params.push('%'+String(search).toLowerCase().slice(0,100)+'%') }
    if (obraId!==undefined && obraId!==null && obraId!=='') {
      const validWork=this.p0.work(a.empresa_id,obraId)
      clauses.push("EXISTS (SELECT 1 FROM reconciliacao_lotes l JOIN reconciliacao_alocacoes al ON al.lote_id=l.id JOIN pagamentos_conta p ON p.id=al.pagamento_id JOIN contas c ON c.id=p.conta_id WHERE l.transacao_bancaria_id=t.id AND l.status='active' AND c.empresa_id=? AND c.obra_id=? AND c.deleted_at IS NULL)")
      params.push(a.empresa_id,validWork)
    }
    const sql="SELECT * FROM (SELECT t.id,t.data,t.descricao,t.valor_centavos,t.origem_identificador,t.importacao_id,t.created_at,COALESCE((SELECT SUM(x.valor_centavos) FROM reconciliacao_alocacoes x JOIN reconciliacao_lotes l ON l.id=x.lote_id WHERE l.transacao_bancaria_id=t.id AND l.status='active'),0) conciliado_centavos FROM transacoes_bancarias t WHERE "+clauses.join(' AND ')+") q"+
      (status==='pending'?" WHERE q.conciliado_centavos=0":status==='partial'?" WHERE q.conciliado_centavos>0 AND q.conciliado_centavos<ABS(q.valor_centavos)":status==='reconciled'?" WHERE q.conciliado_centavos>=ABS(q.valor_centavos)":"")+
      " ORDER BY q.data DESC,q.id DESC LIMIT ? OFFSET ?"
    return this.db.prepare(sql).all(...params,pageSize,skip)
  }
}
module.exports = { BankFinanceService, parseFile, moneyCents, dateISO, csvMapping }