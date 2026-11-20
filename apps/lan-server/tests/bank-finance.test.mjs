import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import bankModule from '../src/bank-finance.cjs'

const { BankFinanceService, parseFile, moneyCents } = bankModule
const migrations = path.resolve(import.meta.dirname, '../migrations/032_finance_bank_import.sql')
function fixture() {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys=ON')
  db.exec('CREATE TABLE empresas(id INTEGER PRIMARY KEY, deleted_at TEXT)')
  db.exec('CREATE TABLE contas(id INTEGER PRIMARY KEY, empresa_id INTEGER)')
  db.exec('CREATE TABLE pagamentos_conta(id INTEGER PRIMARY KEY, conta_id INTEGER)')
  db.exec("INSERT INTO empresas(id) VALUES (1),(2)")
  db.exec(fs.readFileSync(migrations,'utf8'))
  db.exec(fs.readFileSync(path.resolve(import.meta.dirname, '../migrations/033_reconciliacao_bancaria.sql'),'utf8'))
  db.exec(fs.readFileSync(path.resolve(import.meta.dirname, '../migrations/035_finance_bank_period_closures.sql'),'utf8'))
  return { db, service:new BankFinanceService({db}) }
}
const account = service => service.saveAccount({empresaId:1,nome:'Conta operacional',bancoNome:'Banco de teste',saldoInicialCentavos:120000,saldoReferenciaData:'2026-11-01',requestId:'client-test-001'})
const input = (id, format, content, extra={}) => ({empresaId:1,contaBancariaId:id,fileName:'extrato.'+format,format,contentBase64:Buffer.from(content).toString('base64'),...extra})

test('B1 persiste conta bancária sem criar contas operacionais e preserva idempotência', () => {
  const f=fixture()
  try {
    const one=account(f.service)
    const again=account(f.service)
    assert.equal(one.id,again.id)
    assert.equal(one.saldo_inicial_centavos,120000)
    assert.equal(f.service.listAccounts({empresaId:1}).length,1)
    assert.deepEqual(f.service.listAccounts({empresaId:2}),[])
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM contas').get().n,0)
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM pagamentos_conta').get().n,0)
    assert.throws(()=>f.service.listTransactions({empresaId:2,contaBancariaId:one.id}),/não encontrada nesta empresa/)
    assert.throws(()=>f.service.saveAccount({empresaId:2,id:one.id,nome:one.nome,bancoNome:'Outro',saldoInicialCentavos:120000,saldoReferenciaData:'2026-11-01'}),/não encontrada nesta empresa/)
  } finally { f.db.close() }
})

test('B2 CSV com prévia: importação atômica e repetição não duplica movimentações', () => {
  const f=fixture()
  try {
    const a=account(f.service)
    const file=input(a.id,'csv','Data;Descrição;Valor\n18/11/2026;Compra de materiais;-1.234,56\n19/11/2026;Recebimento;2.500,00\n')
    const before=f.service.previewImport(file)
    assert.equal(before.importable,2)
    assert.equal(before.duplicates,0)
    assert.equal(before.invalid,0)
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM transacoes_bancarias').get().n,0)
    const first=f.service.confirmImport({...file,previewHash:before.previewHash})
    assert.equal(first.imported,2)
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM transacoes_bancarias').get().n,2)
    const again=f.service.confirmImport({...file,previewHash:before.previewHash})
    assert.equal(again.duplicateFile,true)
    assert.equal(again.imported,0)
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM extrato_importacoes').get().n,1)
    const rows=f.service.listTransactions({empresaId:1,contaBancariaId:a.id})
    assert.deepEqual(rows.map(x=>x.valor_centavos).sort((x,y)=>x-y),[-123456,250000])
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM contas').get().n,0)
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM pagamentos_conta').get().n,0)
  } finally { f.db.close() }
})

test('B2 OFX usa FITID, aceita transações iguais com identificadores diferentes e ignora repetidas', () => {
  const f=fixture()
  try {
    const a=account(f.service)
    const ofx='<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20261118000000<TRNAMT>-12.50<FITID>PIX-A<NAME>PIX</STMTTRN><STMTTRN><DTPOSTED>20261118000000<TRNAMT>-12.50<FITID>PIX-B<NAME>PIX</STMTTRN></BANKTRANLIST></OFX>'
    const first=input(a.id,'ofx',ofx)
    const p=f.service.previewImport(first)
    assert.equal(p.importable,2)
    f.service.confirmImport({...first,previewHash:p.previewHash})
    const updated=ofx.replace('PIX-A','PIX-C')
    const second=input(a.id,'ofx',updated)
    const p2=f.service.previewImport(second)
    assert.equal(p2.importable,1)
    assert.equal(p2.duplicates,1)
    const saved=f.service.confirmImport({...second,previewHash:p2.previewHash})
    assert.equal(saved.imported,1)
    assert.equal(saved.duplicates,1)
    assert.equal(f.service.listTransactions({empresaId:1,contaBancariaId:a.id}).length,3)
  } finally { f.db.close() }
})

test('B2 nunca confirma prévia desatualizada e exige confirmação explícita para ignorar linhas inválidas', () => {
  const f=fixture()
  try {
    const a=account(f.service)
    const file=input(a.id,'csv','Data;Descricao;Valor\n2026-11-18;PIX recebido;50,00\n31/02/2026;Data impossível;10,00\n')
    const p=f.service.previewImport(file)
    assert.equal(p.invalid,1)
    assert.equal(p.importable,1)
    assert.throws(()=>f.service.confirmImport({...file,previewHash:'fake'}),/mudou/)
    assert.throws(()=>f.service.confirmImport({...file,previewHash:p.previewHash}),/linhas inválidas/)
    assert.equal(f.db.prepare('SELECT COUNT(*) n FROM transacoes_bancarias').get().n,0)
    const saved=f.service.confirmImport({...file,previewHash:p.previewHash,acceptInvalid:true})
    assert.equal(saved.imported,1)
    assert.equal(saved.rejected,1)
  } finally { f.db.close() }
})

test('B1 rejeita alteração retroativa do saldo após importar', () => {
  const f=fixture()
  try {
    const a=account(f.service)
    const file=input(a.id,'csv','Data;Descricao;Valor\n18/11/2026;Pago;10,00\n')
    const p=f.service.previewImport(file)
    f.service.confirmImport({...file,previewHash:p.previewHash})
    assert.throws(()=>f.service.saveAccount({id:a.id,empresaId:1,nome:a.nome,bancoNome:a.banco_nome,saldoInicialCentavos:100,saldoReferenciaData:a.saldo_referencia_data}),/não podem mudar/)
  } finally { f.db.close() }
})

test('parser de moedas evita arredondamento impreciso em centavos', () => {
  assert.equal(moneyCents('1.234,56'),123456)
  assert.equal(moneyCents('-5.000,00'),-500000)
  const csv=parseFile({format:'csv',content:'Data;Descrição;Valor\n18/11/2026;Despesa;-10,10\n'})
  assert.equal(csv.rows[0].amountCents,-1010)
})

test('B1 permite editar dados, desativar conta preservando histórico e reativar', () => {
  const f=fixture()
  try {
    const original=account(f.service)
    const saved=f.service.saveAccount({id:original.id,empresaId:1,nome:'Conta atualizada',bancoNome:'Outro banco',agencia:'0123',contaIdentificador:'345-6',tipoConta:'corrente',saldoInicialCentavos:120000,saldoReferenciaData:'2026-11-01',ativo:false})
    assert.equal(saved.nome,'Conta atualizada')
    assert.equal(saved.ativo,0)
    const editedWithoutToggle=f.service.saveAccount({id:original.id,empresaId:1,nome:'Conta atualizada novamente',bancoNome:'Outro banco',saldoInicialCentavos:120000,saldoReferenciaData:'2026-11-01'})
    assert.equal(editedWithoutToggle.ativo,0,'editar dados bancários não pode reativar conta inativa sem solicitação')
    assert.equal(f.service.listAccounts({empresaId:1}).length,1)
    assert.throws(()=>f.service.previewImport(input(original.id,'csv','Data;Descricao;Valor\n18/11/2026;Compra;-1,00\n')),/Ative a conta/)
    const reopened=f.service.saveAccount({id:original.id,empresaId:1,nome:'Conta atualizada',bancoNome:'Outro banco',agencia:'0123',contaIdentificador:'345-6',tipoConta:'corrente',saldoInicialCentavos:120000,saldoReferenciaData:'2026-11-01',ativo:true})
    assert.equal(reopened.ativo,1)
  }finally{f.db.close()}
})

test('B2 permite configurar colunas CSV sem cabeçalho padronizado', () => {
  const f=fixture()
  try {
    const a=account(f.service)
    const file=input(a.id,'csv','Quando;Referência bancária;Total\n18/11/2026;Compra de aço;-155,90\n',{mapping:{date:0,description:1,amount:2},format:'csv'})
    const preview=f.service.previewImport(file)
    assert.equal(preview.importable,1)
    assert.equal(preview.mapping.description,1)
    const result=f.service.confirmImport({...file,previewHash:preview.previewHash})
    assert.equal(result.imported,1)
  }finally{f.db.close()}
})


test('B4 pagina mais de 500 movimentações sem duplicar nem omitir registros na exportação',()=>{
 const f=fixture()
 try{
  const bank=account(f.service)
  const insert=f.db.prepare('INSERT INTO transacoes_bancarias(empresa_id,conta_bancaria_id,importacao_id,chave_transacao,data,descricao,valor_centavos,origem_identificador,created_at) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)')
  const imp=f.db.prepare("INSERT INTO extrato_importacoes(empresa_id,conta_bancaria_id,nome_arquivo,arquivo_sha256,formato,total_linhas,importadas,duplicadas,rejeitadas) VALUES(?,?,'mass.csv','paginacao-mass','csv',505,505,0,0)").run(1,bank.id)
  for(let i=0;i<505;i++)insert.run(1,bank.id,Number(imp.lastInsertRowid),'mass-'+i,'2026-11-18','Lançamento '+i,-(100+i),'mass-'+i)
  const first=f.service.listTransactions({empresaId:1,contaBancariaId:bank.id,limit:500,offset:0})
  const next=f.service.listTransactions({empresaId:1,contaBancariaId:bank.id,limit:500,offset:500})
  assert.equal(first.length,500);assert.equal(next.length,5)
  assert.equal(new Set([...first,...next].map(x=>x.id)).size,505)
  assert.throws(()=>f.service.listTransactions({empresaId:1,contaBancariaId:bank.id,limit:999999}),/limite|página/i)
 }finally{f.db.close()}
})
