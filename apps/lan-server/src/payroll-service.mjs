import domainCore from './domain-core.cjs'
const { payrollAmount, payrollPendingRows, buildPayrollOverview, createPayrollImportEngine, classifyPayrollOverviewLaunch } = domainCore
import { ConcurrencyService } from './concurrency-service.mjs'

function importNorm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
}
function importCpf(value) { return String(value || '').replace(/\D/g,'') }
function importKey(rowId, field) { return `${rowId}:${field}` }
function parseSummary(value) { try { return JSON.parse(value || '{}') } catch { return {} } }

export class PayrollService {
  constructor({ repository, now = () => new Date().toISOString() }) {
    if (!repository?.connection) throw new Error('Repositório LAN inválido para Folha.')
    this.repository = repository
    this.now = now
    this.concurrency = new ConcurrencyService({ db: repository.connection() })
    this.importEngine = createPayrollImportEngine({
      db: repository.connection(),
      save: (table,data) => repository.save(table,data),
      get: (table,id) => repository.get(table,id),
      ensureSheet: (employeeId,competencia) => this.ensureSheet(employeeId,competencia)
    })
  }

  get db() { return this.repository.connection() }

  ensureSheet(employeeId, competencia) {
    const employee = this.repository.get('funcionarios', Number(employeeId))
    if (!employee || employee.deleted_at || employee.status !== 'ativo') throw new Error('Funcionário ativo não encontrado.')
    const cargo = employee.cargo_id ? this.repository.get('cargos', employee.cargo_id) : null
    let sheet = this.db.prepare('SELECT * FROM folhas_pagamento WHERE empresa_id=? AND competencia=?').get(employee.empresa_id, competencia)
    const created = !sheet
    if (!sheet) sheet = this.repository.save('folhas_pagamento', { empresa_id: employee.empresa_id, competencia, status: 'aberta' })
    const paid = Number(this.db.prepare("SELECT COUNT(*) total FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? AND status='pago'").get(employee.id, competencia)?.total || 0)
    if (!paid) this.syncFixed(sheet, employee, cargo)
    const revision = this.concurrency.current('folhas_pagamento', sheet.id) || this.concurrency.initialize('folhas_pagamento', sheet.id)
    return { employee, cargo, sheet: { ...sheet, revision }, created }
  }

  syncFixed(sheet, employee, cargo) {
    const fixed = []
    const salary = Number(employee.salario_centavos || cargo?.salario_base_centavos || 0)
    if (salary) fixed.push({ tipo: 'salario', descricao: 'Salário base', valor: salary, natureza: 'credito', quinzena: 1 })

    const benefitMap = new Map()
    if (cargo) {
      const benefits = this.db.prepare(`
        SELECT cb.*,b.nome,b.tipo
        FROM cargo_beneficios cb JOIN beneficios b ON b.id=cb.beneficio_id
        WHERE cb.empresa_id=? AND cb.cargo_id=? AND cb.ativo=1 AND b.ativo=1
      `).all(employee.empresa_id, cargo.id)
      for (const benefit of benefits) {
        benefitMap.set(benefit.beneficio_id, {
          tipo: `beneficio_${benefit.beneficio_id}`,
          descricao: benefit.nome,
          valor: benefit.valor_centavos,
          natureza: benefit.natureza,
          quinzena: benefit.quinzena
        })
      }
    }

    const overrides = this.db.prepare(`
      SELECT fb.*,b.nome,b.tipo
      FROM funcionario_beneficios fb JOIN beneficios b ON b.id=fb.beneficio_id
      WHERE fb.empresa_id=? AND fb.funcionario_id=? AND b.ativo=1
        AND (fb.inicio IS NULL OR substr(fb.inicio,1,7)<=?)
        AND (fb.fim IS NULL OR substr(fb.fim,1,7)>=?)
      ORDER BY fb.beneficio_id,fb.inicio DESC
    `).all(employee.empresa_id, employee.id, sheet.competencia, sheet.competencia)

    const overridden = new Set()
    for (const benefit of overrides) {
      if (overridden.has(benefit.beneficio_id)) continue
      overridden.add(benefit.beneficio_id)
      benefitMap.set(benefit.beneficio_id, {
        tipo: `beneficio_${benefit.beneficio_id}`,
        descricao: benefit.nome,
        valor: benefit.valor_centavos,
        natureza: 'credito',
        quinzena: 1
      })
    }

    for (const benefit of benefitMap.values()) fixed.push(benefit)

    const benefitCatalog = new Map(this.db.prepare("SELECT id,nome,tipo FROM beneficios WHERE ativo=1 AND empresa_id=?").all(employee.empresa_id).map(item=>[Number(item.id),item]))
    const importedKeys = new Set(this.db.prepare("SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND origem='importacao'").all(sheet.id,employee.id).map(item=>classifyPayrollOverviewLaunch(item,benefitCatalog)))
    const find = this.db.prepare("SELECT id FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND tipo=? AND origem='cargo'")
    const insert = this.db.prepare(`
      INSERT INTO folha_lancamentos(
        empresa_id,folha_id,funcionario_id,tipo,descricao,natureza,quinzena,valor_centavos,origem,editavel,status,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,0,'pendente',CURRENT_TIMESTAMP)
    `)
    const update = this.db.prepare("UPDATE folha_lancamentos SET descricao=?,natureza=?,quinzena=?,valor_centavos=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pendente' AND importacao_linha_id IS NULL")
    for (const item of fixed) {
      const key = classifyPayrollOverviewLaunch(item,benefitCatalog)
      if (importedKeys.has(key)) continue
      const current = find.get(sheet.id, employee.id, item.tipo)
      if (current) update.run(item.descricao, item.natureza, item.quinzena, item.valor, current.id)
      else insert.run(employee.empresa_id, sheet.id, employee.id, item.tipo, item.descricao, item.natureza, item.quinzena, item.valor, 'cargo')
    }
  }

  getEmployee(payload) {
    const { employee, cargo, sheet } = this.ensureSheet(payload.funcionario_id, payload.competencia)
    const launches = this.db.prepare('SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? ORDER BY quinzena,editavel,tipo,id').all(sheet.id, employee.id)
    const payments = this.db.prepare('SELECT * FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? ORDER BY quinzena').all(employee.id, payload.competencia)
    return { employee, cargo, sheet, launches, payments }
  }

  saveVariable(payload) {
    const { employee, sheet } = this.ensureSheet(payload.funcionario_id, payload.competencia)
    const data = {
      id: payload.id,
      empresa_id: employee.empresa_id,
      folha_id: sheet.id,
      funcionario_id: employee.id,
      tipo: payload.tipo,
      descricao: payload.descricao,
      natureza: payload.natureza,
      quinzena: Number(payload.quinzena),
      valor_centavos: Math.max(0, Number(payload.valor_centavos) || 0),
      quantidade: payload.quantidade || null,
      data: payload.data || null,
      origem: 'variavel',
      editavel: 1,
      status: 'pendente'
    }
    if (data.id) {
      const current = this.repository.get('folha_lancamentos', data.id)
      if (!current || Number(current.empresa_id) !== Number(employee.empresa_id) || !current.editavel || current.status === 'pago') {
        throw new Error('Este lançamento não pode ser alterado.')
      }
    }
    return this.repository.save('folha_lancamentos', data)
  }

  removeVariable(id) {
    const current = this.repository.get('folha_lancamentos', Number(id))
    if (!current?.editavel || current.status === 'pago') throw new Error('Este lançamento não pode ser excluído.')
    this.db.prepare('DELETE FROM folha_lancamentos WHERE id=?').run(current.id)
    return true
  }

  confirm(payload) {
    this.db.exec('BEGIN IMMEDIATE;')
    try {
      const { employee, sheet, created } = this.ensureSheet(payload.funcionario_id, payload.competencia)
      if (!created) {
        this.concurrency.assertExpected('folhas_pagamento', sheet.id, payload.expectedRevision, sheet)
      }

      const quinzena = Number(payload.quinzena)
      const existing = this.db.prepare("SELECT id FROM pagamentos_funcionario WHERE funcionario_id=? AND competencia=? AND quinzena=? AND status='pago'").get(employee.id, payload.competencia, quinzena)
      if (existing) throw new Error('Esta quinzena já foi confirmada.')

      const rows = this.db.prepare("SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND quinzena=? AND status='pendente'").all(sheet.id, employee.id, quinzena)
      const amount = payrollAmount(rows)

      const payment = this.repository.save('pagamentos_funcionario', {
        empresa_id: employee.empresa_id,
        funcionario_id: employee.id,
        folha_id: sheet.id,
        competencia: payload.competencia,
        quinzena,
        valor_centavos: amount,
        data: payload.data,
        status: 'pago',
        observacoes: payload.observacoes || null,
        forma_pagamento: payload.forma_pagamento || 'PIX',
        confirmado_em: this.now()
      })
      this.db.prepare("UPDATE folha_lancamentos SET status='pago',updated_at=CURRENT_TIMESTAMP WHERE folha_id=? AND funcionario_id=? AND quinzena=? AND status='pendente'").run(sheet.id, employee.id, quinzena)
      const sheetRevision = created ? sheet.revision : this.concurrency.bump('folhas_pagamento', sheet.id)
      this.db.exec('COMMIT;')
      return { ...payment, sheetRevision }
    } catch (error) {
      try { this.db.exec('ROLLBACK;') } catch {}
      throw error
    }
  }

  overview(payload = {}) {
    const competencia = String(payload.competencia || '')
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new Error('Competência inválida para a visão geral da folha.')
    const empresaId = Number(payload.empresa_id) || null
    const obraId = Number(payload.obra_id) || null

    const employeeWhere = ["deleted_at IS NULL", "status='ativo'"]
    const employeeParams = []
    if (empresaId) { employeeWhere.push('empresa_id=?'); employeeParams.push(empresaId) }
    if (obraId) { employeeWhere.push('obra_atual_id=?'); employeeParams.push(obraId) }
    const employees = this.db.prepare(`SELECT * FROM funcionarios WHERE ${employeeWhere.join(' AND ')} ORDER BY nome COLLATE NOCASE`).all(...employeeParams)

    const benefitWhere = ['ativo=1']
    const benefitParams = []
    if (empresaId) { benefitWhere.push('empresa_id=?'); benefitParams.push(empresaId) }
    const benefits = this.db.prepare(`SELECT * FROM beneficios WHERE ${benefitWhere.join(' AND ')} ORDER BY nome COLLATE NOCASE`).all(...benefitParams)
    const employeeEntries = employees.map(employee => {
      const data = this.getEmployee({ funcionario_id: employee.id, competencia })
      return { employee: data.employee, cargo: data.cargo, launches: data.launches }
    })

    const accountWhere = ["c.deleted_at IS NULL", "c.tipo='pagar'", 'c.competencia=?']
    const accountParams = [competencia]
    if (empresaId) { accountWhere.push('c.empresa_id=?'); accountParams.push(empresaId) }
    if (obraId) { accountWhere.push('c.obra_id=?'); accountParams.push(obraId) }
    const accounts = this.db.prepare(`
      SELECT c.*, cf.nome AS categoria_nome
      FROM contas c
      LEFT JOIN categorias_financeiras cf ON cf.id=c.categoria_id
      WHERE ${accountWhere.join(' AND ')}
      ORDER BY c.vencimento, c.descricao COLLATE NOCASE, c.id
    `).all(...accountParams)

    return buildPayrollOverview({
      competencia,
      empresa_id: empresaId,
      obra_id: obraId,
      employeeEntries,
      accounts,
      benefits
    })
  }

  importPreview(payload) { return this.importEngine.preview(payload) }
  importCommit(payload) { return this.importEngine.commit(payload) }
  importHistory(limit) { return this.importEngine.history(limit) }
  importUndo(importacaoId) { return this.importEngine.undo(importacaoId) }

  importCompany(payload = {}) {
    const companyId=Number(payload.empresa_id)
    if(!Number.isSafeInteger(companyId)||companyId<=0) throw new Error('Selecione uma empresa específica antes de importar a planilha.')
    const company=this.repository.get('empresas',companyId)
    if(!company||company.deleted_at) throw new Error('Empresa da importação não encontrada.')
    return company
  }

  previewFixedLaunches(employee, competencia) {
    const sheet=this.db.prepare('SELECT * FROM folhas_pagamento WHERE empresa_id=? AND competencia=?').get(employee.empresa_id,competencia)
    if(sheet)return{sheet,launches:this.db.prepare('SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=?').all(sheet.id,employee.id)}
    const launches=[]
    const cargo=employee.cargo_id?this.repository.get('cargos',employee.cargo_id):null
    const salary=Number(employee.salario_centavos||cargo?.salario_base_centavos||0)
    if(salary)launches.push({id:null,tipo:'salario',descricao:'Salário base',natureza:'credito',quinzena:1,valor_centavos:salary,origem:'cadastro',editavel:0,status:'pendente'})
    const benefitMap=new Map()
    if(cargo){
      const benefits=this.db.prepare('SELECT cb.*,b.nome,b.tipo FROM cargo_beneficios cb JOIN beneficios b ON b.id=cb.beneficio_id WHERE cb.empresa_id=? AND cb.cargo_id=? AND cb.ativo=1 AND b.ativo=1').all(employee.empresa_id,cargo.id)
      for(const item of benefits)benefitMap.set(item.beneficio_id,{id:null,tipo:\`beneficio_\${item.beneficio_id}\`,descricao:item.nome,natureza:item.natureza,quinzena:item.quinzena,valor_centavos:item.valor_centavos,origem:'cadastro',editavel:0,status:'pendente'})
    }
    const overrides=this.db.prepare(\`SELECT fb.*,b.nome,b.tipo FROM funcionario_beneficios fb JOIN beneficios b ON b.id=fb.beneficio_id WHERE fb.empresa_id=? AND fb.funcionario_id=? AND b.ativo=1 AND (fb.inicio IS NULL OR substr(fb.inicio,1,7)<=?) AND (fb.fim IS NULL OR substr(fb.fim,1,7)>=?) ORDER BY fb.beneficio_id,fb.inicio DESC\`).all(employee.empresa_id,employee.id,competencia,competencia)
    const seen=new Set()
    for(const item of overrides){
      if(seen.has(item.beneficio_id))continue
      seen.add(item.beneficio_id)
      benefitMap.set(item.beneficio_id,{id:null,tipo:\`beneficio_\${item.beneficio_id}\`,descricao:item.nome,natureza:'credito',quinzena:1,valor_centavos:item.valor_centavos,origem:'cadastro',editavel:0,status:'pendente'})
    }
    launches.push(...benefitMap.values())
    return{sheet:null,launches}
  }

  matchImportEmployee(row, companyId, resolution = {}) {
    if(resolution.employee_id){
      const employee=this.repository.get('funcionarios',Number(resolution.employee_id))
      if(employee&&!employee.deleted_at&&Number(employee.empresa_id)===Number(companyId))return{kind:'match',employee,candidates:[employee],resolved:true}
    }
    const cpf=importCpf(row.cpf)
    if(cpf){
      const employee=this.db.prepare("SELECT * FROM funcionarios WHERE empresa_id=? AND replace(replace(replace(cpf,'.',''),'-',''),'/','')=? AND deleted_at IS NULL").get(companyId,cpf)
      if(employee)return{kind:'match',employee,candidates:[employee],resolved:false}
    }
    const name=importNorm(row.funcionario)
    const candidates=this.db.prepare('SELECT * FROM funcionarios WHERE empresa_id=? AND deleted_at IS NULL ORDER BY nome COLLATE NOCASE').all(companyId).filter(item=>importNorm(item.nome)===name)
    if(candidates.length===1)return{kind:'match',employee:candidates[0],candidates,resolved:false}
    if(candidates.length>1)return{kind:'ambiguous',employee:null,candidates}
    if(resolution.employee_action==='create'&&String(row.funcionario||'').trim())return{kind:'create',employee:null,candidates:[],resolved:true}
    if(resolution.employee_action==='skip')return{kind:'skip',employee:null,candidates:[],resolved:true}
    return{kind:'missing',employee:null,candidates:[]}
  }

  importPreview(payload = {}) {
    const competencia=String(payload.competencia||'')
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia))throw new Error('Competência inválida para importação.')
    const company=this.importCompany(payload)
    const obraId=Number(payload.obra_id)||null
    if(obraId){
      const work=this.repository.get('obras',obraId)
      if(!work||work.deleted_at||Number(work.empresa_id)!==Number(company.id))throw new Error('A obra selecionada não pertence à empresa.')
    }
    const file=payload.file||{}
    if(!file.hash||!file.sheet)throw new Error('Arquivo de importação inválido.')
    const importScope=\`payroll:\${file.sheet}:\${competencia}\`
    const duplicate=this.db.prepare("SELECT id FROM importacoes WHERE hash=? AND aba=? AND status='concluida'").get(file.hash,importScope)
    const benefits=this.db.prepare('SELECT * FROM beneficios WHERE empresa_id=? AND ativo=1 ORDER BY nome COLLATE NOCASE').all(company.id)
    const resolutions=payload.resolutions||{}
    const resultRows=[],unresolved=[],blockers=[]
    if(duplicate)blockers.push({kind:'duplicate_import',message:'Este arquivo e esta aba já foram importados para esta competência.',importacao_id:duplicate.id})

    for(const row of Array.isArray(payload.rows)?payload.rows:[]){
      if(row.kind==='employee'){
        const match=this.matchImportEmployee(row,company.id,resolutions[row.id]||{})
        const out={...row,match:{kind:match.kind,employee:match.employee?{id:match.employee.id,nome:match.employee.nome,cpf:match.employee.cpf}:null,candidates:match.candidates.map(item=>({id:item.id,nome:item.nome,cpf:item.cpf}))},conflicts:[],status:'ready'}
        if(match.kind==='missing'||match.kind==='ambiguous'){
          const issue={key:row.id,kind:match.kind==='missing'?'employee_not_found':'employee_ambiguous',row_id:row.id,message:match.kind==='missing'?\`Funcionário "\${row.funcionario}" não encontrado.\`:\`Mais de um cadastro corresponde a "\${row.funcionario}".\`}
          out.conflicts.push(issue);unresolved.push(issue);out.status='conflict';resultRows.push(out);continue
        }
        if(match.kind==='skip'){out.status='skip';resultRows.push(out);continue}
        if(match.kind==='create'){
          const cpf=importCpf(row.cpf)
          if(cpf&&this.db.prepare('SELECT id FROM funcionarios WHERE empresa_id=? AND cpf=? AND deleted_at IS NULL').get(company.id,cpf)){
            const issue={key:row.id,kind:'cpf_conflict',row_id:row.id,message:'O CPF da linha já pertence a outro funcionário.'}
            out.conflicts.push(issue);blockers.push(issue);out.status='blocked'
          }
          resultRows.push(out);continue
        }
        const employee=match.employee
        const fixed=this.previewFixedLaunches(employee,competencia)
        const payments=this.db.prepare("SELECT * FROM pagamentos_funcionario WHERE empresa_id=? AND funcionario_id=? AND competencia=? AND status='pago'").all(company.id,employee.id,competencia)
        if(fixed.sheet&&fixed.sheet.status!=='aberta'){
          const issue={key:row.id,kind:'closed_sheet',row_id:row.id,message:'A folha desta competência não está aberta.'}
          out.conflicts.push(issue);blockers.push(issue);out.status='blocked'
        }
        if(payments.length){
          const issue={key:row.id,kind:'paid_employee',row_id:row.id,message:'Este funcionário já possui pagamento confirmado na competência.'}
          out.conflicts.push(issue);blockers.push(issue);out.status='blocked'
        }
        const currentRow=payrollOverviewEmployeeRow({employee,cargo:employee.cargo_id?this.repository.get('cargos',employee.cargo_id):null,launches:fixed.launches,benefits})
        const currentValues=payrollImportCurrentValues(currentRow)
        for(const component of payrollImportComponents(row.values)){
          const current=Number(currentValues[component.field]||0)
          if(current===component.valor_centavos)continue
          if(current>0){
            const key=importKey(row.id,component.field),resolution=resolutions[key]
            const issue={key,kind:'value_conflict',row_id:row.id,field:component.field,label:component.descricao,current_centavos:current,imported_centavos:component.valor_centavos,resolution:resolution||null,message:\`\${component.descricao}: atual e planilha são diferentes.\`}
            out.conflicts.push(issue)
            if(!['use_import','keep_current'].includes(resolution))unresolved.push(issue)
          }
        }
        if(out.status!=='blocked'&&out.conflicts.length)out.status='conflict'
        resultRows.push(out)
      }else if(row.kind==='expense'){
        const existing=this.db.prepare(\`SELECT c.*,cf.nome categoria_nome FROM contas c LEFT JOIN categorias_financeiras cf ON cf.id=c.categoria_id WHERE c.empresa_id=? AND c.competencia=? AND c.tipo='pagar' AND c.deleted_at IS NULL AND lower(c.descricao)=lower(?) ORDER BY c.id\`).all(company.id,competencia,row.descricao)
        const same=existing.find(item=>Number(item.valor_centavos)===Number(row.valor_centavos))
        const out={...row,existing:existing.map(item=>({id:item.id,descricao:item.descricao,valor_centavos:item.valor_centavos,status:item.status})),conflicts:[],status:'ready'}
        if(same)out.status='same'
        else if(existing.length){
          const key=importKey(row.id,'valor_despesa'),resolution=resolutions[key]
          const issue={key,kind:'expense_conflict',row_id:row.id,field:'valor_despesa',current_centavos:Number(existing[0].valor_centavos),imported_centavos:Number(row.valor_centavos),resolution:resolution||null,message:\`\${row.descricao}: já existe conta com outro valor.\`}
          out.conflicts.push(issue);out.status='conflict'
          if(!['use_import','keep_current'].includes(resolution))unresolved.push(issue)
          if(['pago','recebido','cancelado'].includes(String(existing[0].status||''))&&resolution==='use_import'){
            const locked={...issue,kind:'locked_expense',message:'A conta existente não pode ser sobrescrita no status atual.'}
            blockers.push(locked);out.status='blocked'
          }
        }
        resultRows.push(out)
      }
    }
    return{competencia,empresa:{id:company.id,nome:company.nome_fantasia||company.razao_social},obra_id:obraId,file:{name:file.name||'',hash:file.hash,sheet:file.sheet},mode:payload.mode||'universal',rows:resultRows,unresolved,blockers,summary:{employees:resultRows.filter(row=>row.kind==='employee').length,expenses:resultRows.filter(row=>row.kind==='expense').length,conflicts:resultRows.reduce((sum,row)=>sum+(row.conflicts?.length||0),0),unresolved:unresolved.length,blockers:blockers.length},canCommit:!duplicate&&unresolved.length===0&&blockers.length===0&&resultRows.length>0}
  }

  importCategory(name) {
    const text=String(name||'').trim()
    const fallback=/simples|\bdas\b|darf|impost|tribut/i.test(text)?'Impostos':/contab/i.test(text)?'Serviços terceiros':'Outras despesas'
    const desired=text||fallback
    let category=this.db.prepare('SELECT * FROM categorias_financeiras WHERE lower(nome)=lower(?)').get(desired)
    if(!category)category=this.db.prepare('SELECT * FROM categorias_financeiras WHERE lower(nome)=lower(?)').get(fallback)
    if(!category)category=this.repository.save('categorias_financeiras',{nome:desired,natureza:'despesa',grupo_dre:/impost|tribut/i.test(desired)?'tributos':'operacional',ativa:1})
    return category
  }

  importCommit(payload = {}) {
    const preview=this.importPreview(payload)
    if(!preview.canCommit)throw new Error('Resolva os conflitos da prévia antes de confirmar a importação.')
    const company=this.repository.get('empresas',preview.empresa.id)
    const resolutions=payload.resolutions||{},file=payload.file||{},scope=\`payroll:\${file.sheet}:\${preview.competencia}\`
    this.db.exec('BEGIN IMMEDIATE;')
    try{
      if(this.db.prepare("SELECT id FROM importacoes WHERE hash=? AND aba=? AND status='concluida'").get(file.hash,scope))throw new Error('Esta planilha já foi importada para esta competência.')
      const importedResult=this.db.prepare("INSERT INTO importacoes(arquivo,hash,aba,status,resumo) VALUES (?,?,?,?,?)").run(file.name||'planilha',file.hash,scope,'processando','{}')
      const importId=Number(importedResult.lastInsertRowid)
      const rawInsert=this.db.prepare('INSERT INTO importacao_linhas(importacao_id,competencia,celula,tipo,nome_origem,valor_centavos,dados_brutos,entidade_tipo,entidade_id,status) VALUES (?,?,?,?,?,?,?,?,?,?)')
      let created=0,updated=0,ignored=0,employeesCreated=0,expensesCreated=0
      for(const row of preview.rows){
        if(row.status==='skip'){ignored++;continue}
        if(row.kind==='employee'){
          let employee=row.match?.employee?this.repository.get('funcionarios',row.match.employee.id):null
          if(!employee){
            const resolution=resolutions[row.id]||{}
            if(resolution.employee_action!=='create'){ignored++;continue}
            employee=this.repository.save('funcionarios',{empresa_id:company.id,obra_atual_id:preview.obra_id||null,nome:String(row.funcionario||'').trim(),cpf:importCpf(row.cpf)||null,status:'ativo',salario_centavos:0})
            employeesCreated++
          }
          const data=this.ensureSheet(employee.id,preview.competencia)
          const benefits=this.db.prepare('SELECT * FROM beneficios WHERE empresa_id=? AND ativo=1').all(company.id)
          for(const component of payrollImportComponents(row.values)){
            const launches=this.db.prepare('SELECT * FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? ORDER BY id').all(data.sheet.id,employee.id)
            const overviewRow=payrollOverviewEmployeeRow({employee,cargo:data.cargo,launches,benefits})
            const current=Number(payrollImportCurrentValues(overviewRow)[component.field]||0)
            const resolution=current>0&&current!==component.valor_centavos?resolutions[importKey(row.id,component.field)]:'use_import'
            const sources=overviewRow.sources?.[component.key]||[]
            const before=sources.map(source=>source.id?this.repository.get('folha_lancamentos',source.id):null).filter(Boolean)
            if(current===component.valor_centavos||resolution==='keep_current'){
              rawInsert.run(importId,preview.competencia,row.cell,'folha',employee.nome,component.valor_centavos,JSON.stringify({row_id:row.id,field:component.field,operation:'none',before}),sources.length?'folha_lancamentos':null,sources[0]?.id||null,current===component.valor_centavos?'sem_alteracao':'ignorado')
              ignored++;continue
            }
            const raw=rawInsert.run(importId,preview.competencia,row.cell,'folha',employee.nome,component.valor_centavos,JSON.stringify({row_id:row.id,field:component.field,operation:sources.length?'update':'create',before}),'folha_lancamentos',null,'importado')
            const lineId=Number(raw.lastInsertRowid)
            let entityId=null
            if(sources.length){
              const ids=sources.map(source=>Number(source.id)).filter(Boolean)
              if(ids.length){
                this.db.prepare("UPDATE folha_lancamentos SET valor_centavos=?,importacao_linha_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pendente'").run(component.valor_centavos,lineId,ids[0])
                for(const id of ids.slice(1))this.db.prepare("UPDATE folha_lancamentos SET valor_centavos=0,importacao_linha_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pendente'").run(lineId,id)
                entityId=ids[0];updated++
              }
            }else{
              const launch=this.repository.save('folha_lancamentos',{empresa_id:company.id,folha_id:data.sheet.id,funcionario_id:employee.id,tipo:component.tipo,descricao:component.descricao,natureza:component.natureza,quinzena:component.quinzena,valor_centavos:component.valor_centavos,origem:'importacao',editavel:0,status:'pendente'})
              this.db.prepare('UPDATE folha_lancamentos SET importacao_linha_id=? WHERE id=?').run(lineId,launch.id)
              entityId=launch.id;created++
            }
            this.db.prepare('UPDATE importacao_linhas SET entidade_id=?,dados_brutos=? WHERE id=?').run(entityId,JSON.stringify({row_id:row.id,field:component.field,operation:sources.length?'update':'create',before,entity_ids:sources.map(source=>source.id).filter(Boolean).concat(sources.length?[]:[entityId])}),lineId)
          }
        }else if(row.kind==='expense'){
          const existing=this.db.prepare("SELECT * FROM contas WHERE empresa_id=? AND competencia=? AND tipo='pagar' AND deleted_at IS NULL AND lower(descricao)=lower(?) ORDER BY id LIMIT 1").get(company.id,preview.competencia,row.descricao)
          if(existing&&Number(existing.valor_centavos)===Number(row.valor_centavos)){
            rawInsert.run(importId,preview.competencia,row.cell,'despesa',row.descricao,row.valor_centavos,JSON.stringify({row_id:row.id,operation:'none',before:existing}),'contas',existing.id,'sem_alteracao');ignored++;continue
          }
          const resolution=existing?resolutions[importKey(row.id,'valor_despesa')]:'use_import'
          if(existing&&resolution==='keep_current'){
            rawInsert.run(importId,preview.competencia,row.cell,'despesa',row.descricao,row.valor_centavos,JSON.stringify({row_id:row.id,operation:'none',before:existing}),'contas',existing.id,'ignorado');ignored++;continue
          }
          const category=this.importCategory(row.categoria)
          const raw=rawInsert.run(importId,preview.competencia,row.cell,'despesa',row.descricao,row.valor_centavos,JSON.stringify({row_id:row.id,operation:existing?'update':'create',before:existing||null}),'contas',null,'importado')
          const lineId=Number(raw.lastInsertRowid)
          let account
          if(existing){
            account=this.repository.save('contas',{...existing,id:existing.id,categoria_id:category?.id||existing.categoria_id,obra_id:preview.obra_id||existing.obra_id||null,vencimento:row.vencimento||existing.vencimento,valor_bruto_centavos:row.valor_centavos,valor_centavos:row.valor_centavos,origem_tipo:'importacao_folha',origem_id:importId})
            updated++
          }else{
            account=this.repository.save('contas',{tipo:'pagar',empresa_id:company.id,obra_id:preview.obra_id||null,categoria_id:category?.id||null,descricao:row.descricao,competencia:preview.competencia,vencimento:row.vencimento||\`\${preview.competencia}-20\`,valor_bruto_centavos:row.valor_centavos,valor_centavos:row.valor_centavos,status:'pendente',origem_tipo:'importacao_folha',origem_id:importId})
            created++;expensesCreated++
          }
          this.db.prepare('UPDATE importacao_linhas SET entidade_id=?,dados_brutos=? WHERE id=?').run(account.id,JSON.stringify({row_id:row.id,operation:existing?'update':'create',before:existing||null,importacao_linha_id:lineId}),lineId)
        }
      }
      const summary={competencia:preview.competencia,mode:preview.mode,created,updated,ignored,employees_created:employeesCreated,expenses_created:expensesCreated,file:file.name||'',sheet:file.sheet}
      this.db.prepare("UPDATE importacoes SET status='concluida',resumo=?,concluida_em=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(summary),importId)
      this.db.exec('COMMIT;')
      return{importacao_id:importId,...summary}
    }catch(error){try{this.db.exec('ROLLBACK;')}catch{};throw error}
  }

  importHistory(limit = 20) {
    return this.db.prepare("SELECT * FROM importacoes WHERE aba LIKE 'payroll:%' ORDER BY id DESC LIMIT ?").all(Math.max(1,Math.min(100,Number(limit)||20))).map(item=>({...item,resumo_obj:parseSummary(item.resumo)}))
  }

  importUndo(importacaoId) {
    const imported=this.db.prepare('SELECT * FROM importacoes WHERE id=?').get(Number(importacaoId))
    if(!imported||!String(imported.aba||'').startsWith('payroll:')||imported.status!=='concluida')throw new Error('Importação concluída não encontrada.')
    const lines=this.db.prepare('SELECT * FROM importacao_linhas WHERE importacao_id=? ORDER BY id DESC').all(imported.id)
    this.db.exec('BEGIN IMMEDIATE;')
    try{
      for(const line of lines){
        if(line.status!=='importado')continue
        const detail=parseSummary(line.dados_brutos)
        if(line.entidade_tipo==='folha_lancamentos'){
          const ids=(detail.entity_ids||[line.entidade_id]).map(Number).filter(Boolean)
          if(detail.operation==='create'){
            const current=this.repository.get('folha_lancamentos',ids[0])
            if(current&&(current.status!=='pendente'||Number(current.importacao_linha_id)!==Number(line.id)))throw new Error('A importação não pode ser desfeita porque um lançamento já foi alterado ou pago.')
            if(current)this.db.prepare('DELETE FROM folha_lancamentos WHERE id=?').run(current.id)
          }else if(detail.operation==='update'){
            for(const before of detail.before||[]){
              const current=this.repository.get('folha_lancamentos',before.id)
              if(!current||current.status!=='pendente'||Number(current.importacao_linha_id)!==Number(line.id))throw new Error('A importação não pode ser desfeita porque um lançamento já foi alterado ou pago.')
              this.db.prepare('UPDATE folha_lancamentos SET valor_centavos=?,importacao_linha_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(Number(before.valor_centavos)||0,before.importacao_linha_id||null,before.id)
            }
          }
        }else if(line.entidade_tipo==='contas'){
          const current=this.repository.get('contas',line.entidade_id)
          if(!current)continue
          const paid=Number(this.db.prepare('SELECT COUNT(*) total FROM pagamentos_conta WHERE conta_id=?').get(current.id)?.total||0)
          if(paid||String(current.origem_tipo||'')!=='importacao_folha'||Number(current.origem_id)!==Number(imported.id))throw new Error('A importação não pode ser desfeita porque uma conta já foi alterada ou paga.')
          if(detail.operation==='create')this.db.prepare('DELETE FROM contas WHERE id=?').run(current.id)
          else if(detail.operation==='update'&&detail.before){
            const before=detail.before
            this.db.prepare('UPDATE contas SET categoria_id=?,obra_id=?,vencimento=?,valor_bruto_centavos=?,valor_centavos=?,origem_tipo=?,origem_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(before.categoria_id||null,before.obra_id||null,before.vencimento,Number(before.valor_bruto_centavos)||0,Number(before.valor_centavos)||0,before.origem_tipo||null,before.origem_id||null,current.id)
          }
        }
      }
      this.db.prepare("UPDATE importacoes SET status='desfeita',resumo=? WHERE id=?").run(JSON.stringify({...parseSummary(imported.resumo),undone_at:this.now()}),imported.id)
      this.db.exec('COMMIT;')
      return{importacao_id:imported.id,status:'desfeita'}
    }catch(error){try{this.db.exec('ROLLBACK;')}catch{};throw error}
  }

  pending(competencia) {
    const employees = this.db.prepare("SELECT * FROM funcionarios WHERE deleted_at IS NULL AND status='ativo' ORDER BY nome COLLATE NOCASE").all()
    const result = []
    for (const employee of employees) {
      const data = this.getEmployee({ funcionario_id: employee.id, competencia })
      result.push(...payrollPendingRows({ employee, cargo: data.cargo, competencia, launches: data.launches, payments: data.payments }))
    }
    return result
  }
}
