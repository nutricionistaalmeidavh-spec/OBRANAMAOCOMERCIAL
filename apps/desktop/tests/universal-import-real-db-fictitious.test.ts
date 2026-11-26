import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

/**
 * Homologação da importação em arquivos ExcelJS REAIS + banco SQLite migrado
 * pelo DatabaseService oficial, usando apenas dados fictícios temporários.
 * Nenhum SQLite de cliente, Cloudflare D1 ou servidor real é consultado.
 */
const localRequire = createRequire(import.meta.url)
const ExcelJS = localRequire('exceljs')
const { DatabaseService } = localRequire('../electron/services/database.cjs')
const migrationsDir = path.resolve(import.meta.dirname, '../database/migrations')

function importService(db: any) {
  // Electron não está disponível no runner Node; todas as demais dependências são reais.
  const location = path.resolve(import.meta.dirname, '../electron/services/universal-import-service.cjs')
  const source = fs.readFileSync(location, 'utf8')
  const mod = { exports: {} as any }
  const realRequire = createRequire(location)
  const fakeRequire = (name: string): any => name === 'electron'
    ? { dialog: {} }
    : realRequire(name)
  new Function('require', 'module', 'exports', source)(fakeRequire, mod, mod.exports)
  return new mod.exports.UniversalImportService({ db })
}

function database() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'obra-importacao-ficticia-'))
  const db = new DatabaseService({ dataDir: dir, migrationsDir })
  db.open()
  const company = db.save('empresas', {
    razao_social: 'Construtora Fictícia de Testes LTDA',
    status: 'ativa',
  })
  return {
    dir, db, company,
    cleanup() {
      db.close()
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

const samples: Array<{
  area: string
  headers: string[]
  data: (string | number)[][]
  table: string
  expected: number
}> = [
  { area: 'obras',
    headers: ['nome', 'codigo', 'valor', 'status'],
    data: [
      ['Residencial Aurora Fictício', 'OBRA-FIC-001', 520000, 'planejada'],
      ['Edifício Horizonte Fictício', 'OBRA-FIC-002', 835000, 'planejada'],
    ],
    table: 'obras', expected: 2 },
  { area: 'funcionarios',
    headers: ['nome', 'cargo', 'salario', 'obra', 'status'],
    data: [
      ['Pessoa Exemplo Alfa', 'Encanador', 3100, 'Residencial Aurora Fictício', 'ativo'],
      ['Pessoa Exemplo Beta', 'Ajudante de Encanador', 2100, 'Residencial Aurora Fictício', 'ativo'],
    ],
    table: 'funcionarios', expected: 2 },
  { area: 'orcamento',
    headers: ['obra', 'frente', 'descricao', 'quantidade', 'unidade', 'valor_unitario', 'tipo'],
    data: [
      ['Residencial Aurora Fictício', 'Hidráulica', 'Tubulação PVC fictícia', 80, 'm', 15.5, 'material'],
      ['Residencial Aurora Fictício', 'Hidráulica', 'Instalação fictícia', 12, 'un', 120.8, 'servico'],
    ],
    table: 'itens_orcamentarios', expected: 2 },
  { area: 'financeiro',
    headers: ['descricao', 'valor', 'tipo', 'competencia', 'vencimento', 'obra', 'categoria'],
    data: [
      ['Compra fictícia de conexões', 345.67, 'despesa', '2026-11', '20/11/2026', 'Residencial Aurora Fictício', 'Materiais'],
      ['Recebimento fictício de etapa', 12500, 'receita', '2026-11', '25/11/2026', 'Residencial Aurora Fictício', 'Receitas'],
    ],
    table: 'contas', expected: 2 },
  { area: 'compras',
    headers: ['obra', 'frente', 'descricao', 'fornecedor', 'valor', 'quantidade', 'unidade'],
    data: [
      ['Residencial Aurora Fictício', 'Hidráulica', 'Conexões de demonstração', 'Fornecedor Fictício', 710, 20, 'un'],
    ],
    table: 'pedidos_compra', expected: 1 },
  { area: 'contratos',
    headers: ['obra', 'numero', 'descricao', 'valor', 'tipo', 'status'],
    data: [
      ['Residencial Aurora Fictício', 'CONTR-FIC-001', 'Instalação hidrossanitária fictícia', 68000, 'principal', 'ativo'],
    ],
    table: 'contratos_obra', expected: 1 },
  { area: 'aditivos',
    headers: ['contrato', 'numero', 'descricao', 'valor', 'status'],
    data: [
      ['CONTR-FIC-001', 'ADT-FIC-01', 'Material adicional fictício', 2500, 'solicitado'],
    ],
    table: 'contrato_aditivos', expected: 1 },
  { area: 'medicoes',
    headers: ['obra', 'contrato', 'numero', 'competencia', 'valor', 'descricao', 'status'],
    data: [
      ['Residencial Aurora Fictício', 'CONTR-FIC-001', 'MED-FIC-01', '2026-11', 9500, 'Medição fictícia de obra', 'rascunho'],
    ],
    table: 'medicoes', expected: 1 },
  { area: 'ponto',
    headers: ['funcionario', 'competencia', 'data', 'entrada', 'saida'],
    data: [
      ['Pessoa Exemplo Alfa', '2026-11', '17/11/2026', '07:00', '17:00'],
    ],
    table: 'ponto_marcacoes', expected: 1 },
  { area: 'documentos',
    headers: ['obra', 'titulo', 'categoria', 'observacoes'],
    data: [
      ['Residencial Aurora Fictício', 'Documento de demonstração', 'outros', 'Sem dados reais'],
    ],
    table: 'documentos', expected: 1 },
  { area: 'estoque',
    headers: ['obra', 'frente', 'descricao', 'quantidade', 'unidade', 'tipo'],
    data: [
      ['Residencial Aurora Fictício', 'Hidráulica', 'Cano PVC de demonstração', 14, 'un', 'entrada'],
    ],
    table: 'movimentacoes_estoque', expected: 1 },
]

function count(db: any, table: string) {
  return db.db.prepare('SELECT count(*) AS total FROM ' + table).get().total as number
}

async function sampleWorkbook(dir: string) {
  const book = new ExcelJS.Workbook()
  book.addWorksheet('LEIA-ME').addRow(['Planilhas com dados exclusivamente fictícios — QA do Obra na Mão'])
  book.addWorksheet('ABA_VAZIA')
  for (const sample of samples) {
    const sheet = book.addWorksheet(sample.area)
    sheet.addRow(sample.headers)
    sample.data.forEach(row => sheet.addRow(row))
  }
  const file = path.join(dir, 'Obra-na-Mao-homologacao-dados-ficticios.xlsx')
  await book.xlsx.writeFile(file)
  return file
}

describe('homologação da importação universal real com dados fictícios', () => {
  it('lê 11 abas reais, faz a prévia sem gravar, importa todos os módulos e confere o SQLite oficial', async () => {
    const fixture = database()
    try {
      const file = await sampleWorkbook(fixture.dir)
      const service = importService(fixture.db)
      let importedSum = 0
      for (const sample of samples) {
        const analyzed = await service.analyze(file)
        expect(analyzed.sheets.find((item: any) => item.name === sample.area)).toBeTruthy()
        expect(analyzed.sheets.some((item: any) => item.name === 'ABA_VAZIA')).toBe(false)

        const options = { sheet: sample.area, area: sample.area, companyId: fixture.company.id }
        const before = count(fixture.db, sample.table)
        const preview = await service.preview(analyzed.token, options)
        expect(preview.companyId).toBe(fixture.company.id)
        expect(preview.total).toBe(sample.expected)
        expect(preview.invalid).toBe(0)
        expect(preview.missing).toEqual([])
        expect(preview.alreadyImported).toBe(false)
        expect(count(fixture.db, sample.table)).toBe(before)

        const result = await service.commit(analyzed.token, options)
        expect(result.imported).toBe(sample.expected)
        expect(count(fixture.db, sample.table)).toBe(before + sample.expected)
        importedSum += result.imported
      }
      expect(importedSum).toBe(15)
      expect(count(fixture.db, 'importacoes')).toBe(samples.length)
      expect(count(fixture.db, 'importacao_linhas')).toBe(15)
      expect(fixture.db.db.pragma('integrity_check', { simple: true })).toBe('ok')
      expect(fixture.db.db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
      expect(fixture.db.db.prepare("SELECT valor_centavos, tipo, competencia FROM contas WHERE descricao='Compra fictícia de conexões'").get())
        .toMatchObject({ valor_centavos: 34567, tipo: 'pagar', competencia: '2026-11' })
      expect(fixture.db.db.prepare("SELECT valor_centavos, tipo FROM contas WHERE descricao='Recebimento fictício de etapa'").get())
        .toMatchObject({ valor_centavos: 1250000, tipo: 'receber' })
      expect(fixture.db.db.prepare("SELECT COUNT(*) AS total FROM pedidos_compra").get().total).toBe(1)
      expect(fixture.db.db.prepare("SELECT COUNT(*) AS total FROM pedido_compra_itens").get().total).toBe(1)
      expect(fixture.db.db.prepare("SELECT COUNT(*) AS total FROM pontos_mensais").get().total).toBe(1)
    } finally {
      fixture.cleanup()
    }
  })

  it('bloqueia reimportação de arquivo idêntico e preserva quantidade de registros', async () => {
    const fixture = database()
    try {
      const file = await sampleWorkbook(fixture.dir)
      const service = importService(fixture.db)
      const options = { sheet: 'obras', area: 'obras', companyId: fixture.company.id }
      const first = await service.analyze(file)
      await service.commit(first.token, options)
      const before = count(fixture.db, 'obras')
      const second = await service.analyze(file)
      const preview = await service.preview(second.token, options)
      expect(preview.alreadyImported).toBe(true)
      await expect(service.commit(second.token, options)).rejects.toThrow(/importad/i)
      expect(count(fixture.db, 'obras')).toBe(before)
    } finally {
      fixture.cleanup()
    }
  })

  it('bloqueia duplicatas dentro do arquivo e não grava registros parcialmente', async () => {
    const fixture = database()
    try {
      const book = new ExcelJS.Workbook()
      const sheet = book.addWorksheet('obras')
      sheet.addRow(['nome', 'codigo'])
      sheet.addRow(['Obra repetida fictícia', 'DUP-001'])
      sheet.addRow(['Obra repetida fictícia', 'DUP-001'])
      const file = path.join(fixture.dir, 'duplicatas.xlsx')
      await book.xlsx.writeFile(file)
      const service = importService(fixture.db)
      const analyzed = await service.analyze(file)
      const options = { sheet: 'obras', area: 'obras', companyId: fixture.company.id }
      const preview = await service.preview(analyzed.token, options)
      expect(preview.duplicates).toBe(1)
      expect(preview.invalid).toBe(1)
      await expect(service.commit(analyzed.token, options)).rejects.toThrow(/inválid|corrij|linha/i)
      expect(count(fixture.db, 'obras')).toBe(0)
      expect(count(fixture.db, 'importacoes')).toBe(0)
    } finally {
      fixture.cleanup()
    }
  })

  it('rejeita empresa inexistente e coluna obrigatória sem nenhum commit', async () => {
    const fixture = database()
    try {
      const file = await sampleWorkbook(fixture.dir)
      const service = importService(fixture.db)
      const analyzed = await service.analyze(file)
      await expect(service.preview(analyzed.token, { sheet: 'obras', area: 'obras', companyId: 999999 }))
        .rejects.toThrow(/empresa/i)
      const options = { sheet: 'obras', area: 'obras', companyId: fixture.company.id, mapping: { nome: '' } }
      const preview = await service.preview(analyzed.token, options)
      expect(preview.missing).toContain('nome')
      await expect(service.commit(analyzed.token, options)).rejects.toThrow(/obrigatório|mapeie/i)
      expect(count(fixture.db, 'obras')).toBe(0)
    } finally {
      fixture.cleanup()
    }
  })

  it('revê 241 linhas e bloqueia último lançamento inválido sem gravação', async () => {
    const fixture = database()
    try {
      const book = new ExcelJS.Workbook()
      const sheet = book.addWorksheet('financeiro')
      sheet.addRow(['descricao', 'valor'])
      for (let i = 1; i <= 241; i++) sheet.addRow(['Lançamento fictício ' + i, i === 241 ? 0 : 25])
      const file = path.join(fixture.dir, 'financeiro-241-linhas.xlsx')
      await book.xlsx.writeFile(file)
      const service = importService(fixture.db)
      const analyzed = await service.analyze(file)
      const options = { sheet: 'financeiro', area: 'financeiro', companyId: fixture.company.id }
      const preview = await service.preview(analyzed.token, { ...options, page: 10, pageSize: 25 })
      expect(preview.total).toBe(241)
      expect(preview.invalid).toBe(1)
      expect(preview.rows.at(-1)?.descricao).toBe('Lançamento fictício 241')
      await expect(service.commit(analyzed.token, options)).rejects.toThrow(/inválid|corrij|linha/i)
      expect(count(fixture.db, 'contas')).toBe(0)
    } finally {
      fixture.cleanup()
    }
  })
})

describe('regressão orçamento da cliente — obra única e preço unitário', () => {
  it('importa 234 linhas sem coluna obra usando o ID explícito da obra e preserva centavos', async () => {
    const fixture = database()
    try {
      const work = fixture.db.save('obras', { empresa_id: fixture.company.id, nome: 'Obra fictícia única', status: 'planejada' })
      const book = new ExcelJS.Workbook()
      const sheet = book.addWorksheet('Orçamento')
      sheet.addRow(['Descrição', 'Quantidade', 'Preço unit. (R$)'])
      for (let i=1;i<=234;i++) sheet.addRow(['Serviço fictício '+i, 2, i===1?'12.50':'1.234,56'])
      const file = path.join(fixture.dir,'orcamento-234.xlsx')
      await book.xlsx.writeFile(file)
      const service = importService(fixture.db)
      const analyzed = await service.analyze(file)
      const options = { sheet:'Orçamento', area:'orcamento', companyId:fixture.company.id, workId:work.id }
      const preview = await service.preview(analyzed.token, options)
      expect(preview.missing).toEqual([])
      expect(preview.invalid).toBe(0)
      expect(preview.total).toBe(234)
      expect(count(fixture.db,'itens_orcamentarios')).toBe(0)
      expect((await service.commit(analyzed.token,options)).imported).toBe(234)
      expect(fixture.db.db.prepare('SELECT DISTINCT obra_id FROM itens_orcamentarios').all()).toEqual([{obra_id:work.id}])
      expect(fixture.db.db.prepare("SELECT valor_unitario_centavos FROM itens_orcamentarios WHERE descricao='Serviço fictício 1'").get().valor_unitario_centavos).toBe(1250)
      expect(fixture.db.db.prepare("SELECT valor_unitario_centavos FROM itens_orcamentarios WHERE descricao='Serviço fictício 2'").get().valor_unitario_centavos).toBe(123456)
    } finally { fixture.cleanup() }
  })
  it('rejeita obra de outra empresa e preço inválido sem gravar linhas', async () => {
    const fixture=database()
    try {
      const other=fixture.db.save('empresas',{razao_social:'Outra empresa fictícia',status:'ativa'})
      const foreign=fixture.db.save('obras',{empresa_id:other.id,nome:'Obra externa',status:'planejada'})
      const work=fixture.db.save('obras',{empresa_id:fixture.company.id,nome:'Obra autorizada',status:'planejada'})
      const book=new ExcelJS.Workbook()
      const sheet=book.addWorksheet('Orçamento')
      sheet.addRow(['descricao','quantidade','valor_unitario'])
      sheet.addRow(['Item válido',1,0])
      sheet.addRow(['Item inválido',1,'texto'])
      const file=path.join(fixture.dir,'orcamento-invalido.xlsx')
      await book.xlsx.writeFile(file)
      const service=importService(fixture.db)
      const analyzed=await service.analyze(file)
      const options={sheet:'Orçamento',area:'orcamento',companyId:fixture.company.id}
      await expect(service.preview(analyzed.token,{...options,workId:foreign.id})).rejects.toThrow(/obra/i)
      const preview=await service.preview(analyzed.token,{...options,workId:work.id})
      expect(preview.invalid).toBe(1)
      expect(preview.issues[0].line).toBe(3)
      await expect(service.commit(analyzed.token,{...options,workId:work.id})).rejects.toThrow(/linha 3/i)
      expect(count(fixture.db,'itens_orcamentarios')).toBe(0)
    } finally { fixture.cleanup() }
  })
})
