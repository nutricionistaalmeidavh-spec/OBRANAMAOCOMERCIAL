const fs = require('node:fs')
const path = require('node:path')
const { BrowserWindow } = require('electron')
const { PDFDocument } = require('pdf-lib')
const { sanitizeName, sha256 } = require('./file-service.cjs')
const { ADMISSION_DOCUMENTS } = require('./admission-documents.cjs')
const { renderCommercialAdmissionTemplate, employeeAddress } = require('./commercial-admission-templates.cjs')
const { buildAdmissionPlan, validateAdmissionDocuments, admissionDocumentFilename } = require('./admission-policy.cjs')
const { AdmissionConfigService } = require('./admission-config-service.cjs')

const DOCS = ADMISSION_DOCUMENTS
const RELEASE_NAME = 'Commercial Admission Docs v2'
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))
const money = (cents) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format((Number(cents) || 0) / 100)
const dateBR = (iso) => iso ? String(iso).split('-').reverse().join('/') : '____/____/________'

function base(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#111;font-size:10pt}h1{text-align:center;font-size:15pt}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`
}

function customValues(employee, company) {
  return {
    nome_funcionario: employee.nome || '', cpf: employee.cpf || '', rg: employee.rg || '', rg_emissao: dateBR(employee.rg_emissao), rg_orgao: employee.rg_orgao || '',
    ctps: employee.ctps || '', ctps_serie: employee.ctps_serie || '', ctps_uf: employee.ctps_uf || '', ctps_expedicao: dateBR(employee.ctps_expedicao), pis: employee.pis || '',
    cargo: employee.cargo_nome || '', cbo: employee.cbo || '', admissao: dateBR(employee.admissao), salario: money(employee.salario_centavos),
    matricula: employee.matricula || '', matricula_esocial: employee.matricula_esocial || '', fgts_opcao_em: dateBR(employee.fgts_opcao_em),
    endereco_funcionario: employeeAddress(employee), endereco_logradouro: employee.endereco_logradouro || '', endereco_numero: employee.endereco_numero || '',
    endereco_complemento: employee.endereco_complemento || '', endereco_bairro: employee.endereco_bairro || '', endereco_cidade: employee.endereco_cidade || '', endereco_uf: employee.endereco_uf || '', cep: employee.cep || '',
    empresa: company?.razao_social || company?.nome_fantasia || '', cnpj: company?.cnpj || '', endereco_empresa: company?.endereco || '', data_hoje: dateBR(new Date().toISOString().slice(0,10))
  }
}

function sanitizeTemplateHtml(content) {
  return String(content || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|base)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
}

function renderCustom(content, employee, company, title) {
  const values = customValues(employee, company)
  const manual = (label) => `<span style="display:inline-block;min-width:145px;padding:2px 5px;border:1px dashed #8a6500;background:#fff7c7;color:#5d4500;font-weight:700">PREENCHER: ${esc(label)}</span>`
  const replaced = sanitizeTemplateHtml(content)
    .replace(/\{\{manual:([^}]+)\}\}/gi, (_match, label) => manual(String(label).trim() || 'campo'))
    .replace(/\{\{([a-z_]+)\}\}/gi, (_match, key) => values[key.toLowerCase()] ? esc(values[key.toLowerCase()]) : manual(key.replaceAll('_', ' ')))
  return /<html/i.test(replaced) ? replaced : base(title, replaced)
}

function readLocalTemplate(filePath) {
  const resolved = path.resolve(String(filePath || ''))
  const extension = path.extname(resolved).toLowerCase()
  if (!['.html','.htm','.txt'].includes(extension)) throw new Error('Escolha um modelo HTML, HTM ou TXT.')
  const stat = fs.statSync(resolved)
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('O modelo deve ser um arquivo de até 2 MB.')
  const source = fs.readFileSync(resolved, 'utf8')
  if (!source.trim()) throw new Error('O arquivo de modelo está vazio.')
  return { nome:path.basename(resolved, extension), conteudo_html:extension === '.txt' ? `<pre>${esc(source)}</pre>` : sanitizeTemplateHtml(source), arquivo_origem:resolved }
}

function admissionFolders(fileService, employee, companyName) {
  const identity = `funcionario-${Number(employee.id) || 'novo'}`
  const date = sanitizeName(employee.admissao || new Date().toISOString().slice(0,10))
  const root = path.join(fileService.documentsDir, sanitizeName(companyName || 'Empresa'), 'Funcionários', identity, sanitizeName(employee.nome || 'Colaborador'), 'Admissão', date)
  const folders = { base:root, unsigned:path.join(root,'Não assinados'), signed:path.join(root,'Assinados'), general:path.join(root,'Documentação Geral') }
  for (const folder of Object.values(folders)) fs.mkdirSync(folder,{recursive:true})
  return folders
}

function parseProfileConfig(row) {
  if (row?.configuracao && typeof row.configuracao === 'object') return row.configuracao
  if (!row?.configuracao_json) return {}
  try { return JSON.parse(row.configuracao_json) || {} } catch { return {} }
}

class DocumentService {
  constructor({ db, fileService, dialog }) {
    this.db = db
    this.fileService = fileService
    this.dialog = dialog
    this.admissionConfig = new AdmissionConfigService({ db })
  }

  async printHtml(html, destination) {
    const win = new BrowserWindow({ show:false, webPreferences:{ sandbox:true, contextIsolation:true, nodeIntegration:false } })
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdf = await win.webContents.printToPDF({ pageSize:'A4', printBackground:true, margins:{ marginType:'none' } })
      fs.writeFileSync(destination, pdf)
    } finally { win.destroy() }
  }

  getReleaseState() {
    const row = this.db.db.prepare("SELECT valor FROM configuracoes WHERE chave='commercial_admission_docs_version'").get()
    return { name:RELEASE_NAME, version:row?.valor || '2', state:'active', rollback:'Modelos personalizados anteriores permanecem cadastrados; Livro de Registro fica apenas inativo por compatibilidade histórica.' }
  }

  listTemplates() {
    const selected = new Map(this.db.db.prepare("SELECT chave,valor FROM configuracoes WHERE chave LIKE 'modelo_rh:%'").all().map(row => [row.chave.replace('modelo_rh:',''), row.valor]))
    const custom = this.db.list('modelos_documento_rh').filter(item => DOCS.some(doc => doc.key === item.chave)).map(item => ({ ...item, origem:'personalizado', selecionado:String(selected.get(item.chave) || '') === String(item.id) }))
    const defaults = DOCS.map(doc => ({ id:`padrao:${doc.key}`, chave:doc.key, nome:`${doc.title} (padrão comercial v2)`, ativo:1, origem:'padrao', selecionado:!selected.get(doc.key) || selected.get(doc.key) === `padrao:${doc.key}`, campos:Object.keys(customValues({},{})) }))
    const companyProfiles = this.db.db.prepare(`SELECT p.*,e.razao_social,e.nome_fantasia FROM empresa_documentos_admissionais p JOIN empresas e ON e.id=p.empresa_id ORDER BY e.razao_social,p.documento_key`).all().map(row => ({ ...row, configuracao:parseProfileConfig(row) }))
    const epiKits = this.db.db.prepare(`SELECT k.*,e.nome epi_nome,e.ca,c.nome cargo_nome,em.razao_social,em.nome_fantasia FROM cargo_epi_kits k JOIN epis e ON e.id=k.epi_id JOIN cargos c ON c.id=k.cargo_id JOIN empresas em ON em.id=k.empresa_id WHERE k.ativo=1 ORDER BY em.razao_social,c.nome,e.nome`).all()
    return { templates:[...defaults,...custom], companyProfiles, epiKits, documents:DOCS, release:this.getReleaseState() }
  }

  saveTemplate(data) {
    if (data?.kind === 'company-profile') return this.admissionConfig.saveDocumentProfile(data)
    if (data?.kind === 'epi-kit') return this.admissionConfig.saveEpiKit(data)
    if (data?.kind === 'epi-kit-remove') return this.admissionConfig.removeEpiKit(data)
    if (!DOCS.some(doc => doc.key === data.chave)) throw new Error('Modelo de documento inválido.')
    if (!String(data.nome || '').trim() || !String(data.conteudo_html || '').trim()) throw new Error('Informe nome e conteúdo do modelo.')
    return this.db.save('modelos_documento_rh', { ...data, nome:String(data.nome).trim(), conteudo_html:String(data.conteudo_html), ativo:data.ativo === false ? 0 : 1 })
  }

  async chooseLocalTemplate() {
    if (!this.dialog) throw new Error('Seleção de arquivos indisponível.')
    const result = await this.dialog.showOpenDialog({ title:'Selecionar modelo local', properties:['openFile'], filters:[{ name:'Modelos HTML', extensions:['html','htm','txt'] }] })
    if (result.canceled || !result.filePaths[0]) return null
    return readLocalTemplate(result.filePaths[0])
  }

  setDefaultTemplate({ chave, modelo_id }) {
    if (!DOCS.some(doc => doc.key === chave)) throw new Error('Tipo de documento inválido.')
    if (!String(modelo_id).startsWith('padrao:')) {
      const custom = this.db.get('modelos_documento_rh', Number(modelo_id))
      if (!custom || custom.chave !== chave || !custom.ativo) throw new Error('Selecione um modelo ativo compatível com o documento.')
    }
    this.db.db.prepare("INSERT INTO configuracoes(chave,valor,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP").run(`modelo_rh:${chave}`, String(modelo_id))
    return true
  }

  latestEsocial(employeeId) {
    const row = this.db.db.prepare("SELECT d.*,a.caminho FROM documentos d JOIN arquivos a ON a.id=d.arquivo_id WHERE d.funcionario_id=? AND lower(d.categoria)='esocial' AND d.deleted_at IS NULL ORDER BY d.id DESC LIMIT 1").get(employeeId)
    return row && row.caminho && path.extname(row.caminho).toLowerCase() === '.pdf' && fs.existsSync(row.caminho) ? row : null
  }

  employeeEpis(employeeId, cargoId, empresaId, admissionDate) {
    const latest = this.db.db.prepare(`SELECT fe.*,e.nome,e.ca,e.unidade FROM funcionario_epis fe JOIN epis e ON e.id=fe.epi_id WHERE fe.funcionario_id=? AND fe.id IN (SELECT MAX(id) FROM funcionario_epis WHERE funcionario_id=? GROUP BY epi_id) ORDER BY fe.data_entrega,e.id`).all(employeeId, employeeId)
    if (!cargoId || !empresaId) return latest
    const kit = this.admissionConfig.epiKit(empresaId, cargoId)
    if (!kit.length) return latest
    const byEpi = new Map(latest.map(item => [Number(item.epi_id), item]))
    return kit.map(item => ({ ...item, ...(byEpi.get(Number(item.epi_id)) || {}), epi_id:item.epi_id, nome:item.nome, ca:item.ca, quantidade_texto:item.quantidade_texto, data_entrega:byEpi.get(Number(item.epi_id))?.data_entrega || admissionDate || null }))
  }

  saveGeneratedFile(destination, filename, employee, doc, html, selectedModel) {
    const stat = fs.statSync(destination)
    const existingFile = this.db.db.prepare('SELECT * FROM arquivos WHERE caminho=?').get(destination)
    const file = this.db.save('arquivos', { ...(existingFile || {}), nome_original:filename, nome_armazenado:filename, caminho:destination, tamanho:stat.size, extensao:'.pdf', mime_type:'application/pdf', hash:sha256(destination), origem:'gerado' })
    const existingDoc = this.db.db.prepare('SELECT * FROM documentos WHERE funcionario_id=? AND categoria=? AND arquivo_id=? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1').get(employee.id, doc.key, file.id)
    const record = this.db.save('documentos', { ...(existingDoc || {}), arquivo_id:file.id, empresa_id:employee.empresa_id, obra_id:employee.obra_atual_id, funcionario_id:employee.id, categoria:doc.key, titulo:doc.title, status_assinatura:'nao_assinado', versao:(existingDoc?.versao || 0) + 1, observacoes:selectedModel ? `Modelo personalizado: ${selectedModel.nome}` : `${RELEASE_NAME} · modelo padrão comercial` })
    const editable = this.db.db.prepare('SELECT * FROM documentos_editaveis WHERE documento_id=? ORDER BY id DESC LIMIT 1').get(record.id)
    this.db.save('documentos_editaveis', { ...(editable || {}), documento_id:record.id, conteudo_html:html, revisao:(editable?.revisao || 0) + 1 })
    return { ...record, path:destination }
  }

  async generate({ funcionario_id, includeCarta=false, selected=[], modelos={} }) {
    const employee = this.db.get('funcionarios', funcionario_id)
    if (!employee) throw new Error('Funcionário não encontrado.')
    const company = employee.empresa_id ? this.db.get('empresas', employee.empresa_id) : null
    const cargo = employee.cargo_id ? this.db.get('cargos', employee.cargo_id) : null
    employee.cargo_nome = cargo?.nome
    employee.cbo = cargo?.cbo
    const profiles = employee.empresa_id ? this.admissionConfig.documentProfiles(employee.empresa_id) : []
    const profileByKey = new Map(profiles.map(item => [item.documento_key, item]))
    const plan = buildAdmissionPlan(employee, includeCarta, profiles).filter(doc => !selected.length || selected.includes(doc.key))
    const validation = validateAdmissionDocuments(employee, plan.map(doc => doc.key))
    if (!validation.ok) {
      const details = Object.entries(validation.byDocument).map(([key,fields]) => `${key}: ${fields.join(', ')}`).join(' | ')
      const error = new Error(`Existem campos obrigatórios pendentes antes de gerar os documentos: ${details}`)
      error.details = validation.byDocument
      throw error
    }
    const epis = this.employeeEpis(employee.id, cargo?.id, employee.empresa_id, employee.admissao)
    const folders = admissionFolders(this.fileService, employee, company?.nome_fantasia || company?.razao_social)
    const generated = []
    for (let index=0; index<plan.length; index++) {
      const doc = plan[index]
      const profile = profileByKey.get(doc.key)
      const preference = this.db.db.prepare('SELECT valor FROM configuracoes WHERE chave=?').get(`modelo_rh:${doc.key}`)
      const selectedModelId = modelos[doc.key] || profile?.modelo_id || preference?.valor || `padrao:${doc.key}`
      const selectedModel = selectedModelId && !String(selectedModelId).startsWith('padrao:') ? this.db.get('modelos_documento_rh', Number(selectedModelId)) : null
      if (selectedModel && !selectedModel.ativo) throw new Error(`O modelo selecionado para ${doc.title} está inativo.`)
      const filename = admissionDocumentFilename(index, doc.title)
      const destination = path.join(folders.unsigned, filename)
      const html = selectedModel ? renderCustom(selectedModel.conteudo_html, employee, company, doc.title) : renderCommercialAdmissionTemplate(doc.key, employee, company, epis, null, parseProfileConfig(profile))
      await this.printHtml(html, destination)
      generated.push(this.saveGeneratedFile(destination, filename, employee, doc, html, selectedModel))
    }
    const dossier = await PDFDocument.create()
    for (const doc of generated) {
      const source = await PDFDocument.load(fs.readFileSync(doc.path))
      const pages = await dossier.copyPages(source, source.getPageIndices())
      pages.forEach(page => dossier.addPage(page))
    }
    const esocial = this.latestEsocial(employee.id)
    let esocialCopy = null
    if (esocial) {
      const copyName = `${String(generated.length + 1).padStart(2,'0')} - eSocial importado.pdf`
      esocialCopy = path.join(folders.unsigned, copyName)
      fs.copyFileSync(esocial.caminho, esocialCopy)
      const source = await PDFDocument.load(fs.readFileSync(esocial.caminho))
      const pages = await dossier.copyPages(source, source.getPageIndices())
      pages.forEach(page => dossier.addPage(page))
    }
    const dossierPath = path.join(folders.base, '00_Dossie_Admissao.pdf')
    fs.writeFileSync(dossierPath, await dossier.save())
    return { generated, dossier:dossierPath, folders, esocial:esocial ? { id:esocial.id, path:esocial.caminho, copy:esocialCopy } : null, release:this.getReleaseState(), validation }
  }
}

module.exports = { DocumentService, DOCS, readLocalTemplate, renderCustom, admissionFolders, RELEASE_NAME }
