import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { DatabaseService } = require('./database.cjs')
const created: Array<{ dir: string; service: any }> = []

function createDatabase() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxo-dre-test-'))
  const service = new DatabaseService({ dataDir, migrationsDir: path.resolve(import.meta.dirname, '../../database/migrations') })
  service.open()
  created.push({ dir: dataDir, service })
  return service
}

afterEach(() => {
  for (const item of created.splice(0)) {
    try { item.service.close() } catch {}
    fs.rmSync(item.dir, { recursive: true, force: true })
  }
})

describe('SQLite e regras transacionais', () => {
  it('aplica migrations, foreign keys e CRUD com exclusão lógica', () => {
    const db = createDatabase()
    expect(db.db.pragma('foreign_keys', { simple: true })).toBe(1)
    const empresa = db.save('empresas', { razao_social: 'Empresa Teste', status: 'ativa' })
    expect(db.get('empresas', empresa.id).razao_social).toBe('Empresa Teste')
    db.remove('empresas', empresa.id)
    expect(db.list('empresas').find((item: any) => item.id === empresa.id)).toBeUndefined()
  })

  it('registra pagamentos parciais e conclui a conta sem duplicidade', () => {
    const db = createDatabase()
    const empresa = db.save('empresas', { razao_social: 'Empresa', status: 'ativa' })
    const conta = db.save('contas', { tipo: 'pagar', empresa_id: empresa.id, descricao: 'Folha', competencia: '2026-08', vencimento: '2026-08-15', valor_centavos: 10000, status: 'pendente' })
    expect(db.accountPayment(conta.id, { valor_centavos: 4000, data: '2026-08-10' }).status).toBe('parcialmente_pago')
    expect(db.accountPayment(conta.id, { valor_centavos: 6000, data: '2026-08-15' }).status).toBe('pago')
    expect(db.db.prepare('SELECT SUM(valor_centavos) total FROM pagamentos_conta WHERE conta_id=?').get(conta.id).total).toBe(10000)
  })

  it('exige justificativa quando a medição excede o orçamento', () => {
    const db = createDatabase()
    const empresa = db.save('empresas', { razao_social: 'Empresa', status: 'ativa' })
    const obra = db.save('obras', { empresa_id: empresa.id, nome: 'Obra', status: 'ativa' })
    const item = db.save('itens_orcamentarios', { obra_id: obra.id, descricao: 'Tubulação', unidade: 'm', quantidade: 10, valor_unitario_centavos: 100, tipo: 'servico' })
    const semJustificativa = { obra_id: obra.id, competencia: '2026-08', data: '2026-08-31', numero: '1', status: 'rascunho', valor_bruto_centavos: 1100, valor_liquido_centavos: 1100, itens: [{ item_orcamentario_id: item.id, quantidade_periodo: 11, valor_periodo_centavos: 1100 }] }
    expect(() => db.saveMeasurement(semJustificativa)).toThrow(/justificativa/i)
    expect(db.saveMeasurement({ ...semJustificativa, itens: [{ ...semJustificativa.itens[0], justificativa_excesso: 'Aditivo aprovado' }] }).id).toBeTruthy()
  })

  it('cria o núcleo operacional sem afetar os vínculos financeiros da obra', () => {
    const db = createDatabase()
    const empresa = db.save('empresas', { razao_social: 'Empresa', status: 'ativa' })
    const obra = db.save('obras', { empresa_id: empresa.id, nome: 'Obra modular', status: 'ativa', centro_custo: 'CC-01', status_operacional: 'em_execucao' })
    const request = db.save('solicitacoes_compra', { obra_id: obra.id, solicitante: 'Engenharia', descricao: 'Tubos', status: 'solicitada' })
    const contract = db.save('contratos_obra', { obra_id: obra.id, descricao: 'Contrato principal', valor_centavos: 500000, status: 'ativo' })
    const addendum = db.save('contrato_aditivos', { contrato_id: contract.id, descricao: 'Aditivo 1', valor_centavos: 25000, status: 'solicitado' })
    expect(request.obra_id).toBe(obra.id)
    expect(addendum.contrato_id).toBe(contract.id)
    expect(db.get('obras', obra.id).centro_custo).toBe('CC-01')
  })

  it('consolida orcamento e custo por frente sem misturar os valores da obra', () => {
    const db = createDatabase()
    const empresa = db.save('empresas', { razao_social: 'Empresa', status: 'ativa' })
    const obra = db.save('obras', { empresa_id: empresa.id, nome: 'Residencial', status: 'ativa' })
    const hidraulica = db.save('frentes_obra', { obra_id: obra.id, nome: 'Hidraulica', ordem: 1, status: 'ativa' })
    const eletrica = db.save('frentes_obra', { obra_id: obra.id, nome: 'Eletrica', ordem: 2, status: 'ativa' })
    db.save('itens_orcamentarios', { obra_id: obra.id, frente_id: hidraulica.id, descricao: 'Tubos', unidade: 'm', quantidade: 10, valor_unitario_centavos: 100, tipo: 'material' })
    db.save('itens_orcamentarios', { obra_id: obra.id, frente_id: eletrica.id, descricao: 'Cabos', unidade: 'm', quantidade: 5, valor_unitario_centavos: 200, tipo: 'material' })
    db.save('contas', { tipo: 'pagar', empresa_id: empresa.id, obra_id: obra.id, frente_id: hidraulica.id, descricao: 'Compra hidraulica', competencia: '2026-08', vencimento: '2026-08-20', valor_centavos: 600, status: 'pendente' })
    const overview = db.workOverview(obra.id)
    expect(overview.frentes.find((item: any) => item.id === hidraulica.id)).toMatchObject({ orcado_centavos: 1000, comprometido_centavos: 600 })
    expect(overview.frentes.find((item: any) => item.id === eletrica.id)).toMatchObject({ orcado_centavos: 1000, comprometido_centavos: 0 })
  })
})
