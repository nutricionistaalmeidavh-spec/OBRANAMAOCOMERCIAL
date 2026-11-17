// Domain service shared by the Desktop SQLite and self-hosted LAN SQLite.
// Received documents are archived and classified; this service never issues
// invoices, creates payable accounts or moves stock.
function createReceivedNotesService(db) {
  if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') throw new Error('Banco de notas indisponível.')

  const positiveId = (value, label) => {
    const id=Number(value)
    if (!Number.isSafeInteger(id)||id<=0) throw new Error(label+' inválido(a).')
    return id
  }
  const optionalId = (value,label) => value===null||value===undefined||value===''?null:positiveId(value,label)
  const required = (value,label,max=240) => {
    const text=String(value??'').trim()
    if (!text || text.length>max) throw new Error(label+' deve ser informado(a), com até '+max+' caracteres.')
    return text
  }
  const cents = (value,label) => {
    const n=Number(value)
    if (!Number.isSafeInteger(n)||n<0) throw new Error(label+' deve ser informado em centavos.')
    return n
  }
  const date = (value,label) => {
    const v=required(value,label,10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v) throw new Error(label+' inválida.')
    return v
  }
  const row = (table,id,label) => {
    const found=db.prepare('SELECT * FROM '+table+' WHERE id=?').get(positiveId(id,label))
    if (!found||found.deleted_at) throw new Error(label+' não encontrado(a).')
    return found
  }
  const sameWork = (table,id,workId,label) => {
    if (!id) return null
    const found=row(table,id,label)
    if (Number(found.obra_id)!==workId) throw new Error(label+' deve pertencer à mesma obra.')
    return found
  }
  const read = id => {
    const nota=db.prepare('SELECT * FROM notas_recebidas WHERE id=? AND deleted_at IS NULL').get(positiveId(id,'Nota'))
    if (!nota) throw new Error('Nota recebida não encontrada.')
    return { ...nota, itens:db.prepare('SELECT * FROM nota_recebida_itens WHERE nota_id=? ORDER BY id').all(nota.id) }
  }
  const list = obraId => {
    const id=positiveId(obraId,'Obra')
    return db.prepare('SELECT n.*,f.nome AS fornecedor_nome,(SELECT COUNT(*) FROM nota_recebida_itens i WHERE i.nota_id=n.id) AS quantidade_itens FROM notas_recebidas n JOIN fornecedores f ON f.id=n.fornecedor_id WHERE n.obra_id=? AND n.deleted_at IS NULL ORDER BY n.emissao DESC,n.id DESC').all(id)
  }
  const summary = obraId => {
    const id=positiveId(obraId,'Obra')
    const grouped=db.prepare("SELECT i.frente_id,i.subfrente_id,COALESCE(f.nome,'Sem etapa') AS etapa_nome,COALESCE(s.nome,'Sem subetapa') AS subetapa_nome,COUNT(*) AS quantidade_itens,SUM(i.valor_total_centavos) AS valor_centavos FROM nota_recebida_itens i JOIN notas_recebidas n ON n.id=i.nota_id LEFT JOIN frentes_obra f ON f.id=i.frente_id LEFT JOIN subfrentes_obra s ON s.id=i.subfrente_id WHERE n.obra_id=? AND n.deleted_at IS NULL GROUP BY i.frente_id,i.subfrente_id ORDER BY etapa_nome,subetapa_nome").all(id)
    const byStage=new Map()
    for (const entry of grouped) {
      const key=entry.frente_id??'none'
      if (!byStage.has(key)) byStage.set(key,{frente_id:entry.frente_id,nome:entry.etapa_nome,valor_centavos:0})
      byStage.get(key).valor_centavos+=Number(entry.valor_centavos)
    }
    return { total_centavos:grouped.reduce((s,x)=>s+Number(x.valor_centavos),0), etapas:[...byStage.values()], subetapas:grouped }
  }
  // P2: orçamento da etapa versus valores documentados em notas recebidas.
  // Notas não significam pagamentos realizados ou materiais consumidos.
  const report = (filters={}) => {
    const obraId=positiveId(filters.obra_id,'Obra')
    const obra=row('obras',obraId,'Obra')
    const start=filters.data_inicio ? date(filters.data_inicio,'Data inicial') : null
    const end=filters.data_fim ? date(filters.data_fim,'Data final') : null
    if (start&&end&&start>end) throw new Error('O período inicial não pode ser posterior ao final.')
    const stageId=optionalId(filters.frente_id,'Etapa')
    const substageId=optionalId(filters.subfrente_id,'Subetapa')
    const supplierId=optionalId(filters.fornecedor_id,'Fornecedor')
    if (stageId) sameWork('frentes_obra',stageId,obraId,'Etapa')
    if (substageId) {
      if (!stageId) throw new Error('Selecione a etapa antes da subetapa.')
      const sub=sameWork('subfrentes_obra',substageId,obraId,'Subetapa')
      if (Number(sub.frente_id)!==stageId) throw new Error('A subetapa não pertence à etapa selecionada.')
    }
    if (supplierId) {
      const supplier=row('fornecedores',supplierId,'Fornecedor')
      if (supplier.empresa_id!==null&&Number(supplier.empresa_id)!==Number(obra.empresa_id))
        throw new Error('Fornecedor deve pertencer à empresa da obra.')
    }
    const limit=filters.limit===undefined?25:Number(filters.limit)
    const offset=filters.offset===undefined?0:Number(filters.offset)
    if (!Number.isSafeInteger(limit)||limit<1||limit>100) throw new Error('limit deve ficar entre 1 e 100.')
    if (!Number.isSafeInteger(offset)||offset<0||offset>1000000) throw new Error('offset inválido.')

    // Never join accounts, payments, orders or stock into these totals.
    const conditions=['n.obra_id=?','n.deleted_at IS NULL']
    const params=[obraId]
    if(end){conditions.push('n.emissao<=?');params.push(end)}
    if(stageId){conditions.push('i.frente_id=?');params.push(stageId)}
    if(substageId){conditions.push('i.subfrente_id=?');params.push(substageId)}
    if(supplierId){conditions.push('n.fornecedor_id=?');params.push(supplierId)}
    const joins=" FROM nota_recebida_itens i JOIN notas_recebidas n ON n.id=i.nota_id "+
      "LEFT JOIN frentes_obra e ON e.id=i.frente_id "+
      "LEFT JOIN subfrentes_obra s ON s.id=i.subfrente_id "+
      "JOIN fornecedores f ON f.id=n.fornecedor_id"
    const where=" WHERE "+conditions.join(" AND ")
    const aggregates="SELECT i.frente_id,i.subfrente_id,COALESCE(e.nome,'Sem etapa') AS etapa_nome,"+
      "COALESCE(s.nome,'Sem subetapa') AS subetapa_nome,COUNT(*) AS itens_quantidade,"+
      "SUM(i.valor_total_centavos) AS documentado_ate_fim_centavos,"+
      "SUM(CASE WHEN n.emissao>=? THEN i.valor_total_centavos ELSE 0 END) AS documentado_periodo_centavos"
    const groups=db.prepare(aggregates+joins+where+
      " GROUP BY i.frente_id,i.subfrente_id ORDER BY etapa_nome,subetapa_nome").all(start||'',...params)

    const budgetWhere=['b.obra_id=?','b.deleted_at IS NULL']
    const budgetArgs=[obraId]
    if(stageId){budgetWhere.push('b.frente_id=?');budgetArgs.push(stageId)}
    if(substageId){budgetWhere.push('b.subfrente_id=?');budgetArgs.push(substageId)}
    const amountSql='COALESCE(SUM(CAST(ROUND(b.quantidade*b.valor_unitario_centavos,0) AS INTEGER)),0)'
    const budgetFrom=' FROM itens_orcamentarios b'
    const budgetWhereSql=' WHERE '+budgetWhere.join(' AND ')
    const budget=db.prepare('SELECT b.frente_id,'+amountSql+' AS orcamento_centavos'+budgetFrom+budgetWhereSql+
      ' GROUP BY b.frente_id').all(...budgetArgs)
    const detailedBudget=db.prepare("SELECT b.frente_id,b.subfrente_id,"+
      "COALESCE(e.nome,'Sem etapa') AS etapa_nome,COALESCE(s.nome,'Sem subetapa') AS subetapa_nome,"+
      amountSql+' AS orcamento_centavos'+budgetFrom+
      ' LEFT JOIN frentes_obra e ON e.id=b.frente_id'+
      ' LEFT JOIN subfrentes_obra s ON s.id=b.subfrente_id'+budgetWhereSql+
      ' GROUP BY b.frente_id,b.subfrente_id').all(...budgetArgs)
    // Older budget rows have no substage. Do not infer any subdivision for them.
    const allocatedStageBudget=substageId ? Number(db.prepare(
      'SELECT COUNT(*) AS quantidade FROM itens_orcamentarios WHERE obra_id=? AND frente_id=? AND subfrente_id IS NOT NULL AND deleted_at IS NULL'
    ).get(obraId,stageId).quantidade)>0 : false
    const comparable=!supplierId&&(!substageId||allocatedStageBudget)
    const byStage=new Map()
    const stageKey=id=>id===null?'sem_etapa':String(id)
    for(const entry of groups) {
      const key=stageKey(entry.frente_id)
      if(!byStage.has(key)) byStage.set(key,{
        frente_id:entry.frente_id,nome:entry.etapa_nome,
        orcamento_centavos:0,documentado_ate_fim_centavos:0,documentado_periodo_centavos:0
      })
      const item=byStage.get(key)
      item.documentado_ate_fim_centavos+=Number(entry.documentado_ate_fim_centavos)
      item.documentado_periodo_centavos+=Number(entry.documentado_periodo_centavos)
    }
    for(const b of budget) {
      const key=stageKey(b.frente_id)
      if(!byStage.has(key)&&comparable) {
        const stage=b.frente_id===null?null:db.prepare('SELECT nome FROM frentes_obra WHERE id=?').get(b.frente_id)
        byStage.set(key,{frente_id:b.frente_id,nome:stage?.nome||'Sem etapa',
          orcamento_centavos:0,documentado_ate_fim_centavos:0,documentado_periodo_centavos:0})
      }
      if(byStage.has(key))byStage.get(key).orcamento_centavos=Number(b.orcamento_centavos)
    }
    const etapas=[...byStage.values()].map(item=>{
      const diff=comparable?item.documentado_ate_fim_centavos-item.orcamento_centavos:null
      return {...item,desvio_centavos:diff,
        percentual_documentado:item.orcamento_centavos>0&&comparable
          ?Math.round(item.documentado_ate_fim_centavos*10000/item.orcamento_centavos)/100:null,
        alerta:!comparable?'comparacao_indisponivel'
          :item.orcamento_centavos===0&&item.documentado_ate_fim_centavos>0?'sem_previsao'
          :diff>0?'acima_do_orcamento':'dentro_do_orcamento'}
    }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
    const keyForSub=(stage,sub)=>stageKey(stage)+':'+stageKey(sub)
    const bySub=new Map(groups.map(entry=>[keyForSub(entry.frente_id,entry.subfrente_id),{
      frente_id:entry.frente_id,subfrente_id:entry.subfrente_id,
      etapa_nome:entry.etapa_nome,subetapa_nome:entry.subetapa_nome,
      quantidade_itens:Number(entry.itens_quantidade),orcamento_centavos:null,
      documentado_ate_fim_centavos:Number(entry.documentado_ate_fim_centavos),
      documentado_periodo_centavos:Number(entry.documentado_periodo_centavos)
    }]))
    for(const b of detailedBudget) {
      const key=keyForSub(b.frente_id,b.subfrente_id)
      if(!bySub.has(key)&&!supplierId) bySub.set(key,{
        frente_id:b.frente_id,subfrente_id:b.subfrente_id,
        etapa_nome:b.etapa_nome,subetapa_nome:b.subetapa_nome,
        quantidade_itens:0,orcamento_centavos:null,
        documentado_ate_fim_centavos:0,documentado_periodo_centavos:0
      })
      if(bySub.has(key))bySub.get(key).orcamento_centavos=Number(b.orcamento_centavos)
    }
    const subetapas=[...bySub.values()].map(entry=>{
      const isComparable=comparable && entry.orcamento_centavos!==null
      const diff=isComparable?entry.documentado_ate_fim_centavos-entry.orcamento_centavos:null
      return {...entry,desvio_centavos:diff,alerta:!isComparable?'sem_previsao_especifica':
        entry.orcamento_centavos===0&&entry.documentado_ate_fim_centavos>0?'sem_previsao':
        diff>0?'acima_do_orcamento':'dentro_do_orcamento'}
    }).sort((a,b)=>a.etapa_nome.localeCompare(b.etapa_nome,'pt-BR')||a.subetapa_nome.localeCompare(b.subetapa_nome,'pt-BR'))
    const periodConditions=[...conditions],periodParams=[...params]
    if(start){periodConditions.push('n.emissao>=?');periodParams.push(start)}
    const periodWhere=' WHERE '+periodConditions.join(' AND ')
    const total=Number(db.prepare('SELECT COUNT(*) AS quantidade '+joins+periodWhere).get(...periodParams).quantidade)
    const historyQuery="SELECT i.id AS item_id,n.id AS nota_id,n.numero,n.serie,n.emissao,"+
      "f.nome AS fornecedor_nome,n.fornecedor_id,n.documento_id,n.pedido_compra_id,n.conta_id,"+
      "i.frente_id,i.subfrente_id,COALESCE(e.nome,'Sem etapa') AS etapa_nome,"+
      "COALESCE(s.nome,'Sem subetapa') AS subetapa_nome,i.descricao,i.unidade,i.quantidade,"+
      "i.valor_unitario_centavos,i.valor_total_centavos"
    const historico=db.prepare(historyQuery+joins+periodWhere+
      ' ORDER BY n.emissao DESC,n.id DESC,i.id DESC LIMIT ? OFFSET ?').all(...periodParams,limit,offset)

    return {
      escopo:{obra_id:obraId,obra_nome:obra.nome,data_inicio:start,data_fim:end,
        frente_id:stageId,subfrente_id:substageId,fornecedor_id:supplierId},
      base_comparacao:'orcamento_total_vs_notas_ate_data_final',
      indicador_periodo:'data_emissao_nota',
      indicadores:{
        orcamento_total_centavos:comparable?budget.reduce((s,b)=>s+Number(b.orcamento_centavos),0):null,
        documentado_ate_fim_centavos:subetapas.reduce((s,i)=>s+i.documentado_ate_fim_centavos,0),
        documentado_periodo_centavos:subetapas.reduce((s,i)=>s+i.documentado_periodo_centavos,0),
        comparavel:comparable
      },
      etapas,subetapas,historico,historico_total:total,
      paginacao:{limit,offset,has_more:offset+historico.length<total}
    }
  }

  // Single economic-event projection: account charges and invoice items linked to that
  // account are reconciled, never added as separate charges. Not cash or stock usage.
  const costsOverview = filters => {
    const obraId=positiveId(filters?.obra_id,'Obra')
    row('obras',obraId,'Obra')
    const accounts=db.prepare("SELECT id,obra_id,frente_id,subfrente_id,fornecedor_id,valor_centavos,descricao,competencia,status FROM contas WHERE obra_id=? AND tipo='pagar' AND deleted_at IS NULL AND COALESCE(status,'')!='cancelado' ORDER BY id").all(obraId)
    const accountById=new Map(accounts.map(a=>[Number(a.id),a]))
    const invoiceRows=db.prepare("SELECT n.id nota_id,n.conta_id,n.numero,i.frente_id,i.subfrente_id,COALESCE(e.nome,'Sem etapa') etapa_nome,COALESCE(s.nome,'Sem subetapa') subetapa_nome,SUM(i.valor_total_centavos) valor_centavos FROM nota_recebida_itens i JOIN notas_recebidas n ON n.id=i.nota_id LEFT JOIN frentes_obra e ON e.id=i.frente_id LEFT JOIN subfrentes_obra s ON s.id=i.subfrente_id WHERE n.obra_id=? AND n.deleted_at IS NULL GROUP BY n.id,n.conta_id,i.frente_id,i.subfrente_id").all(obraId)
    const coveredByAccount=new Map()
    const groups=new Map()
    const keyFor=(front,sub)=>String(front??'')+':'+String(sub??'')
    function add(front,sub,value,source){
      const key=keyFor(front,sub)
      if(!groups.has(key)){
        const e=front?db.prepare('SELECT nome FROM frentes_obra WHERE id=?').get(front):null
        const s=sub?db.prepare('SELECT nome FROM subfrentes_obra WHERE id=?').get(sub):null
        groups.set(key,{frente_id:front??null,subfrente_id:sub??null,etapa_nome:e?.nome||'Sem etapa',subetapa_nome:s?.nome||'Sem subetapa',custos_registrados_centavos:0,contas_centavos:0,notas_centavos:0})
      }
      const group=groups.get(key)
      group.custos_registrados_centavos+=value
      group[source]+=value
    }
    const unlinkedNotes=new Set()
    let unlinkedNoteTotal=0
    let invoiceTotal=0
    const notesLinkedTo=new Map()
    for(const item of invoiceRows){
      const amount=Number(item.valor_centavos)
      invoiceTotal+=amount
      if(!item.conta_id){unlinkedNotes.add(Number(item.nota_id));unlinkedNoteTotal+=amount}
      const linked=Number(item.conta_id||0)
      if(linked&&accountById.has(linked)){
        coveredByAccount.set(linked,(coveredByAccount.get(linked)||0)+amount)
        notesLinkedTo.set(linked,(notesLinkedTo.get(linked)||0)+1)
      }
      add(item.frente_id,item.subfrente_id,amount,'notas_centavos')
    }
    const conciliacoes=[]
    let accountTotal=0,missing=0,missingSub=0,unmapped=0
    for(const account of accounts){
      const amount=Number(account.valor_centavos||0)
      accountTotal+=amount
      if(!account.frente_id)missing++
      else if(!account.subfrente_id)missingSub++
      const documentTotal=coveredByAccount.get(Number(account.id))||0
      if(coveredByAccount.has(Number(account.id)) && documentTotal!==amount)
        conciliacoes.push({conta_id:account.id,valor_conta_centavos:amount,valor_notas_centavos:documentTotal,diferenca_centavos:amount-documentTotal})
      const residual=Math.max(0,amount-documentTotal)
      if(residual){
        add(account.frente_id,account.subfrente_id,residual,'contas_centavos')
        if(!account.frente_id)unmapped+=residual
      }
    }
    // Budgets exist at stage scope and, optionally, directly at substage scope.
    // Never pro-rate stage-only budgets into individual substages.
    const budgets=db.prepare("SELECT frente_id,subfrente_id,SUM(CAST(ROUND(quantidade*valor_unitario_centavos,0) AS INTEGER)) AS orcamento_centavos FROM itens_orcamentarios WHERE obra_id=? AND deleted_at IS NULL GROUP BY frente_id,subfrente_id").all(obraId)
    const budgetKeys=new Set()
    for(const budget of budgets){
      const key=keyFor(budget.frente_id,budget.subfrente_id)
      add(budget.frente_id,budget.subfrente_id,0,'notas_centavos')
      const group=groups.get(key)
      group.orcamento_centavos=Number(budget.orcamento_centavos)
      budgetKeys.add(key)
    }
    const details=[...groups.values()].map(item=>{
      const hasBudget=budgetKeys.has(keyFor(item.frente_id,item.subfrente_id))
      const budget=hasBudget?item.orcamento_centavos:null
      const diff=hasBudget?item.custos_registrados_centavos-budget:null
      return {...item,orcamento_centavos:budget,desvio_centavos:diff,
        alerta:!hasBudget?'sem_orcamento_especifico':diff>0?'acima_do_orcamento':'dentro_do_orcamento'}
    }).sort((a,b)=>a.etapa_nome.localeCompare(b.etapa_nome,'pt-BR')||a.subetapa_nome.localeCompare(b.subetapa_nome,'pt-BR'))
    const stages=new Map()
    for(const item of details){
      const key=item.frente_id??'none'
      if(!stages.has(key))stages.set(key,{frente_id:item.frente_id,nome:item.etapa_nome,
        custos_registrados_centavos:0,contas_centavos:0,notas_centavos:0,orcamento_centavos:0})
      const stage=stages.get(key)
      for(const field of ['custos_registrados_centavos','contas_centavos','notas_centavos'])stage[field]+=item[field]
      stage.orcamento_centavos+=item.orcamento_centavos??0
    }
    for(const stage of stages.values()){
      stage.desvio_centavos=stage.custos_registrados_centavos-stage.orcamento_centavos
      stage.alerta=stage.orcamento_centavos===0&&stage.custos_registrados_centavos>0?'sem_orcamento':stage.desvio_centavos>0?'acima_do_orcamento':'dentro_do_orcamento'
    }
    const totalBudget=budgets.reduce((sum,item)=>sum+Number(item.orcamento_centavos||0),0)
    const totalRegistered=details.reduce((sum,item)=>sum+item.custos_registrados_centavos,0)
    return {escopo:{obra_id:obraId},descricao:'Contas a pagar registradas e notas recebidas sem duplicação quando as notas estão vinculadas às contas; notas sem vínculo não são conciliadas automaticamente. Não representa valores pagos ou consumo de estoque.',
      totais:{contas_centavos:accountTotal,notas_centavos:invoiceTotal,notas_sem_conta:unlinkedNotes.size,notas_sem_conta_centavos:unlinkedNoteTotal,
        custos_registrados_centavos:totalRegistered,orcamento_centavos:totalBudget,desvio_centavos:totalRegistered-totalBudget,
        contas_sem_etapa:missing,contas_sem_subetapa:missingSub,custos_sem_etapa_centavos:unmapped},
      etapas:[...stages.values()],subetapas:details,conciliacoes}
  }
  const unclassifiedAccounts = ({obra_id,limit=50,offset=0}={}) => {
    const obraId=positiveId(obra_id,'Obra')
    row('obras',obraId,'Obra')
    const size=Number(limit),from=Number(offset)
    if(!Number.isSafeInteger(size)||size<1||size>100||!Number.isSafeInteger(from)||from<0||from>1000000)throw new Error('Paginação inválida.')
    const where="obra_id=? AND tipo='pagar' AND deleted_at IS NULL AND COALESCE(status,'')!='cancelado' AND frente_id IS NULL"
    const total=Number(db.prepare('SELECT COUNT(*) total FROM contas WHERE '+where).get(obraId).total)
    return {total,limit:size,offset:from,itens:db.prepare("SELECT id,descricao,competencia,valor_centavos,frente_id,subfrente_id,fornecedor_id FROM contas WHERE "+where+" ORDER BY competencia DESC,id DESC LIMIT ? OFFSET ?").all(obraId,size,from)}
  }
  const assignAccounts = payload => {
    const obraId=positiveId(payload?.obra_id,'Obra')
    row('obras',obraId,'Obra')
    const frontId=positiveId(payload?.frente_id,'Etapa')
    sameWork('frentes_obra',frontId,obraId,'Etapa')
    const subId=optionalId(payload?.subfrente_id,'Subetapa')
    if(subId){
      const sub=sameWork('subfrentes_obra',subId,obraId,'Subetapa')
      if(Number(sub.frente_id)!==frontId)throw new Error('Subetapa deve pertencer à etapa selecionada.')
    }
    const ids=payload?.conta_ids
    if(!Array.isArray(ids)||ids.length===0||ids.length>100)throw new Error('Selecione de 1 a 100 despesas.')
    const normalized=ids.map(id=>positiveId(id,'Conta'))
    if(new Set(normalized).size!==normalized.length)throw new Error('A mesma conta foi selecionada mais de uma vez.')
    db.exec('BEGIN IMMEDIATE')
    try {
      const get=db.prepare('SELECT id,obra_id,tipo,frente_id,subfrente_id,deleted_at FROM contas WHERE id=?')
      const update=db.prepare('UPDATE contas SET frente_id=?,subfrente_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      const audit=db.prepare("INSERT INTO custos_classificacoes_historico(conta_id,obra_id,frente_anterior_id,subfrente_anterior_id,frente_nova_id,subfrente_nova_id) VALUES(?,?,?,?,?,?)")
      for(const id of normalized){
        const account=get.get(id)
        if(!account||account.deleted_at||Number(account.obra_id)!==obraId||account.tipo!=='pagar')throw new Error('Todas as contas devem ser despesas ativas da mesma obra.')
        if(account.frente_id)throw new Error('Há uma despesa já classificada. Edite-a individualmente para reclassificar.')
        update.run(frontId,subId,id)
        audit.run(id,obraId,account.frente_id,account.subfrente_id,frontId,subId)
      }
      db.exec('COMMIT')
      return {updated:normalized.length}
    } catch(error){try{db.exec('ROLLBACK')}catch{}throw error}
  }

  const validateNotePayload = payload => {
    const work=row('obras',payload?.obra_id,'Obra')
    const obraId=Number(work.id)
    const companyId=positiveId(payload?.empresa_id,'Empresa')
    if (Number(work.empresa_id)!==companyId) throw new Error('Obra deve pertencer à mesma empresa.')
    const supplier=row('fornecedores',payload?.fornecedor_id,'Fornecedor')
    if (supplier.empresa_id!==null && Number(supplier.empresa_id)!==companyId) throw new Error('Fornecedor deve pertencer à mesma empresa.')
    const supplierId=Number(supplier.id)
    const number=required(payload?.numero,'Número da nota',100)
    const serie=String(payload?.serie??'').trim().slice(0,30)
    const emissao=date(payload?.emissao,'Data de emissão')
    const dataRecebimento=payload?.data_recebimento?date(payload.data_recebimento,'Data de recebimento'):null
    const requestId=payload?.requestId ? required(payload.requestId,'Identificador da operação',120) : null
    const pedidoId=optionalId(payload?.pedido_compra_id,'Pedido de compra')
    const contaId=optionalId(payload?.conta_id,'Conta')
    if (pedidoId) {
      const pedido=sameWork('pedidos_compra',pedidoId,obraId,'Pedido de compra')
      if (pedido.fornecedor_id && Number(pedido.fornecedor_id)!==supplierId) throw new Error('Fornecedor do pedido é diferente do fornecedor da nota.')
    }
    if (contaId) {
      const conta=sameWork('contas',contaId,obraId,'Conta')
      if (Number(conta.empresa_id)!==companyId||conta.tipo!=='pagar') throw new Error('A conta vinculada deve ser uma despesa da mesma empresa.')
      if (conta.fornecedor_id && Number(conta.fornecedor_id)!==supplierId) throw new Error('Fornecedor da conta é diferente do fornecedor da nota.')
      if (pedidoId && conta.pedido_compra_id && Number(conta.pedido_compra_id)!==pedidoId) throw new Error('A conta pertence a outro pedido.')
    }
    if (!Array.isArray(payload?.itens)||payload.itens.length===0||payload.itens.length>500) throw new Error('Informe entre 1 e 500 itens da nota.')
    const items=payload.itens.map((value,index)=>{
      const description=required(value.descricao,'Descrição do item '+(index+1))
      const qty=Number(value.quantidade)
      if (!Number.isFinite(qty)||qty<=0||qty>100000000||Math.round(qty*1000)!==qty*1000) throw new Error('Quantidade inválida no item '+(index+1)+'. Use no máximo três casas decimais.')
      const price=cents(value.valor_unitario_centavos,'Valor unitário do item '+(index+1))
      const amount=Math.round(qty*price)
      if (!Number.isSafeInteger(amount)) throw new Error('Total do item '+(index+1)+' excede o limite.')
      const frontId=optionalId(value.frente_id,'Etapa')
      const subId=optionalId(value.subfrente_id,'Subetapa')
      if (frontId) sameWork('frentes_obra',frontId,obraId,'Etapa')
      if (subId) {
        if (!frontId) throw new Error('Selecione a etapa antes da subetapa.')
        const sub=sameWork('subfrentes_obra',subId,obraId,'Subetapa')
        if (Number(sub.frente_id)!==frontId) throw new Error('Subetapa deve pertencer à etapa selecionada.')
      }
      const orderItemId=optionalId(value.pedido_item_id,'Item do pedido')
      if (orderItemId) {
        const orderItem=row('pedido_compra_itens',orderItemId,'Item do pedido')
        if (!pedidoId||Number(orderItem.pedido_compra_id)!==pedidoId) throw new Error('Item selecionado não pertence ao pedido vinculado.')
      }
      return { descricao:description,unidade:String(value.unidade||'un').trim().slice(0,25)||'un',quantidade:qty,valor_unitario_centavos:price,valor_total_centavos:amount,frente_id:frontId,subfrente_id:subId,pedido_item_id:orderItemId }
    })
    const sum=items.reduce((total,item)=>total+item.valor_total_centavos,0)
    if (!Number.isSafeInteger(sum)||sum<=0) throw new Error('O valor total da nota deve ser maior que zero.')
    if (payload.valor_total_centavos!==undefined&&payload.valor_total_centavos!==null&&cents(payload.valor_total_centavos,'Valor total')!==sum) throw new Error('O total da nota diverge da soma de seus itens.')
    return {obraId,companyId,supplierId,number,serie,emissao,dataRecebimento,requestId,pedidoId,contaId,items,sum}
  }
  const create = payload => {
    const {obraId,companyId,supplierId,number,serie,emissao,dataRecebimento,requestId,pedidoId,contaId,items,sum}=validateNotePayload(payload)
    if (requestId) {
      const replay=db.prepare('SELECT id,empresa_id,obra_id,fornecedor_id,numero,serie,valor_total_centavos FROM notas_recebidas WHERE request_id=?').get(requestId)
      if (replay) {
        if (Number(replay.empresa_id)!==companyId||Number(replay.obra_id)!==obraId||Number(replay.fornecedor_id)!==supplierId||replay.numero!==number||replay.serie!==serie||Number(replay.valor_total_centavos)!==sum) throw new Error('Identificador de operação já utilizado em outra nota.')
        return read(replay.id)
      }
    }
    const existing=db.prepare('SELECT id FROM notas_recebidas WHERE empresa_id=? AND fornecedor_id=? AND numero=? AND serie=? AND deleted_at IS NULL').get(companyId,supplierId,number,serie)
    if (existing) throw new Error('Esta nota já está cadastrada para o fornecedor informado.')
    db.exec('BEGIN IMMEDIATE')
    try {
      const saved=db.prepare('INSERT INTO notas_recebidas(empresa_id,obra_id,fornecedor_id,numero,serie,emissao,data_recebimento,valor_total_centavos,pedido_compra_id,conta_id,observacoes,request_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(companyId,obraId,supplierId,number,serie,emissao,dataRecebimento,sum,pedidoId,contaId,String(payload.observacoes||'').trim().slice(0,2000)||null,requestId)
      const id=Number(saved.lastInsertRowid)
      const add=db.prepare('INSERT INTO nota_recebida_itens(nota_id,frente_id,subfrente_id,pedido_item_id,descricao,unidade,quantidade,valor_unitario_centavos,valor_total_centavos) VALUES (?,?,?,?,?,?,?,?,?)')
      for (const item of items) add.run(id,item.frente_id,item.subfrente_id,item.pedido_item_id,item.descricao,item.unidade,item.quantidade,item.valor_unitario_centavos,item.valor_total_centavos)
      db.exec('COMMIT')
      return read(id)
    } catch(error) {
      try { db.exec('ROLLBACK') } catch {}
      if (/UNIQUE constraint/i.test(String(error?.message))) throw new Error('Esta nota já foi cadastrada. Confira o fornecedor, número e série.')
      throw error
    }
  }
  const history = noteId => {
    read(noteId)
    return db.prepare('SELECT id,nota_id,revision_anterior,anterior_json,origem,created_at FROM nota_recebida_revisoes WHERE nota_id=? ORDER BY id DESC LIMIT 100').all(positiveId(noteId,'Nota'))
  }
  const update = (noteId,payload) => {
    const id=positiveId(noteId,'Nota')
    const before=read(id)
    const revision=Number(payload?.revision)
    if(!Number.isSafeInteger(revision)||revision!==Number(before.revision)) throw new Error('Esta nota foi atualizada em outra sessão. Recarregue a revisão antes de editar.')
    if(Number(payload?.obra_id)!==Number(before.obra_id)||Number(payload?.empresa_id)!==Number(before.empresa_id)) throw new Error('Não é permitido alterar a obra ou a empresa da nota.')
    const {obraId,companyId,supplierId,number,serie,emissao,dataRecebimento,pedidoId,contaId,items,sum}=validateNotePayload(payload)
    if(obraId!==Number(before.obra_id)||companyId!==Number(before.empresa_id))throw new Error('A nota deve permanecer na mesma obra.')
    const duplicate=db.prepare('SELECT id FROM notas_recebidas WHERE empresa_id=? AND fornecedor_id=? AND numero=? AND serie=? AND id!=? AND deleted_at IS NULL').get(companyId,supplierId,number,serie,id)
    if(duplicate)throw new Error('Já existe outra nota com esse fornecedor, número e série.')
    db.exec('BEGIN IMMEDIATE')
    try {
      const current=read(id)
      if(Number(current.revision)!==revision)throw new Error('A nota já foi atualizada. Reabra antes de salvar.')
      db.prepare('INSERT INTO nota_recebida_revisoes(nota_id,revision_anterior,anterior_json,origem) VALUES(?,?,?,?)')
        .run(id,revision,JSON.stringify(current),'edicao_usuario')
      db.prepare('UPDATE notas_recebidas SET fornecedor_id=?,numero=?,serie=?,emissao=?,data_recebimento=?,valor_total_centavos=?,pedido_compra_id=?,conta_id=?,observacoes=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(supplierId,number,serie,emissao,dataRecebimento,sum,pedidoId,contaId,String(payload?.observacoes||'').trim().slice(0,2000)||null,id)
      db.prepare('DELETE FROM nota_recebida_itens WHERE nota_id=?').run(id)
      const insert=db.prepare('INSERT INTO nota_recebida_itens(nota_id,frente_id,subfrente_id,pedido_item_id,descricao,unidade,quantidade,valor_unitario_centavos,valor_total_centavos) VALUES(?,?,?,?,?,?,?,?,?)')
      for(const item of items)insert.run(id,item.frente_id,item.subfrente_id,item.pedido_item_id,item.descricao,item.unidade,item.quantidade,item.valor_unitario_centavos,item.valor_total_centavos)
      db.exec('COMMIT')
      return read(id)
    }catch(error){try{db.exec('ROLLBACK')}catch{}throw error}
  }
  const attach = (noteId,documentId) => {
    const nota=read(noteId)
    const document=row('documentos',documentId,'Documento')
    if (Number(document.obra_id)!==Number(nota.obra_id)||Number(document.empresa_id)!==Number(nota.empresa_id)) throw new Error('Documento deve pertencer à mesma obra e empresa.')
    if (nota.documento_id && Number(nota.documento_id)!==Number(document.id)) throw new Error('A nota já possui um documento. Verifique antes de substituir o anexo.')
    if (!nota.documento_id) db.prepare('UPDATE notas_recebidas SET documento_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(document.id,nota.id)
    return read(nota.id)
  }
  return { create,update,history,list,read,summary,report,costsOverview,unclassifiedAccounts,assignAccounts,attach }
}
module.exports={createReceivedNotesService}
