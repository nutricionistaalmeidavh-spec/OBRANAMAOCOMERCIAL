const fs = require('node:fs')
const path = require('node:path')
const { BrowserWindow } = require('electron')
const { PDFDocument } = require('pdf-lib')
const { sanitizeName, sha256 } = require('./file-service.cjs')

const DOCS = [
  { key: 'carta_sindical', title: 'Carta de oposição sindical', optional: true },
  { key: 'contrato_experiencia', title: 'Contrato de experiência' },
  { key: 'ficha_registro', title: 'Ficha de registro de empregado' },
  { key: 'livro_registro', title: 'Folha do livro de registro' },
  { key: 'ordem_servico', title: 'Ordem de serviço' },
  { key: 'vale_transporte', title: 'Opção de vale-transporte' },
  { key: 'ficha_epi', title: 'Ficha de controle de EPI' }
]

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))
const money = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100)
const dateBR = (iso) => iso ? String(iso).split('-').reverse().join('/') : '____/____/________'

function base(title, employee, company, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;font-size:10.5pt;line-height:1.4;margin:0}h1{text-align:center;font-size:15pt;margin:0 0 18px;text-transform:uppercase}h2{font-size:11pt;background:#eef3fb;border-left:4px solid #2f67d8;padding:7px 9px;margin:16px 0 8px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 18px;border:1px solid #b8c1cf;padding:10px}.line{margin:9px 0}.signature{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:42px;text-align:center}.signature div{border-top:1px solid #111;padding-top:5px}.page{break-after:page}.page:last-child{break-after:auto}table{width:100%;border-collapse:collapse;font-size:9pt}th,td{border:1px solid #777;padding:5px;text-align:left;vertical-align:top}th{background:#edf1f6}p{margin:7px 0}.small{font-size:8.5pt}.center{text-align:center}.check{display:inline-block;border:1px solid #111;width:13px;height:13px;margin:0 5px -2px 12px}
  </style></head><body><h1>${esc(title)}</h1>${body}<div class="small center" style="margin-top:18px">Documento gerado pelo Fluxo DRE em ${new Date().toLocaleString('pt-BR')}.</div></body></html>`
}

function template(key, employee, company, epis = []) {
  const companyName = company?.razao_social || company?.nome_fantasia || 'EMPREGADORA'
  const address = company?.endereco || 'Endereço não informado'
  const role = employee.cargo_nome || 'Ajudante de Encanador'
  const city = String(address).split(',').slice(-2, -1)[0]?.trim() || 'Ribeirão Preto'
  const meta = `<div class="meta"><div><b>Empregador:</b> ${esc(companyName)}</div><div><b>CNPJ:</b> ${esc(company?.cnpj || '')}</div><div><b>Empregado:</b> ${esc(employee.nome)}</div><div><b>CPF:</b> ${esc(employee.cpf || '')}</div><div><b>Função:</b> ${esc(role)}</div><div><b>Admissão:</b> ${dateBR(employee.admissao)}</div></div>`
  if (key === 'carta_sindical') return base('Carta de oposição ao desconto das contribuições', employee, company, `<p class="line" style="text-align:right">${esc(city)}, ${dateBR(new Date().toISOString().slice(0,10))}.</p><p>Ao Sindicato da Construção Civil.</p><p><b>Assunto: contribuição assistencial / contribuição confederativa</b></p><p>Eu, <b>${esc(employee.nome)}</b>, portador da carteira profissional nº ${esc(employee.ctps || '')}, série ${esc(employee.ctps_serie || '')}, regularmente registrado na empresa ${esc(companyName)}, CNPJ ${esc(company?.cnpj || '')}, com sede à ${esc(address)}, não sindicalizado, manifesto oposição ao desconto em folha de pagamento a título de contribuição assistencial, confederativa ou outras contribuições em favor dessa entidade.</p><p>Atenciosamente,</p><div class="signature"><div>${esc(employee.nome)}</div><div>Recebimento</div></div>`)
  if (key === 'contrato_experiencia') return base('Contrato de experiência', employee, company, `${meta}<p>Entre a empresa <b>${esc(companyName)}</b>, com sede em ${esc(address)}, doravante EMPREGADORA, e <b>${esc(employee.nome)}</b>, portador da Carteira de Trabalho nº ${esc(employee.ctps || '')}, série ${esc(employee.ctps_serie || '')}, doravante EMPREGADO, é celebrado o presente contrato de experiência.</p><p>O EMPREGADO exercerá a função de <b>${esc(role)}</b>, cumprindo jornada das ${esc(employee.jornada_inicio || '07:00')} às ${esc(employee.intervalo_inicio || '11:00')} e das ${esc(employee.intervalo_fim || '12:00')} às ${esc(employee.jornada_fim || '17:00')}, mediante remuneração mensal de <b>${money(employee.salario_centavos)}</b>.</p><p>O horário será registrado na ficha do empregado, observados os limites legais. Horas extraordinárias serão prestadas quando determinadas e remuneradas ou compensadas conforme a legislação aplicável.</p><p>O empregado poderá prestar serviços em locais e obras indicados pela empregadora, em atividades compatíveis com sua condição pessoal. Danos causados com dolo ou culpa poderão ser descontados nos limites legais.</p><p>O contrato vigorará por <b>${esc(employee.experiencia_dias || 45)} dias</b>, com início em ${dateBR(employee.admissao)} e término em ${dateBR(employee.experiencia_fim)}. A eventual prorrogação será formalizada por escrito.</p><div class="signature"><div>${esc(companyName)}<br>EMPREGADORA</div><div>${esc(employee.nome)}<br>EMPREGADO</div></div><div class="page"></div><h2>Prorrogação do contrato de experiência</h2><p>Por mútuo acordo, o contrato que venceria nesta data fica prorrogado até ____/____/________.</p><div class="signature"><div>${esc(companyName)}</div><div>${esc(employee.nome)}</div></div>`)
  if (key === 'ficha_registro' || key === 'livro_registro') return base(key === 'ficha_registro' ? 'Registro de empregado' : 'Folha do livro de registro', employee, company, `${meta}<h2>Dados pessoais</h2><table><tr><th>Nascimento</th><th>Naturalidade</th><th>Nacionalidade</th><th>Estado civil</th></tr><tr><td>${dateBR(employee.data_nascimento)}</td><td>${esc(employee.naturalidade || '')}</td><td>${esc(employee.nacionalidade || 'Brasileira')}</td><td>${esc(employee.estado_civil || '')}</td></tr><tr><th>Filiação - Pai</th><th colspan="3">Filiação - Mãe</th></tr><tr><td>${esc(employee.pai || '')}</td><td colspan="3">${esc(employee.mae || '')}</td></tr></table><h2>Documentos e contrato</h2><table><tr><th>RG</th><th>CTPS/Série</th><th>PIS</th><th>Matrícula</th></tr><tr><td>${esc(employee.rg || '')}</td><td>${esc(employee.ctps || '')} / ${esc(employee.ctps_serie || '')}</td><td>${esc(employee.pis || '')}</td><td>${esc(employee.matricula || '')}</td></tr><tr><th>Cargo</th><th>CBO</th><th>Salário</th><th>Admissão</th></tr><tr><td>${esc(role)}</td><td>${esc(employee.cbo || '')}</td><td>${money(employee.salario_centavos)}</td><td>${dateBR(employee.admissao)}</td></tr></table><h2>Histórico</h2><table><tr><th>Data</th><th>Alteração salarial, cargo, férias, afastamento ou observação</th></tr>${Array.from({length:7},()=>'<tr><td style="height:26px"></td><td></td></tr>').join('')}</table><div class="signature"><div>${esc(employee.nome)}</div><div>${esc(companyName)}</div></div>`)
  if (key === 'ordem_servico') return base('Ordem de serviço - Segurança e saúde do trabalho', employee, company, `${meta}<h2>1 - Atividades desenvolvidas</h2><p>Execução de instalações hidráulicas e sanitárias, apoio à montagem, transporte de materiais e demais atividades compatíveis com a função e a obra indicada.</p><h2>2 - Riscos ocupacionais</h2><p>Ruído, poeiras, agentes químicos, transporte manual de cargas, quedas no mesmo nível e de altura, projeção de partículas, cortes, perfurações, ferramentas e equipamentos.</p><h2>3 - Equipamentos de proteção individual</h2><p>Capacete com jugular, botina, óculos, luvas, protetor auditivo, respirador PFF2, uniforme e proteção contra quedas quando aplicável.</p><h2>4 - Medidas preventivas</h2><p>Utilizar os EPIs fornecidos, inspecionar ferramentas, respeitar sinalização e proteções coletivas, comunicar riscos e interromper atividades em condição insegura.</p><h2>5 - Orientações e treinamentos</h2><p>Integração de segurança, NR06, NR12, NR18 e NR35 quando aplicáveis à atividade e devidamente ministrados por responsáveis habilitados.</p><h2>Termo de responsabilidade</h2><p>Declaro que fui orientado quanto aos procedimentos de segurança, riscos e medidas preventivas, recebi uma cópia desta ordem e comprometo-me a cumprir as instruções.</p><p>${esc(city)}, ${dateBR(employee.admissao)}.</p><div class="signature"><div>${esc(employee.nome)}<br>Funcionário</div><div>Responsável</div></div>`)
  if (key === 'vale_transporte') return base('Solicitação do vale-transporte', employee, company, `${meta}<p><span class="check">${employee.vale_transporte_opcao ? 'X' : ''}</span> Opto pela utilização do Vale-Transporte <span class="check">${employee.vale_transporte_opcao === 0 ? 'X' : ''}</span> Não opto.</p><p>Solicito o benefício exclusivamente para o deslocamento residência-trabalho e vice-versa; comprometo-me a informar alterações e autorizo o desconto legal aplicável.</p><h2>Residência atual</h2><p>${esc(employee.endereco || '')} - CEP ${esc(employee.cep || '')}</p><h2>Meios de transporte</h2><table><tr><th>Trecho</th><th>Empresa/linha</th><th>Tarifa</th></tr>${Array.from({length:6},(_,i)=>`<tr><td>${i<3?'Residência / trabalho':'Trabalho / residência'}</td><td></td><td></td></tr>`).join('')}</table><p>${esc(city)}, ${dateBR(employee.admissao)}.</p><div class="signature"><div>${esc(employee.nome)}</div><div>Responsável</div></div>`)
  return base('Ficha de controle de E.P.I.', employee, company, `${meta}<p>Declaro haver recebido para uso e proteção os equipamentos abaixo, comprometendo-me com sua utilização, guarda, conservação e devolução para troca quando apresentarem desgaste.</p><table><tr><th>Data</th><th>Descrição</th><th>C.A.</th><th>Quantidade</th><th>Devolução</th><th>Assinatura</th></tr>${(epis.length?epis:Array.from({length:10},()=>({}))).map((item)=>`<tr><td>${dateBR(item.data_entrega)}</td><td>${esc(item.nome || '')}</td><td>${esc(item.ca || '')}</td><td>${esc(item.quantidade || '')}</td><td>${dateBR(item.data_devolucao)}</td><td></td></tr>`).join('')}</table><div class="signature"><div>${esc(employee.nome)}</div><div>${esc(companyName)}</div></div>`)
}

function customValues(employee, company) {
  return {
    nome_funcionario: employee.nome || '', cpf: employee.cpf || '', rg: employee.rg || '', ctps: employee.ctps || '',
    cargo: employee.cargo_nome || '', admissao: dateBR(employee.admissao), salario: money(employee.salario_centavos),
    endereco_funcionario: employee.endereco || '', empresa: company?.razao_social || company?.nome_fantasia || '',
    cnpj: company?.cnpj || '', endereco_empresa: company?.endereco || '', data_hoje: dateBR(new Date().toISOString().slice(0, 10))
  }
}

function renderCustom(content, employee, company, title) {
  const values = customValues(employee, company)
  const manualField = (label) => `<span style="display:inline-block;min-width:145px;padding:2px 5px;border:1px dashed #8a6500;background:#fff7c7;color:#5d4500;font-weight:700">PREENCHER: ${esc(label)}</span>`
  const replaced = sanitizeTemplateHtml(content)
    .replace(/\{\{manual:([^}]+)\}\}/gi, (_match, label) => manualField(String(label).trim() || 'campo'))
    .replace(/\{\{([a-z_]+)\}\}/gi, (_match, key) => values[key.toLowerCase()] ? esc(values[key.toLowerCase()]) : manualField(key.replaceAll('_', ' ')))
  return /<html/i.test(replaced) ? replaced : base(title, employee, company, replaced)
}

function sanitizeTemplateHtml(content) {
  return String(content || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|base)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
}

function readLocalTemplate(filePath) {
  const resolved = path.resolve(String(filePath || ''))
  const extension = path.extname(resolved).toLowerCase()
  if (!['.html', '.htm', '.txt'].includes(extension)) throw new Error('Escolha um modelo HTML, HTM ou TXT.')
  const stat = fs.statSync(resolved)
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('O modelo deve ser um arquivo de atÃ© 2 MB.')
  const source = fs.readFileSync(resolved, 'utf8')
  if (!source.trim()) throw new Error('O arquivo de modelo estÃ¡ vazio.')
  return { nome: path.basename(resolved, extension), conteudo_html: extension === '.txt' ? `<pre>${esc(source)}</pre>` : sanitizeTemplateHtml(source), arquivo_origem: resolved }
}

class DocumentService {
  constructor({ db, fileService, dialog }) { this.db = db; this.fileService = fileService; this.dialog = dialog }
  async printHtml(html, destination) {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'none' } })
      fs.writeFileSync(destination, pdf)
    } finally { win.destroy() }
  }
  listTemplates() {
    const selected = new Map(this.db.db.prepare("SELECT chave, valor FROM configuracoes WHERE chave LIKE 'modelo_rh:%'").all().map((row) => [row.chave.replace('modelo_rh:', ''), row.valor]))
    const custom = this.db.list('modelos_documento_rh').map((item) => ({ ...item, origem: 'personalizado', selecionado: String(selected.get(item.chave) || '') === String(item.id) }))
    const defaults = DOCS.map((doc) => ({ id: `padrao:${doc.key}`, chave: doc.key, nome: `${doc.title} (padrão)`, ativo: 1, origem: 'padrao', selecionado: !selected.get(doc.key) || selected.get(doc.key) === `padrao:${doc.key}`, campos: Object.keys(customValues({}, {})) }))
    return [...defaults, ...custom]
  }
  saveTemplate(data) {
    if (!DOCS.some((doc) => doc.key === data.chave)) throw new Error('Modelo de documento inválido.')
    if (!String(data.nome || '').trim() || !String(data.conteudo_html || '').trim()) throw new Error('Informe nome e conteúdo do modelo.')
    return this.db.save('modelos_documento_rh', { ...data, nome: String(data.nome).trim(), conteudo_html: String(data.conteudo_html), ativo: data.ativo === false ? 0 : 1 })
  }
  async chooseLocalTemplate() {
    if (!this.dialog) throw new Error('SeleÃ§Ã£o de arquivos indisponÃ­vel.')
    const result = await this.dialog.showOpenDialog({ title: 'Selecionar modelo local', properties: ['openFile'], filters: [{ name: 'Modelos HTML', extensions: ['html', 'htm', 'txt'] }] })
    if (result.canceled || !result.filePaths[0]) return null
    return readLocalTemplate(result.filePaths[0])
  }
  setDefaultTemplate({ chave, modelo_id }) {
    if (!DOCS.some((doc) => doc.key === chave)) throw new Error('Tipo de documento inválido.')
    if (!String(modelo_id).startsWith('padrao:')) {
      const custom = this.db.get('modelos_documento_rh', Number(modelo_id))
      if (!custom || custom.chave !== chave || !custom.ativo) throw new Error('Selecione um modelo ativo compatível com o documento.')
    }
    this.db.db.prepare("INSERT INTO configuracoes(chave,valor,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor,updated_at=CURRENT_TIMESTAMP").run(`modelo_rh:${chave}`, String(modelo_id))
    return true
  }
  async generate({ funcionario_id, includeCarta = false, selected = [], modelos = {} }) {
    const employee = this.db.get('funcionarios', funcionario_id)
    if (!employee) throw new Error('Funcionário não encontrado.')
    const company = employee.empresa_id ? this.db.get('empresas', employee.empresa_id) : null
    const cargo = employee.cargo_id ? this.db.get('cargos', employee.cargo_id) : null
    employee.cargo_nome = cargo?.nome
    employee.cbo = cargo?.cbo
    const epis = this.db.db.prepare('SELECT fe.*,e.nome,e.ca FROM funcionario_epis fe JOIN epis e ON e.id=fe.epi_id WHERE fe.funcionario_id=? ORDER BY fe.data_entrega').all(employee.id)
    const folders = this.fileService.employeeFolders(employee, company?.nome_fantasia || company?.razao_social)
    const docs = DOCS.filter((doc) => (!doc.optional || includeCarta) && (!selected.length || selected.includes(doc.key)))
    const generated = []
    for (const doc of docs) {
      const preference = this.db.db.prepare('SELECT valor FROM configuracoes WHERE chave=?').get(`modelo_rh:${doc.key}`)
      const selectedModelId = modelos[doc.key] || preference?.valor || `padrao:${doc.key}`
      const selectedModel = selectedModelId && !String(selectedModelId).startsWith('padrao:') ? this.db.get('modelos_documento_rh', Number(selectedModelId)) : null
      if (selectedModel && !selectedModel.ativo) throw new Error(`O modelo selecionado para ${doc.title} está inativo.`)
      const filename = `${String(generated.length + 1).padStart(2,'0')} - ${sanitizeName(doc.title)} - ${Date.now()}.pdf`
      const destination = path.join(folders.unsigned, filename)
      const html = selectedModel ? renderCustom(selectedModel.conteudo_html, employee, company, doc.title) : template(doc.key, employee, company, epis)
      await this.printHtml(html, destination)
      const stat = fs.statSync(destination)
      const file = this.db.save('arquivos', { nome_original: filename, nome_armazenado: filename, caminho: destination, tamanho: stat.size, extensao: '.pdf', mime_type: 'application/pdf', hash: sha256(destination), origem: 'gerado' })
      const record = this.db.save('documentos', { arquivo_id: file.id, empresa_id: employee.empresa_id, obra_id: employee.obra_atual_id, funcionario_id: employee.id, categoria: doc.key, titulo: doc.title, status_assinatura: 'nao_assinado', versao: 1, observacoes: selectedModel ? `Modelo personalizado: ${selectedModel.nome}` : 'Modelo padrão' })
      this.db.save('documentos_editaveis', { documento_id: record.id, conteudo_html: html, revisao: 1 })
      generated.push({ ...record, path: destination })
    }
    const dossier = await PDFDocument.create()
    for (const doc of generated) {
      const source = await PDFDocument.load(fs.readFileSync(doc.path))
      const pages = await dossier.copyPages(source, source.getPageIndices())
      pages.forEach((page) => dossier.addPage(page))
    }
    const dossierName = `Dossiê admissional - ${sanitizeName(employee.nome)} - ${Date.now()}.pdf`
    const dossierPath = path.join(folders.unsigned, dossierName)
    fs.writeFileSync(dossierPath, await dossier.save())
    return { generated, dossier: dossierPath, folders }
  }
}

module.exports = { DocumentService, DOCS, template, readLocalTemplate, renderCustom }
