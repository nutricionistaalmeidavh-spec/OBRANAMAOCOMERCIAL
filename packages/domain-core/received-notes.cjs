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
    return db.prepare('SELECT n.*,f.nome AS fornecedor_nome,(SELECT COUNT(*) FROM nota_recebida_itens i WHERE i.nota_id=n.id) AS quantidade_itens FROM notas_recebidas n JOIN fornecedores f ON f.id=n.fornecedor_id WHERE n.deleted_at IS NULL AND (n.obra_id=? OR EXISTS(SELECT 1 FROM nota_recebida_itens i WHERE i.nota_id=n.id AND i.obra_id=?)) ORDER BY n.emissao DESC,n.id DESC').all(id,id)
  }
  const summary = obraId => {
    const id=positiveId(obraId,'Obra')
    const grouped=db.prepare("SELECT i.frente_id,i.subfrente_id,COALESCE(f.nome,'Sem etapa') AS etapa_nome,COALESCE(s.nome,'Sem subetapa') AS subetapa_nome,COUNT(*) AS quantidade_itens,SUM(i.valor_total_centavos) AS valor_centavos FROM nota_recebida_itens i JOIN notas_recebidas n ON n.id=i.nota_id LEFT JOIN frentes_obra f ON f.id=i.frente_id LEFT JOIN subfrentes_obra s ON s.id=i.subfrente_id WHERE COALESCE(i.obra_id,n.obra_id)=? AND n.deleted_at IS NULL GROUP BY i.frente_id,i.subfrente_id ORDER BY etapa_nome,subetapa_nome").all(id)
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
    const conditions=['COALESCE(i.obra_id,n.obra_id)=?','n.deleted_at IS NULL']
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

    // Independent projections: never join invoice items to payments or multiply a payable.
    // Commitments represent the current snapshot, not a reconstructed historical balance.
    const financialWhere=["a.obra_id=?","a.empresa_id=?","a.tipo='pagar'","a.deleted_at IS NULL","a.status!='cancelado'"]
    const financialArgs=[obraId,obra.empresa_id]
    if(stageId){financialWhere.push('a.frente_id=?');financialArgs.push(stageId)}
    if(substageId){financialWhere.push('a.subfrente_id=?');financialArgs.push(substageId)}
    if(supplierId){financialWhere.push('c.fornecedor_id=?');financialArgs.push(supplierId)}
    const financeRows=db.prepare("SELECT a.frente_id,a.subfrente_id,COALESCE(e.nome,'Sem etapa') etapa_nome,COALESCE(s.nome,'Sem subetapa') subetapa_nome,SUM(a.valor_centavos) comprometido_atual_centavos FROM v_financeiro_apropriacoes a JOIN contas c ON c.id=a.id LEFT JOIN frentes_obra e ON e.id=a.frente_id LEFT JOIN subfrentes_obra s ON s.id=a.subfrente_id WHERE "+financialWhere.join(' AND ')+" GROUP BY a.frente_id,a.subfrente_id").all(...financialArgs)
    const payWhere=["p.obra_id=?","p.empresa_id=?","c.tipo='pagar'","c.deleted_at IS NULL","c.status!='cancelado'"]
    const payArgs=[obraId,obra.empresa_id]
    if(stageId){payWhere.push('p.frente_id=?');payArgs.push(stageId)}
    if(substageId){payWhere.push('p.subfrente_id=?');payArgs.push(substageId)}
    if(supplierId){payWhere.push('c.fornecedor_id=?');payArgs.push(supplierId)}
    if(start){payWhere.push('p.data>=?');payArgs.push(start)}
    if(end){payWhere.push('p.data<=?');payArgs.push(end)}
    const paidRows=db.prepare("SELECT p.frente_id,p.subfrente_id,SUM(p.valor_centavos) pago_periodo_centavos FROM v_financeiro_pagamentos_apropriados p JOIN contas c ON c.id=p.conta_id WHERE "+payWhere.join(' AND ')+" GROUP BY p.frente_id,p.subfrente_id").all(...payArgs)
    const paidMap=new Map(paidRows.map(x=>[keyForSub(x.frente_id,x.subfrente_id),Number(x.pago_periodo_centavos)]))
    const financeiro_por_destino=financeRows.map(x=>({...x,comprometido_atual_centavos:Number(x.comprometido_atual_centavos),pago_periodo_centavos:paidMap.get(keyForSub(x.frente_id,x.subfrente_id))||0}))
    // RDO stores physical quantities, not a cost valuation or reliable substage/supplier attribution.
    // Never infer those dimensions or sum different materials/units.
    let consumo_rdo=null,consumo_rdo_total=0
    if(!supplierId&&!substageId){
      const clauses=['r.obra_id=?','r.deleted_at IS NULL'],args=[obraId]
      if(stageId){clauses.push('l.frente_id=?');args.push(stageId)}
      if(start){clauses.push('r.data>=?');args.push(start)}
      if(end){clauses.push('r.data<=?');args.push(end)}
      const group=" FROM rdo_material_linhas l JOIN rdos r ON r.id=l.rdo_id LEFT JOIN frentes_obra e ON e.id=l.frente_id WHERE "+clauses.join(' AND ')+" GROUP BY l.frente_id,l.material_id,l.descricao,l.unidade"
      consumo_rdo_total=Number(db.prepare('SELECT COUNT(*) quantidade FROM (SELECT 1'+group+')').get(...args).quantidade)
      consumo_rdo=db.prepare("SELECT l.frente_id,COALESCE(e.nome,'Sem etapa') etapa_nome,l.material_id,l.descricao,l.unidade,ROUND(SUM(l.quantidade),6) quantidade"+group+" ORDER BY etapa_nome,l.descricao,l.unidade,l.material_id LIMIT 100").all(...args)
    }
    return {
      financeiro_por_destino,consumo_rdo,consumo_rdo_total,
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

  const create = payload => {
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
  const attach = (noteId,documentId) => {
    const nota=read(noteId)
    const document=row('documentos',documentId,'Documento')
    if (Number(document.obra_id)!==Number(nota.obra_id)||Number(document.empresa_id)!==Number(nota.empresa_id)) throw new Error('Documento deve pertencer à mesma obra e empresa.')
    if (nota.documento_id && Number(nota.documento_id)!==Number(document.id)) throw new Error('A nota já possui um documento. Verifique antes de substituir o anexo.')
    if (!nota.documento_id) db.prepare('UPDATE notas_recebidas SET documento_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(document.id,nota.id)
    return read(nota.id)
  }
  return { create,list,read,summary,report,attach }
}

/** Shared stock read model. Filter and aggregate before transferring rows. */
function stockPage(db, filters={}, {exportMode=false}={}) {
  const positive=(v,label)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<=0)throw new Error(label+' inválida.');return n}
  const limit=exportMode?10000:filters.limit===undefined?50:positive(filters.limit,'Página')
  const offset=exportMode?0:Number(filters.offset??0)
  if(limit>(exportMode?10000:100)||!Number.isSafeInteger(offset)||offset<0)throw new Error('Paginação inválida.')
  const history=filters.history===true||filters.history==='true'
  const stage=filters.frente_id!=null&&filters.frente_id!==''?positive(filters.frente_id,'Etapa'):null
  const conditions=['o.deleted_at IS NULL'],args=[]
  for(const [field,sql] of [['empresa_id','o.empresa_id'],['obra_id','m.obra_id']]){
    if(filters[field]!=null&&filters[field]!==''){conditions.push(sql+'=?');args.push(positive(filters[field],field))}
  }
  if(history&&stage){conditions.push('m.frente_id=?');args.push(stage)}
  const q=String(filters.q??'').trim().slice(0,200)
  const match="(instr(lower(trim(COALESCE(c.descricao,m.descricao))),lower(?))>0 OR instr(lower(trim(m.descricao)),lower(?))>0 OR instr(lower(trim(m.unidade)),lower(?))>0 OR instr(lower(o.nome),lower(?))>0 OR instr(lower(COALESCE(f.nome,'')),lower(?))>0 OR instr(lower(COALESCE(e.nome_fantasia,e.razao_social)),lower(?))>0)"
  if(history&&q){conditions.push(match);args.push(q,q,q,q,q,q)}
  const from=" FROM movimentacoes_estoque m JOIN obras o ON o.id=m.obra_id JOIN empresas e ON e.id=o.empresa_id LEFT JOIN frentes_obra f ON f.id=m.frente_id LEFT JOIN pedido_compra_itens pi ON pi.id=m.pedido_item_id LEFT JOIN materiais_estoque c ON c.id=m.material_id WHERE "+conditions.join(' AND ')
  const scoped=stage?'m.frente_id='+stage:'1=1'
  const incoming="m.tipo IN ('entrada','ajuste')"
  const sum=(condition)=>"SUM(CASE WHEN "+condition+" THEN m.quantidade ELSE 0 END)"
  const entries=sum(incoming+' AND '+scoped),exits=sum("m.tipo='saida' AND "+scoped)
  const signed="SUM(CASE WHEN "+incoming+" THEN m.quantidade ELSE -m.quantidade END)"
  const covered=sum(incoming+" AND pi.quantidade_pedida>0")
  const cost="SUM(CASE WHEN "+incoming+" AND pi.quantidade_pedida>0 THEN 1.0*pi.valor_centavos*m.quantidade/pi.quantidade_pedida ELSE 0 END)"
  // Do not present a partial purchase-price sample as the value of all stock.
  const valuation=", CASE WHEN "+covered+">0 AND ABS("+covered+"-"+sum(incoming)+")<0.000001 THEN CAST(ROUND("+cost+"/"+covered+") AS INTEGER) END custo_medio_centavos"
  const having=[]
  if(!history&&stage)having.push('SUM(CASE WHEN '+scoped+' THEN 1 ELSE 0 END)>0')
  if(!history&&q){having.push('MAX(CASE WHEN '+match+' THEN 1 ELSE 0 END)=1');args.push(q,q,q,q,q,q)}
  const group=" GROUP BY m.obra_id,m.material_id,CASE WHEN m.material_id IS NULL THEN lower(trim(m.descricao)) END,CASE WHEN m.material_id IS NULL THEN lower(trim(m.unidade)) END"+(having.length?' HAVING '+having.join(' AND '):'')
  const stageId=stage?String(stage):'NULL'
  const stageName=stage?"MAX(CASE WHEN "+scoped+" THEN f.nome END)":"'Todas as etapas'"
  const sql=history
    ? "SELECT m.id,m.obra_id,o.empresa_id,o.nome obra_nome,COALESCE(e.nome_fantasia,e.razao_social) empresa_nome,m.frente_id,COALESCE(f.nome,'Obra geral') etapa_nome,m.descricao,m.unidade,m.material_id,c.uid material_uid,c.descricao material_nome,m.tipo,m.quantidade,m.data"+from
    : "SELECT MIN(m.id) id,m.obra_id,o.empresa_id,o.nome obra_nome,COALESCE(e.nome_fantasia,e.razao_social) empresa_nome,"+stageId+" frente_id,"+stageName+" etapa_nome,COALESCE(c.descricao,MIN(trim(m.descricao))) descricao,COALESCE(c.unidade,MIN(trim(m.unidade))) unidade,m.material_id,c.uid material_uid,"+entries+" entradas,"+exits+" saidas,"+signed+" saldo,("+entries+"-"+exits+") liquido_etapa"+valuation+from+group
  const total=Number(db.prepare('SELECT COUNT(*) total FROM ('+sql+')').get(...args).total)
  if(exportMode&&total>limit)throw new Error('A exportação excede 10.000 registros. Refine os filtros para exportar todos os resultados.')
  const rows=db.prepare(sql+(history?' ORDER BY m.data DESC,m.id DESC':' ORDER BY obra_nome,descricao,unidade,id')+' LIMIT ? OFFSET ?').all(...args,limit,offset)
  return {rows:history?rows:rows.map(r=>({...r,saldo_estimado_centavos:r.custo_medio_centavos===null?null:Math.round(r.custo_medio_centavos*r.saldo)})),total,limit,offset}
}
function stockWorkBalances(db,obraId,{includeZero=false,limit=null}={}){
  const sql="SELECT COALESCE(c.descricao,MIN(trim(m.descricao))) descricao,COALESCE(c.unidade,MIN(trim(m.unidade))) unidade,m.material_id,c.uid material_uid,ROUND(SUM(CASE WHEN m.tipo='saida' THEN -m.quantidade ELSE m.quantidade END),6) saldo FROM movimentacoes_estoque m LEFT JOIN materiais_estoque c ON c.id=m.material_id WHERE m.obra_id=? GROUP BY m.material_id,CASE WHEN m.material_id IS NULL THEN lower(trim(m.descricao)) END,CASE WHEN m.material_id IS NULL THEN lower(trim(m.unidade)) END"+(includeZero?'':' HAVING saldo>0')+" ORDER BY descricao,unidade,material_id"+(limit?' LIMIT ?':'')
  return limit?db.prepare(sql).all(obraId,limit):db.prepare(sql).all(obraId)
}
function resolveStockMaterialOriginal(db,payload){
  const obra=Number(payload.obra_id)
  if(payload.material_id!=null&&payload.material_id!==''){
    const id=Number(payload.material_id)
    const row=db.prepare("SELECT c.* FROM materiais_estoque c JOIN obras o ON o.empresa_id=c.empresa_id WHERE o.id=? AND c.id=?").get(obra,id)
    if(!row||String(row.unidade).trim().toLowerCase()!==String(payload.unidade||'un').trim().toLowerCase())throw new Error('Material ou unidade incompatível com a obra.')
    return row
  }
  return db.prepare("SELECT c.* FROM materiais_estoque c JOIN obras o ON o.empresa_id=c.empresa_id WHERE o.id=? AND lower(trim(c.descricao))=lower(trim(?)) AND lower(trim(c.unidade))=lower(trim(?))").get(obra,String(payload.descricao||''),String(payload.unidade||'un'))||null
}
function resolveStockMaterial(db,payload){
 const original=resolveStockMaterialOriginal(db,payload)
 if(!original)return null
 const redirect=db.prepare('SELECT destino_id FROM material_reclassificacoes WHERE origem_id=?').get(original.id)
 if(!redirect)return original
 const target=db.prepare('SELECT * FROM materiais_estoque WHERE id=?').get(redirect.destino_id)
 if(!target)throw new Error('Destino da reclassificação indisponível.')
 return {...target,original_uid:original.uid}
}
function stockBalance(db,payload,{allStages=true}={}){
  const material=resolveStockMaterial(db,payload)
  const scope="obra_id=? AND (?=1 OR COALESCE(frente_id,0)=COALESCE(?,0))"
  const base="SELECT COALESCE(SUM(CASE WHEN tipo IN ('entrada','ajuste') THEN quantidade ELSE -quantidade END),0) total FROM movimentacoes_estoque WHERE "+scope
  const args=[payload.obra_id,allStages?1:0,payload.frente_id||null]
  return Number(material?db.prepare(base+' AND material_id=?').get(...args,material.id).total:db.prepare(base+' AND material_id IS NULL AND lower(trim(descricao))=lower(trim(?)) AND lower(trim(unidade))=lower(trim(?))').get(...args,payload.descricao,payload.unidade||'un').total)
}

function validateStockMovement(db,payload){
  const qty=Number(payload.quantidade),obra=Number(payload.obra_id)
  if(!Number.isFinite(qty)||qty<=0||!['entrada','saida','ajuste'].includes(payload.tipo)||!String(payload.descricao||'').trim())throw new Error('Movimentação de estoque inválida.')
  if(!db.prepare('SELECT id FROM obras WHERE id=? AND deleted_at IS NULL').get(obra))throw new Error('Obra inválida.')
  if(payload.frente_id&&!db.prepare('SELECT id FROM frentes_obra WHERE id=? AND obra_id=? AND deleted_at IS NULL').get(Number(payload.frente_id),obra))throw new Error('Etapa não pertence à obra.')
  if(payload.material_id!=null)resolveStockMaterial(db,payload)
  if(payload.tipo==='saida'&&stockBalance(db,payload)+1e-9<qty)throw new Error('A saída deixaria o estoque negativo.')
}


const {createHash}=require('node:crypto')
const digits=value=>String(value??'').replace(/\D/g,'')
const fiscalDate=value=>{
  const v=String(value??'')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)throw new Error('Data fiscal inválida.')
  return v
}
function fixedDecimal(value,scale,label){
  const text=String(value??'')
  if(!/^\d{1,15}(?:\.\d{1,10})?$/.test(text))throw new Error(label+' inválido.')
  const [integer,fraction='']=text.split('.')
  if(fraction.length>scale&&/[1-9]/.test(fraction.slice(scale)))throw new Error(label+' excede a precisão suportada.')
  return BigInt(integer)*10n**BigInt(scale)+BigInt((fraction.slice(0,scale)+'0'.repeat(scale)).slice(0,scale)||'0')
}
function quantityText(n){const whole=n/1000000n;const fraction=String(n%1000000n).padStart(6,'0').replace(/0+$/,'');return String(whole)+(fraction?'.'+fraction:'')}
function safeInt(n,label){if(n<0n||n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error(label+' excede o limite.');return Number(n)}
function fiscalKeyValid(key){
  if(!/^\d{44}$/.test(key))return false
  let sum=0,w=2
  for(let i=42;i>=0;i--){sum+=Number(key[i])*w;w=w===9?2:w+1}
  const d=11-sum%11
  return Number(key[43])===(d>=10?0:d)
}
function positiveFiscalId(value,label){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw new Error(label+' inválido.');return n}
function fiscalRow(db,table,id,label){
  const r=db.prepare('SELECT * FROM '+table+' WHERE id=?').get(positiveFiscalId(id,label))
  if(!r||r.deleted_at)throw new Error(label+' inexistente.')
  return r
}
function decodeNfeSource(payload,parseXml){
    const source=payload?.xml_base64
    if(typeof source!=='string'||source.length>12*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(source))throw new Error('Arquivo XML inválido.')
    const bytes=Buffer.from(source,'base64')
    if(!bytes.length||bytes.length>8*1024*1024||bytes.toString('base64')!==source)throw new Error('Arquivo XML inválido ou muito grande.')
    // Never trust a preview object supplied by the renderer.
    const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    const parsed=parseXml(xml)
 return {bytes,parsed}
}
// Explicit operator-entered purchase, never a simulated fiscal XML.
function manualNoteSource(db,payload){
 if(payload.xml_base64!==undefined)throw new Error('Informe uma nota manual ou um XML, nunca ambos.')
 const m=payload.manual
 const clean=(value,label,max,allowEmpty=false)=>{const v=String(value??'').trim();if((!allowEmpty&&!v)||v.length>max)throw new Error(label+' inválido.');return v}
 const company=fiscalRow(db,'empresas',payload.empresa_id,'Empresa'),supplier=fiscalRow(db,'fornecedores',payload.fornecedor_id,'Fornecedor')
 if(company.status==='inativa'||(supplier.empresa_id!==null&&Number(supplier.empresa_id)!==Number(company.id)))throw new Error('Empresa ou fornecedor incompatível.')
 if(!Array.isArray(m?.itens)||!m.itens.length||m.itens.length>500)throw new Error('Informe entre 1 e 500 itens manuais.')
 const recognized=[],seen=new Set()
 let total=0n
 const itens=m.itens.map((v,index)=>{
  const numero=clean(v.numero,'Número do item',30),descricao=clean(v.descricao,'Descrição',240),unidade=clean(v.unidade,'Unidade',25)
  if(seen.has(numero))throw new Error('Item manual repetido.');seen.add(numero)
  const qty=fixedDecimal(v.quantidade,6,'Quantidade'),price=fixedDecimal(v.valor_unitario,10,'Preço unitário')
  if(qty<=0n)throw new Error('Quantidade manual deve ser positiva.')
  safeInt(qty,'Quantidade')
  const cost=(qty*price+50000000000000n)/100000000000000n
  safeInt(cost,'Total do item')
  if(fixedDecimal(v.valor_produto,2,'Total do item')!==cost)throw new Error('Total do item manual diverge de quantidade e preço.')
  let material=null
  if(v.servico===true){if(v.material_id!=null)throw new Error('Serviço não pode movimentar material.')}
  else{
   material=fiscalRow(db,'materiais_estoque',v.material_id,'Material')
   if(Number(material.empresa_id)!==Number(company.id)||String(material.unidade).trim().toLowerCase()!==unidade.toLowerCase()||db.prepare('SELECT 1 FROM material_reclassificacoes WHERE origem_id=?').get(material.id))throw new Error('Material ou unidade canônica incompatível.')
  }
  recognized.push({numero,status:'confirmado',material_id:material?.id??null,descricao:material?.descricao??descricao,unidade:material?.unidade??unidade,fator_num:1,fator_den:1,servico:v.servico===true,conflitos:[],candidatos:[]})
  total+=cost
  return {numero,descricao,unidade,quantidade:quantityText(qty),valor_unitario:String(v.valor_unitario),valor_produto:String(cost/100n)+'.'+String(cost%100n).padStart(2,'0')}
 })
 if(total<=0n)throw new Error('Total da nota manual deve ser positivo.')
 safeInt(total,'Total')
 const totalText=String(total/100n)+'.'+String(total%100n).padStart(2,'0')
 const parsed={numero:clean(m.numero,'Número da nota',100),serie:clean(m.serie,'Série',30,true),emissao:fiscalDate(m.emissao),observacoes:clean(m.observacoes,'Observações',2000,true),fornecedor:supplier.nome,total:totalText,total_produtos:totalText,itens,parcelas:[]}
 return {parsed,company,supplier,recognized:{empresa_id:company.id,fornecedor_id:supplier.id,itens:recognized}}
}
function inspectNfeSource(db,payload,parseXml){
 if(payload.manual!==undefined){
  const {parsed,company,supplier,recognized}=manualNoteSource(db,payload)
  const work=fiscalRow(db,'obras',payload.obra_id,'Obra')
  if(Number(work.empresa_id)!==Number(company.id))throw new Error('Obra pertence a outra empresa.')
  const existing=db.prepare('SELECT id,status_integracao FROM notas_recebidas WHERE empresa_id=? AND fornecedor_id=? AND numero=? AND serie=? AND deleted_at IS NULL').get(company.id,supplier.id,parsed.numero,parsed.serie)
  return {...recognized,operacao:'compra',fiscal:parsed,registro_existente:existing||null,pedidos_referenciados:[],elegivel_compra:!existing,opcoes:existing?{obras:[],etapas:[],subetapas:[],categorias:[],pedidos:[],recebimentos:[],contas:[]}:nfeOptions(db,company.id,supplier.id,recognized.itens)}
 }
 const {parsed}=decodeNfeSource(payload,parseXml)
 const work=fiscalRow(db,'obras',payload.obra_id,'Obra'),company=fiscalRow(db,'empresas',work.empresa_id,'Empresa')
 if(company.status==='inativa'||!/^\d{14}$/.test(digits(parsed.destinatario))||digits(company.cnpj)!==digits(parsed.destinatario))throw new Error('Destinatário da NF-e não corresponde à empresa da obra.')
 const recognition=recognizeNfeMaterials(db,{obra_id:work.id,documento:parsed.documento,fornecedor_id:payload.fornecedor_id,itens:parsed.itens})
 const existing=db.prepare('SELECT id,status_integracao FROM notas_recebidas WHERE empresa_id=? AND (chave_acesso=? OR (fornecedor_id=? AND numero=? AND serie=? AND deleted_at IS NULL)) ORDER BY id LIMIT 1').get(company.id,parsed.chave,recognition.fornecedor_id,parsed.numero,parsed.serie)
 // xPed is a supplier-provided reference, not a local primary key.
 const references=[...new Set(parsed.itens.map(i=>i.pedido).filter(Boolean))]
 const orderCandidates=[]
 for(const reference of references){
  const matches=db.prepare("SELECT p.id,p.numero,p.obra_id,p.frente_id,p.status,o.nome obra_nome FROM pedidos_compra p JOIN obras o ON o.id=p.obra_id WHERE o.empresa_id=? AND p.fornecedor_id=? AND p.deleted_at IS NULL AND o.deleted_at IS NULL AND trim(p.numero)=? ORDER BY p.id LIMIT 21").all(company.id,recognition.fornecedor_id,reference)
  if(matches.length>20)throw new Error('Referência de pedido ambígua. Revise os pedidos antes de importar.')
  orderCandidates.push({referencia:reference,pedidos:matches})
 }
 const operation=recognition.operacao==='compra'&&(parsed.tipo_operacao!=='1'||parsed.finalidade!=='1')?'revisar':recognition.operacao
 const eligible=parsed.ambiente==='1'&&['100','150'].includes(parsed.status)&&!!parsed.protocolo&&operation==='compra'&&!existing
 const options=eligible&&recognition.itens.every(i=>i.status==='confirmado')?nfeOptions(db,company.id,recognition.fornecedor_id,recognition.itens):{obras:[],etapas:[],subetapas:[],categorias:[],pedidos:[],recebimentos:[],contas:[]}
 return {...recognition,operacao:operation,fiscal:parsed,registro_existente:existing||null,pedidos_referenciados:orderCandidates,elegivel_compra:eligible,opcoes:options}
}
function nfeOptions(db,companyId,supplierId,items){
 const options={obras:[],etapas:[],subetapas:[],categorias:[],pedidos:[],recebimentos:[],contas:[]}
  options.obras=db.prepare('SELECT id,nome FROM obras WHERE empresa_id=? AND deleted_at IS NULL ORDER BY nome').all(companyId)
  options.etapas=db.prepare('SELECT f.id,f.obra_id,f.nome FROM frentes_obra f JOIN obras o ON o.id=f.obra_id WHERE o.empresa_id=? AND o.deleted_at IS NULL AND f.deleted_at IS NULL ORDER BY f.nome').all(companyId)
  options.subetapas=db.prepare('SELECT s.id,s.obra_id,s.frente_id,s.nome FROM subfrentes_obra s JOIN obras o ON o.id=s.obra_id WHERE o.empresa_id=? AND o.deleted_at IS NULL AND s.deleted_at IS NULL ORDER BY s.nome').all(companyId)
  options.categorias=db.prepare("SELECT id,nome FROM categorias_financeiras WHERE natureza='despesa' AND ativa=1 ORDER BY nome").all()
  const materialIds=[...new Set(items.map(i=>i.material_id).filter(id=>id!=null))]
  const placeholders=materialIds.length?materialIds.map(()=>'?').join(','):'NULL'
  options.pedidos=db.prepare("SELECT i.id,i.material_id,i.descricao,i.quantidade_pedida,i.quantidade_recebida,i.unidade,p.id pedido_id,p.numero,p.obra_id,p.frente_id,p.status FROM pedido_compra_itens i JOIN pedidos_compra p ON p.id=i.pedido_compra_id JOIN obras o ON o.id=p.obra_id WHERE o.empresa_id=? AND o.deleted_at IS NULL AND p.fornecedor_id=? AND p.deleted_at IS NULL AND p.status!='cancelado' AND i.material_id IN ("+placeholders+") ORDER BY p.id,i.id LIMIT 5001").all(companyId,supplierId,...materialIds)
  options.recebimentos=db.prepare("SELECT r.id,r.pedido_item_id,r.quantidade_recebida,r.data FROM recebimentos_materiais r JOIN pedido_compra_itens i ON i.id=r.pedido_item_id JOIN pedidos_compra p ON p.id=i.pedido_compra_id JOIN obras o ON o.id=p.obra_id WHERE o.empresa_id=? AND p.fornecedor_id=? AND p.deleted_at IS NULL AND o.deleted_at IS NULL AND i.material_id IN ("+placeholders+") AND NOT EXISTS(SELECT 1 FROM nota_recebida_recebimentos l WHERE l.recebimento_id=r.id) ORDER BY r.id LIMIT 5001").all(companyId,supplierId,...materialIds)
  options.contas=db.prepare("SELECT c.id,c.descricao,c.valor_centavos,c.vencimento,c.status,c.pedido_compra_id FROM contas c WHERE c.empresa_id=? AND c.fornecedor_id=? AND c.tipo='pagar' AND c.deleted_at IS NULL AND c.status!='cancelado' AND NOT EXISTS(SELECT 1 FROM nota_recebida_contas l WHERE l.conta_id=c.id) ORDER BY c.vencimento,c.id LIMIT 5001").all(companyId,supplierId)
  if(Object.values(options).some(rows=>rows.length>5000))throw new Error('Volume de opções excede o limite da conferência. Refine cadastros antes de integrar.')
 return options
}
function allocateNfeAccounts(db,noteId,destinations,schedule,accounts,total){
 const scopes=new Map()
 for(const d of destinations){
  const key=JSON.stringify([d.work.id,d.stage?.id??null,d.sub?.id??null])
  const row=scopes.get(key)||{obra:d.work.id,frente:d.stage?.id??null,sub:d.sub?.id??null,remaining:0n}
  row.remaining+=d.cost;scopes.set(key,row)
 }
 const ordered=[...scopes.values()].sort((a,b)=>a.obra-b.obra||(a.frente||0)-(b.frente||0)||(a.sub||0)-(b.sub||0))
 let remaining=total
 const insert=db.prepare('INSERT INTO nota_recebida_rateios(nota_id,conta_id,obra_id,frente_id,subfrente_id,valor_centavos) VALUES(?,?,?,?,?,?)')
 for(const [i,p] of schedule.entries()){
  let cumulative=0n,previous=0n
  for(const s of ordered){
   cumulative+=s.remaining
   const target=cumulative*p.amount/remaining,share=target-previous
   previous=target
   if(share>0n){insert.run(noteId,accounts[i],s.obra,s.frente,s.sub,safeInt(share,'Rateio'));s.remaining-=share}
  }
  remaining-=p.amount
 }
 if(remaining!==0n||ordered.some(s=>s.remaining!==0n))throw new Error('Rateio financeiro divergente.')
}
function nfeDetails(db,payload){
 const note=fiscalRow(db,'notas_recebidas',payload.nota_id,'Nota')
 if(Number(note.empresa_id)!==positiveFiscalId(payload.empresa_id,'Empresa')||note.status_integracao!=='integrada')throw new Error('Nota integrada não encontrada nesta empresa.')
 const itens=db.prepare('SELECT i.*,o.nome obra_nome FROM nota_recebida_itens i JOIN obras o ON o.id=i.obra_id WHERE i.nota_id=? ORDER BY i.id').all(note.id).map(i=>({...i,recebida:quantityText(db.prepare('SELECT quantidade_decimal FROM nota_recebida_recebimentos WHERE nota_item_id=?').all(i.id).reduce((sum,r)=>sum+fixedDecimal(r.quantidade_decimal,6,'Recebimento'),0n))}))
 const contas=db.prepare('SELECT c.id,c.valor_centavos,c.vencimento,c.status FROM nota_recebida_contas l JOIN contas c ON c.id=l.conta_id WHERE l.nota_id=? ORDER BY l.parcela').all(note.id)
 return {nota_id:note.id,empresa_id:note.empresa_id,numero:note.numero,itens,contas}
}
function createNfeIntegrationService(db,{parseXml,saveEntity}={}){
  if(typeof parseXml!=='function'||typeof saveEntity!=='function')throw new Error('Adaptador fiscal de confiança obrigatório.')
  const readXml=payload=>{
    const manual=payload.manual!==undefined?manualNoteSource(db,payload):null
    const {bytes,parsed}=manual?{bytes:null,parsed:manual.parsed}:decodeNfeSource(payload,parseXml)
    const operation={empresa_id:payload.empresa_id,fornecedor_id:payload.fornecedor_id,categoria_id:payload.categoria_id,data_recebimento:payload.data_recebimento,destinos:payload.destinos,parcelas:payload.parcelas}
    const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])):v
    return {bytes,parsed,manual,hash:bytes?createHash('sha256').update(bytes).digest('hex'):null,operationHash:createHash('sha256').update(JSON.stringify(canonical({...operation,...(manual?{manual:payload.manual}:{})}))).digest('hex')}
  }
  const prepare=(payload,raw)=>{
    const n=raw.parsed,company=fiscalRow(db,'empresas',payload.empresa_id,'Empresa'),supplier=fiscalRow(db,'fornecedores',payload.fornecedor_id,'Fornecedor')
    if(company.status==='inativa')throw new Error('Empresa inativa.')
    if(!raw.manual){
    if(company.status==='inativa'||digits(company.cnpj)!==digits(n.destinatario)||!/^\d{14}$/.test(digits(n.destinatario)))throw new Error('Destinatário da NF-e não corresponde à empresa ativa.')
    if(supplier.empresa_id!==null&&Number(supplier.empresa_id)!==Number(company.id))throw new Error('Fornecedor de outra empresa.')
    if(!digits(supplier.documento)||digits(supplier.documento)!==digits(n.documento))throw new Error('Documento do fornecedor não corresponde ao emitente.')
    if(n.ambiente!=='1'||!['100','150'].includes(n.status)||!n.protocolo)throw new Error('Somente XML de produção com protocolo informado pode ser integrado.')
    // Key encodes issuer, model, series and invoice number. A valid check digit alone is insufficient.
    if(!fiscalKeyValid(n.chave)||n.chave.slice(6,20)!==digits(n.documento).padStart(14,'0')||n.chave.slice(20,22)!=='55'||n.chave.slice(22,25)!==String(n.serie).padStart(3,'0')||n.chave.slice(25,34)!==String(n.numero).padStart(9,'0'))throw new Error('Identidade fiscal divergente da chave.')
    fiscalDate(n.emissao)
    if(n.tipo_operacao!=='1'||n.finalidade!=='1'||classifyNfeOperation(n.itens)!=='compra')throw new Error('Somente NF-e de compra normal com CFOP reconhecido pode ser integrada. Devoluções, remessas e operações mistas exigem tratamento próprio.')
    }
    const recognized=raw.manual?manualNoteSource(db,payload).recognized:recognizeNfeMaterials(db,{empresa_id:company.id,fornecedor_id:supplier.id,documento:n.documento,itens:n.itens})
    const recognizedByNumber=new Map(recognized.itens.map(r=>[r.numero,r]))
    if(recognized.itens.some(r=>r.status!=='confirmado'))throw new Error('Confirme a equivalência de cada material antes de integrar.')
    const total=fixedDecimal(n.total,2,'Total fiscal')
    if(total<=0n)throw new Error('Total fiscal deve ser positivo.')
    const sourceItems=new Map(n.itens.map(i=>[String(i.numero),i]))
    if(!sourceItems.size||sourceItems.size!==n.itens.length)throw new Error('Itens fiscais ausentes ou repetidos.')
    const products=n.itens.reduce((sum,i)=>sum+fixedDecimal(i.valor_produto,2,'Total do produto'),0n)
    if(n.total_produtos&&fixedDecimal(n.total_produtos,2,'Total dos produtos')!==products)throw new Error('Total de produtos divergente.')
    if(!Array.isArray(payload.destinos)||!payload.destinos.length||payload.destinos.length>5000)throw new Error('Classifique os destinos dos itens.')
    const byItem=new Map(),destinos=[],scopeKeys=new Set(),usedOrderItems=new Set()
    for(const [index,row] of payload.destinos.entries()){
      const item=sourceItems.get(String(row.nfe_item_numero))
      if(!item)throw new Error('Item fiscal não encontrado.')
      const work=fiscalRow(db,'obras',row.obra_id,'Obra')
      if(Number(work.empresa_id)!==Number(company.id))throw new Error('Obra pertence a outra empresa.')
      const stage=row.frente_id?fiscalRow(db,'frentes_obra',row.frente_id,'Etapa'):null
      if(stage&&Number(stage.obra_id)!==Number(work.id))throw new Error('Etapa de outra obra.')
      const sub=row.subfrente_id?fiscalRow(db,'subfrentes_obra',row.subfrente_id,'Subetapa'):null
      if(sub&&(!stage||Number(sub.obra_id)!==Number(work.id)||Number(sub.frente_id)!==Number(stage.id)))throw new Error('Subetapa incompatível.')
      const qty=fixedDecimal(row.quantidade,6,'Quantidade destinada'),received=fixedDecimal(row.quantidade_recebida??'0',6,'Quantidade recebida'),cost=fixedDecimal(row.valor_alocado,2,'Custo destinado')
      if(qty<=0n||received>qty)throw new Error('Quantidade destinada ou recebida inválida.')
      safeInt(qty,'Quantidade')
      const material=recognizedByNumber.get(String(item.numero))
      if(!material||material.status!=='confirmado')throw new Error('Equivalência de material indisponível.')
      if(material.servico&&(received!==0n||row.pedido_item_id||row.recebimento_existente_id))throw new Error('Serviço não admite recebimento físico ou item de estoque.')
      const stockQty=fixedDecimal(convertNfeQuantity(quantityText(qty),material.fator_num,material.fator_den),6,'Quantidade canônica')
      const stockReceived=fixedDecimal(convertNfeQuantity(quantityText(received),material.fator_num,material.fator_den),6,'Recebimento canônico')
      const actual=byItem.get(String(item.numero))||{qty:0n,cost:0n}
      actual.qty+=qty;actual.cost+=cost;byItem.set(String(item.numero),actual)
      const category=fiscalRow(db,'categorias_financeiras',row.categoria_id??payload.categoria_id,'Categoria')
      if(category.natureza!=='despesa'||!category.ativa)throw new Error('Categoria financeira inválida.')
      let orderItem=null,order=null
      if(row.pedido_item_id){
        orderItem=fiscalRow(db,'pedido_compra_itens',row.pedido_item_id,'Item do pedido')
        order=fiscalRow(db,'pedidos_compra',orderItem.pedido_compra_id,'Pedido')
        if(order.status==='cancelado')throw new Error('Pedido cancelado não pode receber materiais.')
        if(Number(order.obra_id)!==Number(work.id)||Number(order.fornecedor_id)!==Number(supplier.id)||Number(order.frente_id||0)!==Number(stage?.id||0))throw new Error('Pedido incompatível com destino ou fornecedor.')
        if(Number(orderItem.material_id)!==material.material_id||String(orderItem.unidade).trim().toLowerCase()!==String(material.unidade).trim().toLowerCase())throw new Error('Material canônico do pedido diverge do item fiscal; concilie antes de confirmar.')
        if(usedOrderItems.has(orderItem.id))throw new Error('O mesmo item de pedido não pode ser apropriado duas vezes.')
        usedOrderItems.add(orderItem.id)
        if(Number(stockReceived)/1e6+Number(orderItem.quantidade_recebida)>Number(orderItem.quantidade_pedida)+1e-9&&!row.recebimento_existente_id)throw new Error('Recebimento excede o pedido.')
      }
      let existingReceipt=null
      if(row.recebimento_existente_id){
        existingReceipt=fiscalRow(db,'recebimentos_materiais',row.recebimento_existente_id,'Recebimento')
        if(!orderItem||Number(existingReceipt.pedido_item_id)!==Number(orderItem.id)||fixedDecimal(existingReceipt.quantidade_recebida,6,'Recebimento existente')!==stockReceived||received<=0n)throw new Error('Recebimento existente incompatível.')
        if(db.prepare('SELECT id FROM nota_recebida_recebimentos WHERE recebimento_id=?').get(existingReceipt.id))throw new Error('Recebimento já vinculado a uma NF-e.')
      }else if(orderItem&&Number(orderItem.quantidade_recebida)>0&&received>0n)throw new Error('Pedido já possui recebimentos: concilie os recebimentos anteriores antes de registrar novas entradas.')
      const key=JSON.stringify([work.id,stage?.id||null,category.id])
      scopeKeys.add(key)
      destinos.push({index,item,work,stage,sub,qty,received,stockQty,stockReceived,material,cost,category,orderItem,order,existingReceipt})
    }
    for(const [number,item] of sourceItems){
      const allocated=byItem.get(number)
      if(!allocated||allocated.qty!==fixedDecimal(item.quantidade,6,'Quantidade fiscal'))throw new Error('Quantidade dos destinos diverge do item '+number+'.')
    }
    if(raw.manual){for(const [number,item] of sourceItems)if(byItem.get(number).cost!==fixedDecimal(item.valor_produto,2,'Total do item'))throw new Error('Rateio manual deve preservar o total de cada item.')}
    if(destinos.reduce((s,x)=>s+x.cost,0n)!==total)throw new Error('Rateio de custos deve reconciliar integralmente o total fiscal.')
    // No invented due dates. If XML has no duplicatas, the operator supplies an explicit schedule.
    const parcelas=Array.isArray(payload.parcelas)?payload.parcelas:[]
    if(!parcelas.length||parcelas.length>1000)throw new Error('Informe as parcelas e vencimentos.')
    const seenAccounts=new Set()
    const schedule=parcelas.map((p,i)=>{
      const amount=fixedDecimal(p.valor,2,'Valor da parcela'),due=fiscalDate(p.vencimento)
      if(amount<=0n)throw new Error('Valor da parcela inválido.')
      const linked=p.conta_id?fiscalRow(db,'contas',p.conta_id,'Conta'):null
      if(linked){
        if(Number(linked.categoria_id)!==Number(destinos[0].category.id)||linked.competencia!==n.emissao.slice(0,7))throw new Error('Conta existente precisa ter a mesma categoria e competência da NF-e.')
        if(seenAccounts.has(linked.id)||Number(linked.empresa_id)!==Number(company.id)||Number(linked.fornecedor_id)!==Number(supplier.id)||linked.tipo!=='pagar'||linked.status==='cancelado'||BigInt(linked.valor_centavos)!==amount||linked.vencimento!==due)throw new Error('Conta existente incompatível com a parcela.')
        if(db.prepare('SELECT nota_id FROM nota_recebida_contas WHERE conta_id=?').get(linked.id)||db.prepare('SELECT id FROM notas_recebidas WHERE conta_id=? AND deleted_at IS NULL').get(linked.id))throw new Error('Conta já vinculada a uma nota.')
        seenAccounts.add(linked.id)
      }
      return {number:i+1,amount,due,linked}
    })
    if(schedule.reduce((s,x)=>s+x.amount,0n)!==total)throw new Error('Parcelas não reconciliam o valor fiscal.')
    if(n.parcelas.length){
      if(n.parcelas.length!==schedule.length||n.parcelas.some((p,i)=>fixedDecimal(p.valor,2,'Duplicata')!==schedule[i].amount||(p.vencimento&&p.vencimento!==schedule[i].due)))throw new Error('Parcelas divergem do XML; conciliação explícita necessária.')
    }
    // Existing purchase commitments must be reused, not silently doubled.
    for(const {order} of destinos){
      if(!order)continue
      const candidates=db.prepare("SELECT id FROM contas WHERE pedido_compra_id=? AND tipo='pagar' AND status!='cancelado' AND deleted_at IS NULL").all(order.id)
      if(candidates.some(c=>!seenAccounts.has(c.id))||(order.conta_id&&!seenAccounts.has(order.conta_id)))throw new Error('Concilie as contas já criadas pelo pedido.')
    }
    // An unlinked exact match is a possible manual obligation; never auto-create another.
    for(const p of schedule){
      if(p.linked)continue
      const matches=db.prepare("SELECT id FROM contas WHERE empresa_id=? AND fornecedor_id=? AND tipo='pagar' AND valor_centavos=? AND vencimento=? AND status!='cancelado' AND deleted_at IS NULL").all(company.id,supplier.id,safeInt(p.amount,'Parcela'),p.due)
      if(matches.some(m=>!seenAccounts.has(m.id)))throw new Error('Existe possível conta a pagar duplicada. Concilie antes de importar.')
    }
    // Multiple cost centers are carried by destinations. Do not falsely assign an entire obligation to one work.
    const sameScope=scopeKeys.size===1
    const categoryIds=new Set(destinos.map(d=>Number(d.category.id)))
    if(categoryIds.size!==1)throw new Error('Para esta versão do núcleo, use uma classificação financeira única por NF-e; rateio entre categorias exige projeção homologada.')
    return {n,company,supplier,total,products,destinos,schedule,sameScope}
  }
  function commit(payload){
    const raw=readXml(payload)
    const companyId=positiveFiscalId(payload.empresa_id,'Empresa')
    db.exec('BEGIN IMMEDIATE')
    try{
      const manualRequest=raw.manual?'manual:'+raw.operationHash:null
      const existing=raw.manual?db.prepare('SELECT id,status_integracao FROM notas_recebidas WHERE empresa_id=? AND request_id=?').get(companyId,manualRequest):db.prepare('SELECT n.id,n.status_integracao,x.sha256,x.operacao_sha256 FROM notas_recebidas n JOIN nota_recebida_xml x ON x.nota_id=n.id WHERE n.empresa_id=? AND n.chave_acesso=?').get(companyId,raw.parsed.chave)
      if(existing){
        if((!raw.manual&&(existing.sha256!==raw.hash||existing.operacao_sha256!==raw.operationHash))||existing.status_integracao!=='integrada')throw new Error('Chave fiscal já utilizada ou estornada; revise o registro original.')
        db.exec('COMMIT')
        return {nota_id:Number(existing.id),replayed:true}
      }
      const p=prepare(payload,raw),n=p.n
      if(db.prepare('SELECT id FROM notas_recebidas WHERE empresa_id=? AND fornecedor_id=? AND numero=? AND serie=? AND deleted_at IS NULL').get(p.company.id,p.supplier.id,n.numero,n.serie))throw new Error('Nota documental já cadastrada. Conciliação manual necessária; nenhuma duplicata será criada.')
      const principal=p.destinos[0].work.id
      const orderIds=[...new Set(p.destinos.filter(d=>d.order).map(d=>Number(d.order.id)))]
      const result=db.prepare("INSERT INTO notas_recebidas(empresa_id,obra_id,fornecedor_id,numero,serie,emissao,valor_total_centavos,pedido_compra_id,chave_acesso,status_integracao,total_produtos_centavos,request_id,observacoes) VALUES(?,?,?,?,?,?,?,?,?,'integrada',?,?,?)").run(p.company.id,principal,p.supplier.id,n.numero,n.serie,n.emissao,safeInt(p.total,'Total'),orderIds.length===1?orderIds[0]:null,n.chave??null,safeInt(p.products,'Produtos'),manualRequest,n.observacoes??null)
      const id=Number(result.lastInsertRowid)
      if(!raw.manual)db.prepare('INSERT INTO nota_recebida_xml(nota_id,sha256,operacao_sha256,xml_original,ambiente,protocolo) VALUES(?,?,?,?,?,?)').run(id,raw.hash,raw.operationHash,raw.bytes,n.ambiente,n.protocolo)
      const insert=db.prepare('INSERT INTO nota_recebida_itens(nota_id,obra_id,frente_id,subfrente_id,pedido_item_id,descricao,unidade,quantidade,valor_unitario_centavos,valor_total_centavos,nfe_item_numero,quantidade_decimal,valor_unitario_decimal,material_id,unidade_canonica,fator_num,fator_den,quantidade_canonica_decimal) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      const receipt=db.prepare('INSERT INTO nota_recebida_recebimentos(nota_id,nota_item_id,movimento_id,recebimento_id,quantidade_decimal,origem,request_id,data) VALUES(?,?,?,?,?,?,?,?)')
      const date=payload.data_recebimento?fiscalDate(payload.data_recebimento):null
      for(const dest of p.destinos){
        const qty=Number(dest.qty)/1e6
        const cost=safeInt(dest.cost,'Custo')
        const itemId=Number(insert.run(id,dest.work.id,dest.stage?.id??null,dest.sub?.id??null,dest.orderItem?.id??null,dest.item.descricao,dest.item.unidade,qty,Math.round(cost/qty),cost,String(dest.item.numero),quantityText(dest.qty),String(dest.item.valor_unitario),dest.material.material_id,dest.material.unidade,dest.material.fator_num,dest.material.fator_den,quantityText(dest.stockQty)).lastInsertRowid)
        if(dest.received===0n)continue
        if(!date&&!dest.existingReceipt)throw new Error('Confirme a data do recebimento físico.')
        let movement=null,receivedId=null
        if(dest.existingReceipt){receivedId=dest.existingReceipt.id}
        else {
          const quantity=Number(dest.stockReceived)/1e6
          const stock={obra_id:dest.work.id,frente_id:dest.stage?.id??null,pedido_item_id:dest.orderItem?.id??null,tipo:'entrada',material_id:dest.material.material_id,descricao:dest.material.descricao,unidade:dest.material.unidade,quantidade:quantity,data:date,observacoes:raw.manual?'Nota manual '+n.numero:'NF-e '+n.chave,request_id:'nfe:'+id+':'+itemId}
          validateStockMovement(db,stock)
          if(dest.orderItem){
            const r=saveEntity('recebimentos_materiais',{pedido_compra_id:dest.order.id,pedido_item_id:dest.orderItem.id,obra_id:dest.work.id,frente_id:dest.stage?.id??null,data:date,quantidade_pedida:dest.orderItem.quantidade_pedida,quantidade_recebida:quantity,nota_fiscal:n.numero,request_id:'nfe-receipt:'+id+':'+itemId})
            receivedId=r.id
            saveEntity('pedido_compra_itens',{id:dest.orderItem.id,quantidade_recebida:Number(dest.orderItem.quantidade_recebida)+quantity})
            const pending=db.prepare('SELECT COUNT(*) total FROM pedido_compra_itens WHERE pedido_compra_id=? AND quantidade_recebida<quantidade_pedida').get(dest.order.id).total
            saveEntity('pedidos_compra',{id:dest.order.id,status:Number(pending)>0?'recebido_parcial':'recebido'})
          }
          movement=saveEntity('movimentacoes_estoque',stock)
        }
        receipt.run(id,itemId,movement?.id??null,receivedId,quantityText(dest.received),dest.existingReceipt?'existente':'novo','nfe:'+id+':'+itemId,date||dest.existingReceipt.data)
      }
      const accounts=[]
      for(const part of p.schedule){
        const scope=p.destinos[0]
        const account=part.linked||saveEntity('contas',{empresa_id:p.company.id,obra_id:p.sameScope?scope.work.id:null,frente_id:p.sameScope?scope.stage?.id??null:null,fornecedor_id:p.supplier.id,categoria_id:scope.category.id,tipo:'pagar',descricao:(raw.manual?'Nota manual ':'NF-e ')+n.numero+' — parcela '+part.number,competencia:n.emissao.slice(0,7),emissao:n.emissao,vencimento:part.due,valor_bruto_centavos:safeInt(part.amount,'Parcela'),valor_centavos:safeInt(part.amount,'Parcela'),status:'pendente',parcela_atual:part.number,total_parcelas:p.schedule.length,origem_tipo:'nota_recebida',origem_id:id})
        db.prepare('INSERT INTO nota_recebida_contas(nota_id,conta_id,parcela,criada_na_importacao) VALUES(?,?,?,?)').run(id,account.id,part.number,part.linked?0:1)
        accounts.push(Number(account.id))
      }
      allocateNfeAccounts(db,id,p.destinos,p.schedule,accounts,p.total)
      const receiptDate=p.destinos.some(d=>d.received>0n)?(date||p.destinos.find(d=>d.existingReceipt)?.existingReceipt?.data||null):null
      db.prepare('UPDATE notas_recebidas SET conta_id=?,data_recebimento=? WHERE id=?').run(accounts.length===1?accounts[0]:null,receiptDate,id)
      db.exec('COMMIT')
      return {nota_id:id,contas:accounts,replayed:false}
    }catch(e){try{db.exec('ROLLBACK')}catch{}throw e}
  }

  function activeNote(payload){
    const note=fiscalRow(db,'notas_recebidas',payload.nota_id,'Nota')
    if(Number(note.empresa_id)!==positiveFiscalId(payload.empresa_id,'Empresa')||note.status_integracao!=='integrada'||(!note.chave_acesso&&!String(note.request_id||'').startsWith('manual:')))throw new Error('Nota fiscal ativa não encontrada nesta empresa.')
    return note
  }
  function operationId(value){
    const id=String(value??'').trim()
    if(!/^[A-Za-z0-9:_-]{1,100}$/.test(id))throw new Error('Identificador de operação inválido.')
    return id
  }
  function receive(payload){
    const requestId='nfe-followup:'+operationId(payload.request_id),data=fiscalDate(payload.data)
    const qty=fixedDecimal(payload.quantidade,6,'Quantidade recebida')
    if(qty<=0n)throw new Error('Quantidade recebida deve ser positiva.')
    safeInt(qty,'Quantidade')
    db.exec('BEGIN IMMEDIATE')
    try{
      const note=activeNote(payload),item=fiscalRow(db,'nota_recebida_itens',payload.nota_item_id,'Destino fiscal')
      if(Number(item.nota_id)!==Number(note.id))throw new Error('Destino não pertence à nota.')
      const replay=db.prepare('SELECT * FROM nota_recebida_recebimentos WHERE request_id=?').get(requestId)
      if(replay){
        if(Number(replay.nota_id)!==Number(note.id)||Number(replay.nota_item_id)!==Number(item.id)||fixedDecimal(replay.quantidade_decimal,6,'Quantidade')!==qty||replay.data!==data)throw new Error('Identificador já utilizado em outro recebimento.')
        db.exec('COMMIT');return {recebimento_id:Number(replay.id),replayed:true}
      }
      const prior=db.prepare('SELECT quantidade_decimal FROM nota_recebida_recebimentos WHERE nota_item_id=?').all(item.id).reduce((sum,r)=>sum+fixedDecimal(r.quantidade_decimal,6,'Quantidade registrada'),0n)
      if(prior+qty>fixedDecimal(item.quantidade_decimal,6,'Quantidade destinada'))throw new Error('Recebimento supera quantidade destinada.')
      if(!item.material_id||!item.unidade_canonica||!item.fator_num||!item.fator_den)throw new Error('Destino fiscal sem equivalência canônica; conciliação necessária.')
      const material=resolveStockMaterial(db,{obra_id:item.obra_id||note.obra_id,material_id:item.material_id,unidade:item.unidade_canonica})
      const converted=convertNfeQuantity(quantityText(qty),item.fator_num,item.fator_den)
      let receivedId=null
      if(item.pedido_item_id){
        const orderItem=fiscalRow(db,'pedido_compra_itens',item.pedido_item_id,'Item do pedido')
        const order=fiscalRow(db,'pedidos_compra',orderItem.pedido_compra_id,'Pedido')
        const quantity=Number(converted)
        if(order.status==='cancelado'||Number(order.obra_id)!==Number(item.obra_id||note.obra_id)||Number(order.fornecedor_id)!==Number(note.fornecedor_id)||Number(order.frente_id||0)!==Number(item.frente_id||0)||Number(orderItem.material_id)!==Number(material.id))throw new Error('Pedido alterado ou incompatível com o destino fiscal.')
        if(Number(orderItem.quantidade_recebida)+quantity>Number(orderItem.quantidade_pedida)+1e-9)throw new Error('Recebimento excede o pedido.')
        const r=saveEntity('recebimentos_materiais',{pedido_compra_id:order.id,pedido_item_id:orderItem.id,obra_id:order.obra_id,frente_id:order.frente_id??null,data,quantidade_pedida:orderItem.quantidade_pedida,quantidade_recebida:quantity,nota_fiscal:note.numero,request_id:requestId+':receipt'})
        receivedId=r.id
        saveEntity('pedido_compra_itens',{id:orderItem.id,quantidade_recebida:Number(orderItem.quantidade_recebida)+quantity})
        const pending=db.prepare('SELECT COUNT(*) total FROM pedido_compra_itens WHERE pedido_compra_id=? AND quantidade_recebida<quantidade_pedida').get(order.id).total
        saveEntity('pedidos_compra',{id:order.id,status:Number(pending)>0?'recebido_parcial':'recebido'})
      }
      const stock={obra_id:item.obra_id||note.obra_id,frente_id:item.frente_id??null,pedido_item_id:item.pedido_item_id??null,tipo:'entrada',material_id:material.id,descricao:material.descricao,unidade:material.unidade,quantidade:Number(converted),data,observacoes:(note.chave_acesso?'NF-e '+note.chave_acesso:'Nota manual '+note.numero)+' — recebimento posterior',request_id:requestId}
      validateStockMovement(db,stock)
      const movement=saveEntity('movimentacoes_estoque',stock)
      const result=db.prepare("INSERT INTO nota_recebida_recebimentos(nota_id,nota_item_id,movimento_id,recebimento_id,quantidade_decimal,origem,request_id,data) VALUES(?,?,?,?,?,'novo',?,?)").run(note.id,item.id,movement.id,receivedId,quantityText(qty),requestId,data)
      db.prepare('UPDATE notas_recebidas SET data_recebimento=COALESCE(data_recebimento,?),updated_at=CURRENT_TIMESTAMP WHERE id=?').run(data,note.id)
      db.exec('COMMIT');return {recebimento_id:Number(result.lastInsertRowid),replayed:false}
    }catch(e){try{db.exec('ROLLBACK')}catch{}throw e}
  }
  function reverse(payload){
    const requestId='nfe-reverse:'+operationId(payload.request_id),data=fiscalDate(payload.data)
    const reason=String(payload.motivo??'').trim(),actor=String(payload.operador??'').trim()
    if(!reason||reason.length>2000||!actor||actor.length>120)throw new Error('Informe motivo e operador do estorno.')
    db.exec('BEGIN IMMEDIATE')
    try{
      const replay=db.prepare('SELECT e.*,n.empresa_id FROM nota_recebida_estornos e JOIN notas_recebidas n ON n.id=e.nota_id WHERE e.request_id=?').get(requestId)
      if(replay){
        if(Number(replay.nota_id)!==Number(payload.nota_id)||Number(replay.empresa_id)!==Number(payload.empresa_id)||replay.motivo!==reason||replay.operador!==actor||replay.data!==data)throw new Error('Identificador já utilizado em outro estorno.')
        db.exec('COMMIT');return {estorno_id:Number(replay.id),replayed:true}
      }
      const note=activeNote(payload)
      const accounts=db.prepare('SELECT l.*,c.status,c.deleted_at FROM nota_recebida_contas l JOIN contas c ON c.id=l.conta_id WHERE l.nota_id=?').all(note.id)
      if(accounts.some(a=>!a.criada_na_importacao||a.deleted_at||!['pendente','vencido'].includes(a.status)||db.prepare('SELECT id FROM pagamentos_conta WHERE conta_id=? LIMIT 1').get(a.conta_id)))throw new Error('Existem contas preexistentes, pagas ou alteradas; concilie antes de estornar.')
      const receipts=db.prepare('SELECT r.*,i.pedido_item_id,i.fator_num,i.fator_den FROM nota_recebida_recebimentos r JOIN nota_recebida_itens i ON i.id=r.nota_item_id WHERE r.nota_id=?').all(note.id)
      if(receipts.some(r=>r.origem!=='novo'||!r.movimento_id))throw new Error('Nota possui recebimento preexistente; estorno exige conciliação manual para não desfazer entrada anterior à NF-e.')
      const result=db.prepare('INSERT INTO nota_recebida_estornos(nota_id,request_id,motivo,operador,data) VALUES(?,?,?,?,?)').run(note.id,requestId,reason,actor,data)
      const id=Number(result.lastInsertRowid)
      const touchedOrders=new Set()
      for(const r of receipts){
        const movement=fiscalRow(db,'movimentacoes_estoque',r.movimento_id,'Movimentação original')
        if(movement.tipo!=='entrada'||fixedDecimal(convertNfeQuantity(r.quantidade_decimal,r.fator_num,r.fator_den),6,'Quantidade original')!==fixedDecimal(movement.quantidade,6,'Movimentação original'))throw new Error('Movimentação original divergente.')
        const reversal={obra_id:movement.obra_id,frente_id:movement.frente_id??null,tipo:'saida',material_id:movement.material_id,descricao:movement.descricao,unidade:movement.unidade,quantidade:movement.quantidade,data,observacoes:note.chave_acesso?'Estorno NF-e '+note.chave_acesso:'Estorno nota manual '+note.numero,request_id:'nfe-reverse-mov:'+id+':'+r.id}
        validateStockMovement(db,reversal)
        const saved=saveEntity('movimentacoes_estoque',reversal)
        db.prepare('INSERT INTO nota_recebida_estorno_movimentos(estorno_id,recebimento_fiscal_id,movimento_id) VALUES(?,?,?)').run(id,r.id,saved.id)
        if(r.pedido_item_id){
          const item=fiscalRow(db,'pedido_compra_itens',r.pedido_item_id,'Item do pedido')
          const order=fiscalRow(db,'pedidos_compra',item.pedido_compra_id,'Pedido')
          const receipt=fiscalRow(db,'recebimentos_materiais',r.recebimento_id,'Recebimento')
          if(order.status==='cancelado'||Number(receipt.pedido_item_id)!==Number(item.id)||Number(receipt.quantidade_recebida)!==Number(movement.quantidade)||Number(item.quantidade_recebida)+1e-9<Number(movement.quantidade))throw new Error('Pedido ou recebimento alterado; conciliação obrigatória.')
          saveEntity('pedido_compra_itens',{id:item.id,quantidade_recebida:Number(item.quantidade_recebida)-Number(movement.quantidade)})
          touchedOrders.add(order.id)
        }
      }
      for(const orderId of touchedOrders){
        const totals=db.prepare('SELECT SUM(quantidade_recebida) received,SUM(CASE WHEN quantidade_recebida<quantidade_pedida THEN 1 ELSE 0 END) pending FROM pedido_compra_itens WHERE pedido_compra_id=?').get(orderId)
        saveEntity('pedidos_compra',{id:orderId,status:Number(totals.received||0)===0?'emitido':Number(totals.pending)>0?'recebido_parcial':'recebido'})
      }
      db.prepare("UPDATE notas_recebidas SET status_integracao='estornada',deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(note.id)
      for(const account of accounts)saveEntity('contas',{id:account.conta_id,status:'cancelado'})
      db.exec('COMMIT');return {estorno_id:id,replayed:false}
    }catch(e){try{db.exec('ROLLBACK')}catch{}throw e}
  }

  return {commit,receive,reverse}
}


/** Catalog metadata is distinct from stock balances. All actions scoped to company. */
function materialCatalog(db,{empresa_id,q='',offset=0,limit=50}={}){
  const company=Number(empresa_id),page=Number(offset),size=Number(limit)
  if(!Number.isSafeInteger(company)||company<1||!Number.isSafeInteger(page)||page<0||!Number.isSafeInteger(size)||size<1||size>100)throw new Error('Filtro de catálogo inválido.')
  if(!db.prepare('SELECT id FROM empresas WHERE id=? AND deleted_at IS NULL').get(company))throw new Error('Empresa não encontrada.')
  const search=String(q).trim().slice(0,200)
  const where=" WHERE c.empresa_id=? AND NOT EXISTS(SELECT 1 FROM material_reclassificacoes r WHERE r.origem_id=c.id) AND (instr(lower(c.descricao),lower(?))>0 OR instr(lower(c.unidade),lower(?))>0 OR EXISTS(SELECT 1 FROM material_fornecedor_equivalencias e WHERE e.material_id=c.id AND (instr(lower(e.codigo),lower(?))>0 OR instr(lower(e.descricao_origem),lower(?))>0)))"
  const args=[company,search,search,search,search]
  const total=Number(db.prepare('SELECT COUNT(*) total FROM materiais_estoque c'+where).get(...args).total)
  const rows=db.prepare('SELECT c.*,(SELECT COUNT(*) FROM material_fornecedor_equivalencias e WHERE e.material_id=c.id) equivalencias FROM materiais_estoque c'+where+' ORDER BY c.descricao,c.unidade,c.id LIMIT ? OFFSET ?').all(...args,size,page)
  return {rows,total}
}
function materialAliases(db,{empresa_id,material_id,offset=0}={}){
  const company=Number(empresa_id),id=Number(material_id),page=Number(offset)
  if(!Number.isSafeInteger(company)||company<1||!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(page)||page<0)throw new Error('Filtro de equivalências inválido.')
  if(!db.prepare('SELECT id FROM materiais_estoque WHERE empresa_id=? AND id=?').get(company,id))throw new Error('Material não encontrado nesta empresa.')
  const total=Number(db.prepare('SELECT COUNT(*) total FROM material_fornecedor_equivalencias WHERE empresa_id=? AND material_id=?').get(company,id).total)
  const rows=db.prepare('SELECT e.*,f.nome fornecedor_nome FROM material_fornecedor_equivalencias e JOIN fornecedores f ON f.id=e.fornecedor_id WHERE e.empresa_id=? AND e.material_id=? ORDER BY f.nome,e.codigo,e.id LIMIT 50 OFFSET ?').all(company,id,page)
  return {rows,total}
}
function saveMaterialCatalog(db,saveEntity,payload){
  const company=positiveFiscalId(payload.empresa_id,'Empresa')
  fiscalRow(db,'empresas',company,'Empresa')
  const attrs=payload.atributos||{}
  if(!attrs||typeof attrs!=='object'||Array.isArray(attrs))throw new Error('Atributos inválidos.')
  const allowed=['categoria','material','aplicacao','marca','referencia','diametro','comprimento','dimensoes','especificacao']
  if(Object.keys(attrs).some(k=>!allowed.includes(k)||typeof attrs[k]!=='string'||attrs[k].length>200))throw new Error('Atributos inválidos.')
  const attributes=JSON.stringify(Object.fromEntries(Object.entries(attrs).map(([k,v])=>[k,v.trim()]).filter(([,v])=>v)))
  if(payload.id){
    const existing=fiscalRow(db,'materiais_estoque',payload.id,'Material')
    if(Number(existing.empresa_id)!==company)throw new Error('Material de outra empresa.')
    if(db.prepare('SELECT id FROM material_reclassificacoes WHERE origem_id=?').get(existing.id))throw new Error('Material reclassificado: utilize o destino.')
    return saveEntity('materiais_estoque',{id:existing.id,atributos_json:attributes,origem:'confirmado'})
  }
  const descricao=String(payload.descricao||'').trim(),unidade=String(payload.unidade||'').trim()
  if(!descricao||descricao.length>250||!unidade||unidade.length>24)throw new Error('Informe material e unidade canônica.')
  if(db.prepare('SELECT id FROM materiais_estoque WHERE empresa_id=? AND lower(trim(descricao))=lower(trim(?)) AND lower(trim(unidade))=lower(trim(?))').get(company,descricao,unidade))throw new Error('Já existe material com esta descrição e unidade. Selecione o registro existente.')
  return saveEntity('materiais_estoque',{empresa_id:company,descricao,unidade,atributos_json:attributes,origem:'confirmado'})
}
function confirmMaterialAlias(db,saveEntity,payload,actor){
  const company=positiveFiscalId(payload.empresa_id,'Empresa'),material=fiscalRow(db,'materiais_estoque',payload.material_id,'Material')
  const supplier=fiscalRow(db,'fornecedores',payload.fornecedor_id,'Fornecedor')
  fiscalRow(db,'empresas',company,'Empresa')
  if(Number(material.empresa_id)!==company||(supplier.empresa_id!=null&&Number(supplier.empresa_id)!==company))throw new Error('Material ou fornecedor de outra empresa.')
  const document=digits(supplier.documento)
  if(!/^\d{11}$|^\d{14}$/.test(document))throw new Error('Cadastre CPF/CNPJ do fornecedor antes de confirmar equivalências.')
  const codigo=String(payload.codigo||'').trim(),unidade=String(payload.unidade_comercial||'').trim(),descricao=String(payload.descricao_origem||'').trim(),gtin=String(payload.gtin||'').trim()
  const num=positiveFiscalId(payload.fator_num,'Fator numerador'),den=positiveFiscalId(payload.fator_den,'Fator denominador')
  const operador=String(actor||'').trim()
  if(!codigo||codigo.length>120||!unidade||unidade.length>24||!descricao||descricao.length>500||num>1e9||den>1e9||!operador||operador.length>120||(gtin&&!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(gtin)))throw new Error('Dados da equivalência inválidos.')
  const existing=db.prepare('SELECT * FROM material_fornecedor_equivalencias WHERE empresa_id=? AND fornecedor_id=? AND trim(codigo)=? AND lower(trim(unidade_comercial))=lower(?)').get(company,supplier.id,codigo,unidade)
  if(existing){
    if(Number(existing.material_id)!==Number(material.id)||BigInt(existing.fator_num)*BigInt(den)!==BigInt(num)*BigInt(existing.fator_den)||String(existing.gtin||'')!==gtin)throw new Error('Código já possui vínculo ou conversão diferente. Não será substituído automaticamente.')
    return {...existing,replayed:true}
  }
  return saveEntity('material_fornecedor_equivalencias',{empresa_id:company,fornecedor_id:supplier.id,material_id:material.id,codigo,unidade_comercial:unidade,descricao_origem:descricao,gtin:gtin||null,fator_num:num,fator_den:den,confirmado_por:operador})
}


function stockRevision(db,filters={}){
 const company=filters.empresa_id?positiveFiscalId(filters.empresa_id,'Empresa'):null
 const work=filters.obra_id?fiscalRow(db,'obras',filters.obra_id,'Obra'):null
 if(work&&company&&Number(work.empresa_id)!==company)throw new Error('Obra de outra empresa.')
 const companyId=work?Number(work.empresa_id):company
 const keys=work?['obra:'+work.id,'catalogo:'+companyId,'catalogo:0']:company?['empresa:'+company,'catalogo:'+company,'catalogo:0']:['all']
 const identity=db.prepare('SELECT uid FROM estoque_revisao_identidade WHERE id=1').get().uid
 return {revision:identity+':'+keys.map(k=>Number(db.prepare('SELECT revisao FROM estoque_revisoes WHERE escopo=?').get(k)?.revisao||0)).join(':')}
}


function materialReclassificationPreview(db,payload){
 const company=positiveFiscalId(payload.empresa_id,'Empresa')
 const a=fiscalRow(db,'materiais_estoque',payload.origem_id,'Material de origem'),b=fiscalRow(db,'materiais_estoque',payload.destino_id,'Material de destino')
 if(a.id===b.id||Number(a.empresa_id)!==company||Number(b.empresa_id)!==company||a.unidade.trim().toLowerCase()!==b.unidade.trim().toLowerCase())throw new Error('Selecione materiais distintos da mesma empresa e unidade.')
 if(db.prepare('SELECT id FROM material_reclassificacoes WHERE origem_id IN (?,?) OR destino_id=?').get(a.id,b.id,a.id))throw new Error('Reclassificação já existente ou cadeia de reclassificações.')
 if(db.prepare('SELECT id FROM material_fornecedor_equivalencias WHERE material_id=?').get(a.id))throw new Error('Origem possui equivalências confirmadas. Preserve-a como destino ou revise os vínculos.')
 const attrsA=JSON.parse(a.atributos_json||'{}'),attrsB=JSON.parse(b.atributos_json||'{}')
 for(const [key,value] of Object.entries(attrsA))if(value&&String(value).trim().toLowerCase()!==String(attrsB[key]||'').trim().toLowerCase())throw new Error('Atributo '+key+' diverge ou está ausente no destino. Revise os atributos antes de confirmar.')
 const counts={movimentacoes:Number(db.prepare('SELECT COUNT(*) n FROM movimentacoes_estoque WHERE material_id=?').get(a.id).n),pedidos:Number(db.prepare('SELECT COUNT(*) n FROM pedido_compra_itens WHERE material_id=?').get(a.id).n)}
 const revision=stockRevision(db,{empresa_id:company}).revision
 return {origem:{id:a.id,descricao:a.descricao,unidade:a.unidade},destino:{id:b.id,descricao:b.descricao,unidade:b.unidade},...counts,revision}
}
function confirmMaterialReclassification(db,saveEntity,payload,actor){
 const reason=String(payload.motivo||'').trim(),operator=String(actor||'').trim()
 if(payload.confirmado!==true||!reason||reason.length>500||!operator||operator.length>120)throw new Error('Confirme a equivalência física e informe o motivo.')
 const impact=materialReclassificationPreview(db,payload)
 if(payload.revision!==impact.revision)throw new Error('Estoque ou catálogo alterado; refaça a prévia.')
 return saveEntity('material_reclassificacoes',{empresa_id:Number(payload.empresa_id),origem_id:impact.origem.id,destino_id:impact.destino.id,operador:operator,motivo:reason,movimentacoes:impact.movimentacoes,pedidos:impact.pedidos})
}


// P1: no model, network or external dependency. Scores are rankings, not probabilities.
const nfeWords=Object.freeze({tb:'tubo',tub:'tubo',esg:'esgoto',sold:'soldavel',rosc:'roscavel',sn:'normal',sr:'reforcada',reg:'registro',jo:'joelho',red:'reducao',lu:'luva',cx:'caixa',br:'barra',mt:'m',mts:'m',milimetros:'mm',metros:'m'})
function normalizeNfeDescription(value){
 return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/(\d),(\d)/g,'$1.$2').replace(/\bdn\s*(\d+)/g,'dn $1').replace(/(\d)(mm|cm|mts?|m)\b/g,'$1 $2').replace(/[^a-z0-9.]+/g,' ').trim().split(/\s+/).filter(Boolean).map(w=>nfeWords[w]||w).join(' ')
}
function nfeTechnicalAttributes(description,explicit={}){
 const text=normalizeNfeDescription(description),tokens=new Set(text.split(' '))
 const pick=values=>values.find(x=>tokens.has(x))||''
 const diameter=[...text.matchAll(/\b(?:dn\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*mm)\b/g)].map(m=>String(Number(m[1]||m[2])))
 const lengths=[...text.matchAll(/\b(\d+(?:\.\d+)?)\s*(cm|m)\b/g)].map(m=>String(Number(m[1])*(m[2]==='cm'?0.01:1)))
 const attributes={categoria:pick(['tubo','joelho','luva','registro','reducao','adaptador','te','cimento','areia','brita','cabo','fio','parafuso']),material:pick(['pvc','cpvc','ppr','pex','cobre','aco','ferro','concreto','polietileno']),aplicacao:pick(['esgoto','soldavel','roscavel','gas','eletrico','agua']),diametro:[...new Set(diameter)].sort().join('/'),comprimento:[...new Set(lengths)].sort().join('/'),serie:pick(['normal','reforcada'])}
 for(const key of ['categoria','material','aplicacao','diametro','comprimento','serie','marca','referencia','dimensoes','especificacao']){
  if(!explicit[key])continue
  const v=normalizeNfeDescription(explicit[key])
  if(key==='diametro'){const match=v.match(/^(?:dn )?(\d+(?:\.\d+)?)(?: mm)?$/);attributes[key]=match?String(Number(match[1])):v}
  else if(key==='comprimento'){const match=v.match(/^(\d+(?:\.\d+)?)\s*(m|cm)?$/);attributes[key]=match?String(Number(match[1])*(match[2]==='cm'?0.01:1)):v}
  else attributes[key]=v
 }
 return Object.fromEntries(Object.entries(attributes).filter(([,v])=>v))
}
function nfeTechnicalConflicts(a,b){return Object.keys(a).filter(k=>b[k]&&a[k]!==b[k])}
function validNfeGtin(value){
 const gtin=String(value??'').trim()
 if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(gtin)||/^0+$/.test(gtin))return ''
 let sum=0,w=3
 for(let i=gtin.length-2;i>=0;i--){sum+=Number(gtin[i])*w;w=w===3?1:3}
 return Number(gtin.at(-1))===(10-sum%10)%10?gtin.padStart(14,'0'):''
}
function classifyNfeOperation(items){
 // Explicit allowlist: supplier outgoing sale; not a generic CFOP-prefix inference.
 const purchases=new Set(['5101','5102','5401','5403','5405','6101','6102','6401','6403','6404'])
 const returns=new Set(['5201','5202','5410','5411','6201','6202','6410','6411','1201','1202','2201','2202'])
 const remittance=new Set(['5901','5902','5904','5905','5908','5909','5910','5911','5912','5913','5915','5916','5917','5949','6901','6902','6904','6905','6908','6909','6910','6911','6912','6913','6915','6916','6917','6949'])
 const classes=(items||[]).map(item=>purchases.has(item.cfop)?'compra':returns.has(item.cfop)?'devolucao':remittance.has(item.cfop)?'remessa':'revisar')
 return classes.length&&classes.every(x=>x===classes[0])?classes[0]:'revisar'
}
function convertNfeQuantity(value,num,den){
 const n=positiveFiscalId(num,'Fator numerador'),d=positiveFiscalId(den,'Fator denominador')
 if(n>1e9||d>1e9)throw new Error('Fator inválido.')
 const scaled=fixedDecimal(value,6,'Quantidade fiscal')*BigInt(n)
 if(scaled%BigInt(d)!==0n)throw new Error('Conversão excede a precisão de estoque; revise a unidade.')
 const converted=scaled/BigInt(d)
 safeInt(converted,'Quantidade convertida')
 return quantityText(converted)
}
function nfeSimilarity(a,b){
 const aa=new Set(a.split(' ').filter(Boolean)),bb=new Set(b.split(' ').filter(Boolean))
 if(!aa.size||!bb.size)return 0
 const common=[...aa].filter(x=>bb.has(x)).length
 return Math.round(200*common/(aa.size+bb.size))
}
function recognizeNfeMaterials(db,payload){
 const work=payload.obra_id?fiscalRow(db,'obras',payload.obra_id,'Obra'):null
 const company=positiveFiscalId(payload.empresa_id??work?.empresa_id,'Empresa')
 if(work&&Number(work.empresa_id)!==company)throw new Error('Obra de outra empresa.')
 let supplierId=payload.fornecedor_id
 if(!supplierId){
  const document=digits(payload.documento)
  if(!/^\d{11}$|^\d{14}$/.test(document))throw new Error('Documento fiscal inválido.')
  const matches=db.prepare("SELECT id,documento FROM fornecedores WHERE (empresa_id=? OR empresa_id IS NULL) AND deleted_at IS NULL").all(company).filter(f=>digits(f.documento)===document)
  if(matches.length!==1)throw new Error(matches.length?'Há fornecedores duplicados para o documento fiscal. Selecione o cadastro correto.':'Cadastre o fornecedor com o CPF/CNPJ da nota antes de reconhecer materiais.')
  supplierId=matches[0].id
 }
 const supplier=fiscalRow(db,'fornecedores',supplierId,'Fornecedor')
 fiscalRow(db,'empresas',company,'Empresa')
 if(supplier.empresa_id!=null&&Number(supplier.empresa_id)!==company)throw new Error('Fornecedor de outra empresa.')
 if(payload.documento&&digits(supplier.documento)!==digits(payload.documento))throw new Error('Emitente não corresponde ao fornecedor.')
 if(!Array.isArray(payload.itens)||!payload.itens.length||payload.itens.length>990)throw new Error('Quantidade de itens fiscais inválida.')
 // One company-scoped read per catalog/alias set; never a query per invoice line.
 const catalog=db.prepare("SELECT c.* FROM materiais_estoque c WHERE c.empresa_id=? AND NOT EXISTS(SELECT 1 FROM material_reclassificacoes r WHERE r.origem_id=c.id) ORDER BY c.id LIMIT 20001").all(company)
 if(catalog.length>20000)throw new Error('Catálogo excede o limite de reconhecimento em lote; revise antes de importar.')
 const entries=catalog.map(m=>({...m,normalized:normalizeNfeDescription(m.descricao),technical:nfeTechnicalAttributes(m.descricao,JSON.parse(m.atributos_json||'{}'))}))
 const byId=new Map(entries.map(m=>[Number(m.id),m]))
 // Inverted token index: compute candidate overlap without re-tokenizing the catalog per item.
 const postings=new Map()
 for(const m of entries){
  const tokens=new Set(m.normalized.split(' ').filter(Boolean));m.tokenCount=tokens.size
  for(const token of tokens){if(!postings.has(token))postings.set(token,[]);postings.get(token).push(Number(m.id))}
 }
 const aliases=db.prepare("SELECT e.* FROM material_fornecedor_equivalencias e JOIN fornecedores f ON f.id=e.fornecedor_id WHERE e.empresa_id=? AND f.deleted_at IS NULL ORDER BY e.id LIMIT 100001").all(company)
 if(aliases.length>100000)throw new Error('Equivalências excedem o limite de reconhecimento em lote.')
 const aliasKeys=new Map(),gtins=new Map()
 const aliasKey=(id,code,unit)=>JSON.stringify([Number(id),String(code).trim(),String(unit).trim().toLowerCase()])
 for(const a of aliases){
  aliasKeys.set(aliasKey(a.fornecedor_id,a.codigo,a.unidade_comercial),a)
  const gtin=validNfeGtin(a.gtin)
  if(gtin){if(!gtins.has(gtin))gtins.set(gtin,new Set());gtins.get(gtin).add(Number(a.material_id))}
 }
 const results=payload.itens.map(item=>{
  const numero=String(item.numero??''),codigo=String(item.codigo??'').trim(),descricao=String(item.descricao??'').trim(),unidade=String(item.unidade??'').trim()
  if(!numero||!codigo||codigo.length>120||!descricao||descricao.length>500||!unidade||unidade.length>24)throw new Error('Item fiscal inválido.')
  const normalized=normalizeNfeDescription(descricao),technical=nfeTechnicalAttributes(descricao),gtin=validNfeGtin(item.gtin),gtinIds=gtins.get(gtin)||new Set()
  const linked=aliasKeys.get(aliasKey(supplier.id,codigo,unidade))
  if(linked){
   const material=byId.get(Number(linked.material_id)),conflicts=material?nfeTechnicalConflicts(technical,material.technical):['material_indisponivel']
   const aliasTechnical=nfeTechnicalAttributes(linked.descricao_origem)
   conflicts.push(...nfeTechnicalConflicts(technical,aliasTechnical))
   if(nfeSimilarity(normalized,normalizeNfeDescription(linked.descricao_origem))<40)conflicts.push('descricao_alterada')
   if(gtin&&validNfeGtin(linked.gtin)&&gtin!==validNfeGtin(linked.gtin))conflicts.push('gtin')
   if(gtinIds.size&&(gtinIds.size!==1||!gtinIds.has(Number(linked.material_id))))conflicts.push('gtin_ambiguo')
   if(!conflicts.length)return {numero,status:'confirmado',material_id:Number(material.id),descricao:material.descricao,unidade:material.unidade,fator_num:linked.fator_num,fator_den:linked.fator_den,conflitos:[],candidatos:[]}
   return {numero,status:'conflito',material_id:null,conflitos:[...new Set(conflicts)],candidatos:[]}
  }
  const candidates=[],overlap=new Map(),tokens=new Set(normalized.split(' ').filter(Boolean))
  for(const token of tokens)for(const id of postings.get(token)||[])overlap.set(id,(overlap.get(id)||0)+1)
  for(const id of gtinIds)if(!overlap.has(id))overlap.set(id,0)
  for(const [id,count] of overlap){
   const m=byId.get(id);if(!m)continue
   const score=Math.round(200*count/(tokens.size+m.tokenCount||1)),barcode=gtinIds.has(id),reference=m.technical.referencia&&(' '+normalized+' ').includes(' '+m.technical.referencia+' ')
   if(score<30&&!barcode&&!reference)continue
   const conflicts=nfeTechnicalConflicts(technical,m.technical)
   const sameUnit=unidade.toLowerCase()===String(m.unidade).trim().toLowerCase()
   candidates.push({material_id:Number(m.id),descricao:m.descricao,unidade:m.unidade,pontuacao:barcode?100:reference?Math.max(95,score):score,conflitos:conflicts,conversao_necessaria:!sameUnit,origem:barcode?'gtin':reference?'referencia':'texto'})
  }
  candidates.sort((a,b)=>Number(!!a.conflitos.length)-Number(!!b.conflitos.length)||b.pontuacao-a.pontuacao||a.material_id-b.material_id)
  return {numero,status:candidates.length?'revisar':'sem_correspondencia',material_id:null,conflitos:[],candidatos:candidates.slice(0,8)}
 })
 if(new Set(results.map(x=>x.numero)).size!==results.length)throw new Error('Itens fiscais repetidos.')
 return {empresa_id:company,fornecedor_id:Number(supplier.id),operacao:classifyNfeOperation(payload.itens),itens:results}
}

module.exports={nfeDetails,inspectNfeSource,recognizeNfeMaterials,normalizeNfeDescription,nfeTechnicalAttributes,nfeTechnicalConflicts,validNfeGtin,classifyNfeOperation,convertNfeQuantity,materialReclassificationPreview,confirmMaterialReclassification,stockRevision,materialCatalog,materialAliases,saveMaterialCatalog,confirmMaterialAlias,createReceivedNotesService,stockPage,stockWorkBalances,resolveStockMaterial,stockBalance,validateStockMovement,createNfeIntegrationService,fixedDecimal}
