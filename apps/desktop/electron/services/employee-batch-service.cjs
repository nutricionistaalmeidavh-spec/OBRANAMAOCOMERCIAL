const ExcelJS = require('exceljs')
const { randomUUID } = require('node:crypto')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')
const { readWorkbook, sheetRows } = require('./spreadsheet-reader.cjs')

const fields = [
  ['nome', 'Nome completo', true], ['cpf', 'CPF', true], ['data_nascimento', 'Data de nascimento', true],
  ['cargo', 'Cargo', true], ['admissao', 'Data de admissão', true],
  ['email', 'E-mail'], ['telefone', 'Celular'], ['rg', 'RG'], ['rg_emissao', 'Emissão RG'],
  ['rg_orgao', 'Órgão emissor'], ['pis', 'PIS / NIS'], ['ctps', 'CTPS'], ['ctps_serie', 'Série CTPS'],
  ['endereco', 'Endereço completo'], ['cep', 'CEP'], ['departamento', 'Departamento'],
  ['matricula', 'Matrícula interna'], ['matricula_esocial', 'Matrícula eSocial'],
  ['naturalidade', 'Naturalidade'], ['nacionalidade', 'Nacionalidade'], ['estado_civil', 'Estado civil'],
  ['mae', 'Nome da mãe'], ['pai', 'Nome do pai'],
  ['jornada_inicio', 'Entrada'], ['intervalo_inicio', 'Início do intervalo'],
  ['intervalo_fim', 'Fim do intervalo'], ['jornada_fim', 'Saída'],
  ['aso', 'Data do ASO admissional'], ['aso_validade', 'Validade do ASO'],
  ['nr06', 'Data NR-06'], ['nr12', 'Data NR-12'], ['nr18', 'Data NR-18'], ['nr35', 'Data NR-35'],
  ['outros', 'Outros exames ou treinamentos e datas'], ['observacoes', 'Observações'],
  ['sexo', 'Sexo'], ['cor', 'Cor / raça'], ['escolaridade', 'Escolaridade'],
  ['deficiencia', 'Deficiência'], ['beneficiarios', 'Beneficiários'],
  ['ctps_uf', 'UF CTPS'], ['ctps_expedicao', 'Expedição CTPS'],
  ['cnh', 'CNH'], ['cnh_categoria', 'Categoria CNH'], ['titulo_eleitor', 'Título eleitoral'],
  ['titulo_eleitor_zona', 'Zona eleitoral'], ['titulo_eleitor_secao', 'Seção eleitoral'],
  ['certificado_reservista', 'Reservista'], ['reservista_categoria', 'Categoria reservista'],
  ['endereco_logradouro', 'Logradouro'], ['endereco_numero', 'Número'],
  ['endereco_complemento', 'Complemento'], ['endereco_bairro', 'Bairro'],
  ['endereco_cidade', 'Cidade'], ['endereco_uf', 'UF do endereço'],
  ['obra', 'Obra atual'], ['experiencia_dias', 'Experiência em dias'],
  ['experiencia_fim', 'Término da experiência'], ['fgts_optante', 'Optante FGTS'],
  ['fgts_opcao_em', 'Data da opção FGTS'], ['vale_transporte_opcao', 'Optante vale-transporte'],
  ['vale_transporte_detalhes', 'Trajeto e tarifas do vale-transporte'], ['banco', 'Banco'],
  ['agencia', 'Agência'], ['conta_bancaria', 'Conta bancária'], ['pix', 'Chave PIX'],
  ['epis', 'EPIs entregues'], ['epi_entrega', 'Data da entrega dos EPIs']
]
const dateKeys = new Set(['admissao','data_nascimento','rg_emissao','aso','aso_validade','nr06','nr12','nr18','nr35','ctps_expedicao','experiencia_fim','fgts_opcao_em','epi_entrega'])
const recordKeys = ['aso','aso_validade','nr06','nr12','nr18','nr35','outros']
const toggleKeys = new Set(['fgts_optante', 'vale_transporte_opcao'])
const epiNames = value => [...new Set(String(value || '').split(';').map(nameKey).filter(Boolean))]
const timeKeys = new Set(['jornada_inicio','intervalo_inicio','intervalo_fim','jornada_fim'])
const nameKey = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase()
const cpfKey = value => String(value ?? '').trim().replace(/[.\-\s]/g, '')
const active = value => !value.deleted_at && !['inativo','inativa'].includes(value.status)

function date(value) {
  let result
  if (value instanceof Date && !Number.isNaN(value.getTime())) result = value.toISOString().slice(0, 10)
  else {
    const raw = String(value).trim()
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw)
    result = br ? `${br[3]}-${br[2]}-${br[1]}` : raw
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return ''
  const parsed = new Date(result)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result ? result : ''
}

async function createAdmissionTemplate() {
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet('Admissões', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = fields.map(([key, label, required]) => ({
    key, header: label + (required ? ' *' : ''), width: Math.max(label.length + 4, 19), style: { numFmt: dateKeys.has(key) ? 'dd/mm/yyyy' : '@' }
  }))
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17305F' } }
  const help = book.addWorksheet('Como preencher')
  help.getColumn(1).width = 108
  for (const text of [
    'Admissão em lote — Obra na Mão',
    'Preencha uma linha por funcionário na aba Admissões. Colunas com * são obrigatórias.',
    'Use o nome do cargo exatamente como cadastrado no Obra na Mão. A empresa é selecionada no aplicativo.',
    'Preencha o CPF com 11 dígitos, incluindo zeros à esquerda. Use datas no formato DD/MM/AAAA.',
    'Informe a data real de admissão. Para horários, use HH:MM.',
    'Informe as datas de ASO e NRs aplicáveis. Elas são salvas nas observações da ficha do funcionário.',
    'Para outras NRs ou exames, informe o nome e a respectiva data na coluna de outros treinamentos.',
    'Para FGTS e vale-transporte, preencha Sim ou Não. Informe a obra pelo nome cadastrado.',
    'Em EPIs entregues, separe os nomes por ponto e vírgula. Para distinguir nomes iguais, use Nome (CA).',
    'Preencha a data de entrega ao informar EPIs. Cada item listado registra uma unidade.',
    'O salário-base e os benefícios fixos vêm do cargo. CPFs existentes e linhas repetidas são sinalizados na prévia.'
  ]) help.addRow([text]).alignment = { wrapText: true }
  help.getRow(1).font = { bold: true, size: 15 }
  return Buffer.from(await book.xlsx.writeBuffer())
}

function parseAdmissions(sheet) {
  const [header, ...rows] = sheetRows(sheet)
  const indexes = new Map((header || []).map((label, index) => [nameKey(String(label).replace(/\s*\*$/, '')), index]))
  if (fields.some(([, label, required]) => required && !indexes.has(nameKey(label)))) {
    throw new Error('Use os cabeçalhos da aba Admissões da planilha modelo.')
  }
  const entries = []
  for (const [i, row] of rows.entries()) {
    if (!row?.some(value => String(value ?? '').trim())) continue
    const data = {}, errors = []
    for (const [key, label, required] of fields) {
      const raw = row[indexes.get(nameKey(label))]
      let value = String(raw ?? '').trim()
      if (!value) { if (required) errors.push(`Informe ${label}.`); continue }
      if (dateKeys.has(key)) {
        value = date(raw)
        if (!value) errors.push(`${label}: use uma data válida.`)
      }
      if (timeKeys.has(key) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) errors.push(`${label}: use HH:MM.`)
      if (toggleKeys.has(key)) {
        const choice = { sim:1, nao:0, '1':1, '0':0 }[nameKey(value)]
        if (choice !== 0 && choice !== 1) errors.push(`${label}: informe Sim ou Não.`)
        value = choice
      }
      if (key === 'experiencia_dias') {
        if (!/^\d{1,2}$/.test(value) || Number(value) < 1 || Number(value) > 90) errors.push('Experiência: informe de 1 a 90 dias.')
        value = Number(value)
      }
      if (key === 'sexo') {
        value = nameKey(value).replaceAll(' ', '_')
        if (!['feminino', 'masculino', 'outro', 'nao_informado'].includes(value)) errors.push('Sexo: informe Feminino, Masculino, Outro ou Não informado.')
      }
      data[key] = value
    }
    data.cpf = cpfKey(data.cpf)
    if (data.cpf && !/^\d{11}$/.test(data.cpf)) errors.push('CPF deve ter 11 dígitos.')
    if (data.nome && data.nome.split(/\s+/).length < 2) errors.push('Informe nome e sobrenome.')
    if (data.data_nascimento && data.admissao && data.data_nascimento >= data.admissao) errors.push('Nascimento deve ser anterior à admissão.')
    if (data.aso && data.aso_validade && data.aso_validade < data.aso) errors.push('Validade do ASO deve ser igual ou posterior ao exame.')
    if (data.experiencia_fim && data.admissao && data.experiencia_fim < data.admissao) errors.push('Término da experiência anterior à admissão.')
    if (data.epis && !data.epi_entrega) errors.push('Informe a data de entrega dos EPIs.')
    if (data.epi_entrega && !epiNames(data.epis).length) errors.push('Informe os EPIs entregues.')
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('E-mail inválido.')
    entries.push({ line:i + 2, data, errors })
  }
  if (!entries.length) throw new Error('Preencha ao menos um funcionário na aba Admissões.')
  if (entries.length > 1000) throw new Error('Importe até 1.000 funcionários por planilha.')
  const counts = new Map()
  for (const { data } of entries) counts.set(data.cpf, (counts.get(data.cpf) || 0) + 1)
  for (const { data, errors } of entries) if (data.cpf && counts.get(data.cpf) > 1) errors.push('CPF repetido na planilha.')
  return entries
}

class EmployeeBatchService {
  constructor({ dataAccess, dialog }) { this.dataAccess = dataAccess; this.dialog = dialog; this.batch = null; this.busy = false }

  async download(window) {
    const result = await this.dialog.showSaveDialog(window, {
      title:'Salvar modelo de admissão', defaultPath:'Modelo-Admissao-em-Lote.xlsx', filters:[{ name:'Excel', extensions:['xlsx'] }]
    })
    if (result.canceled || !result.filePath) return false
    const file = result.filePath.toLowerCase().endsWith('.xlsx') ? result.filePath : result.filePath + '.xlsx'
    await writeFile(file, await createAdmissionTemplate())
    return true
  }

  async review(entries, companyId) {
    if (!Number.isSafeInteger(companyId) || companyId <= 0) throw new Error('Selecione a empresa.')
    const [company, cargos, employees, works, equipment] = await Promise.all([
      this.dataAccess.get('empresas', companyId), this.dataAccess.list('cargos', { empresa_id: companyId }),
      this.dataAccess.list('funcionarios'),
      entries.some(entry => entry.data.obra) ? this.dataAccess.list('obras', { empresa_id:companyId }) : [],
      entries.some(entry => entry.data.epis) ? this.dataAccess.list('epis', { empresa_id:companyId }) : []
    ])
    if (!company || !active(company)) throw new Error('Empresa ativa não encontrada.')
    const cpfs = new Set(employees.filter(employee => !employee.deleted_at).map(employee => cpfKey(employee.cpf)))
    return entries.map(entry => {
      const errors = [...entry.errors]
      const roles = cargos.filter(item => Number(item.ativo) === 1 && nameKey(item.nome) === nameKey(entry.data.cargo))
      if (entry.data.cargo && roles.length !== 1) errors.push('Cargo ativo não encontrado de forma inequívoca para a empresa.')
      if (entry.data.cpf && cpfs.has(entry.data.cpf)) errors.push('CPF já cadastrado.')
      const matchingWorks = works.filter(item => item.empresa_id === companyId && active(item) && nameKey(item.nome) === nameKey(entry.data.obra))
      if (entry.data.obra && matchingWorks.length !== 1) errors.push('Obra não encontrada de forma inequívoca para a empresa.')
      const epis = []
      for (const name of epiNames(entry.data.epis)) {
        const matches = equipment.filter(item => Number(item.ativo) === 1 &&
          (nameKey(item.nome) === name || nameKey(`${item.nome} (${item.ca})`) === name))
        if (matches.length !== 1) errors.push(`EPI não encontrado de forma inequívoca: ${name}.`)
        else if (!epis.some(item => item.id === matches[0].id)) epis.push(matches[0])
      }
      return { ...entry, errors, role: roles[0], work:matchingWorks[0], epis }
    })
  }

  async choose(window, companyId) {
    const picked = await this.dialog.showOpenDialog(window, { title:'Anexar planilha de admissão', properties:['openFile'], filters:[{ name:'Excel', extensions:['xlsx'] }] })
    if (picked.canceled || !picked.filePaths[0]) return null
    const filename = picked.filePaths[0]
    if (path.extname(filename).toLowerCase() !== '.xlsx') throw new Error('Selecione um arquivo .xlsx.')
    const workbook = await readWorkbook(filename)
    const sheet = workbook.getWorksheet('Admissões')
    if (!sheet) throw new Error('A aba Admissões do modelo é obrigatória.')
    if (sheet.rowCount > 1001 || sheet.columnCount > 100) throw new Error('A planilha excede o tamanho do modelo.')
    const entries = parseAdmissions(sheet)
    const checked = await this.review(entries, companyId)
    this.batch = { token:randomUUID(), companyId, entries }
    return { token:this.batch.token, filename:path.basename(filename), rows:checked.map(({ line, data, errors }) => ({ line, name:data.nome || '', errors })) }
  }

  async commit(token) {
    if (this.busy || !this.batch || this.batch.token !== token) throw new Error('Abra novamente a planilha para revisar a importação.')
    this.busy = true
    const batch = this.batch
    this.batch = null
    try {
      const checked = await this.review(batch.entries, batch.companyId)
      const results = []
      for (const { line, data, role, work, epis, errors } of checked) {
        const result = { line, name:data.nome || '', errors }
        results.push(result)
        if (errors.length) continue
        const { cargo, obra, observacoes, epis:_names, epi_entrega, ...employee } = data
        const notes = recordKeys.filter(key => employee[key]).map(key => {
          const label = fields.find(([field]) => field === key)[1]
          const value = employee[key]
          return `${label}: ${dateKeys.has(key) ? value.split('-').reverse().join('/') : value}`
        })
        for (const key of recordKeys) delete employee[key]
        try {
          const saved = await this.dataAccess.save('funcionarios', {
            ...employee, cpf:employee.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'),
            observacoes:[observacoes, ...notes].filter(Boolean).join('\n'),
            empresa_id:batch.companyId, cargo_id:role.id, obra_atual_id:work?.id ?? null, salario_centavos:role.salario_base_centavos || 0, status:'ativo'
          })
          result.created = true
          for (const item of epis) {
            try {
              await this.dataAccess.save('funcionario_epis', {
                empresa_id:batch.companyId, funcionario_id:saved.id, epi_id:item.id, data_entrega:epi_entrega, quantidade:1
              })
            } catch {
              errors.push(`Cadastro criado. Registre na ficha a entrega de ${item.nome}.`)
            }
          }
        } catch (error) {
          console.error('Falha na admissão em lote', { line, code: error?.code })
          errors.push('Falha ao salvar. Reabra a planilha para verificar a situação desta linha.')
        }
      }
      return { created:results.filter(result => result.created).length, rows:results }
    } finally { this.busy = false }
  }
}

module.exports = { EmployeeBatchService, createAdmissionTemplate }
