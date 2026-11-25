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
  const conditions=['o.deleted_at IS NULL'],args=[]
  for(const [field,sql] of [['empresa_id','o.empresa_id'],['obra_id','m.obra_id'],['frente_id','m.frente_id']]){
    if(filters[field]!==undefined&&filters[field]!==null&&filters[field]!==''){conditions.push(sql+'=?');args.push(positive(filters[field],field))}
  }
  const q=String(filters.q??'').trim().slice(0,200)
  if(q){conditions.push("(instr(lower(trim(m.descricao)),lower(?))>0 OR instr(lower(trim(m.unidade)),lower(?))>0 OR instr(lower(o.nome),lower(?))>0 OR instr(lower(COALESCE(f.nome,'')),lower(?))>0 OR instr(lower(COALESCE(e.nome_fantasia,e.razao_social)),lower(?))>0)");args.push(q,q,q,q,q)}
  const from=" FROM movimentacoes_estoque m JOIN obras o ON o.id=m.obra_id JOIN empresas e ON e.id=o.empresa_id LEFT JOIN frentes_obra f ON f.id=m.frente_id LEFT JOIN pedido_compra_itens pi ON pi.id=m.pedido_item_id WHERE "+conditions.join(' AND ')
  const history=filters.history===true||filters.history==='true'
  const grouped=" GROUP BY m.obra_id,COALESCE(m.frente_id,0),lower(trim(m.descricao)),lower(trim(m.unidade))"
  const covered="SUM(CASE WHEN m.tipo IN ('entrada','ajuste') AND pi.quantidade_pedida>0 THEN m.quantidade ELSE 0 END)"
  const cost="SUM(CASE WHEN m.tipo IN ('entrada','ajuste') AND pi.quantidade_pedida>0 THEN 1.0*pi.valor_centavos*m.quantidade/pi.quantidade_pedida ELSE 0 END)"
  const valuation=", CASE WHEN "+covered+">0 THEN CAST(ROUND("+cost+"/"+covered+") AS INTEGER) END custo_medio_centavos"
  const sql=history
    ? "SELECT m.id,m.obra_id,o.empresa_id,o.nome obra_nome,COALESCE(e.nome_fantasia,e.razao_social) empresa_nome,m.frente_id,COALESCE(f.nome,'Obra geral') etapa_nome,m.descricao,m.unidade,m.tipo,m.quantidade,m.data"+from
    : "SELECT MIN(m.id) id,m.obra_id,o.empresa_id,o.nome obra_nome,COALESCE(e.nome_fantasia,e.razao_social) empresa_nome,m.frente_id,COALESCE(f.nome,'Obra geral') etapa_nome,MIN(trim(m.descricao)) descricao,MIN(trim(m.unidade)) unidade,SUM(CASE WHEN m.tipo IN ('entrada','ajuste') THEN m.quantidade ELSE 0 END) entradas,SUM(CASE WHEN m.tipo='saida' THEN m.quantidade ELSE 0 END) saidas,SUM(CASE WHEN m.tipo IN ('entrada','ajuste') THEN m.quantidade ELSE -m.quantidade END) saldo"+valuation+from+grouped
  const total=Number(db.prepare('SELECT COUNT(*) total FROM ('+sql+')').get(...args).total)
  if(exportMode&&total>limit)throw new Error('A exportação excede 10.000 registros. Refine os filtros para exportar todos os resultados.')
  const rows=db.prepare(sql+(history?' ORDER BY m.data DESC,m.id DESC':' ORDER BY obra_nome,descricao,unidade,etapa_nome,id')+' LIMIT ? OFFSET ?').all(...args,limit,offset)
  return {rows:history?rows:rows.map(r=>({...r,saldo_estimado_centavos:r.custo_medio_centavos===null?null:Math.round(r.custo_medio_centavos*r.saldo)})),total,limit,offset}
}
function stockBalance(db,payload,{allStages=false}={}){
  return Number(db.prepare("SELECT COALESCE(SUM(CASE WHEN tipo IN ('entrada','ajuste') THEN quantidade ELSE -quantidade END),0) total FROM movimentacoes_estoque WHERE obra_id=? AND (?=1 OR COALESCE(frente_id,0)=COALESCE(?,0)) AND lower(trim(descricao))=lower(trim(?)) AND lower(trim(unidade))=lower(trim(?))").get(payload.obra_id,allStages?1:0,payload.frente_id||null,payload.descricao,payload.unidade||'un').total)
}
function validateStockMovement(db,payload){
  const qty=Number(payload.quantidade),obra=Number(payload.obra_id)
  if(!Number.isFinite(qty)||qty<=0||!['entrada','saida','ajuste'].includes(payload.tipo)||!String(payload.descricao||'').trim())throw new Error('Movimentação de estoque inválida.')
  if(!db.prepare('SELECT id FROM obras WHERE id=? AND deleted_at IS NULL').get(obra))throw new Error('Obra inválida.')
  if(payload.frente_id&&!db.prepare('SELECT id FROM frentes_obra WHERE id=? AND obra_id=? AND deleted_at IS NULL').get(Number(payload.frente_id),obra))throw new Error('Etapa não pertence à obra.')
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
function createNfeIntegrationService(db,{parseXml,saveEntity}={}){
  if(typeof parseXml!=='function'||typeof saveEntity!=='function')throw new Error('Adaptador fiscal de confiança obrigatório.')
  const readXml=payload=>{
    const source=payload?.xml_base64
    if(typeof source!=='string'||source.length>12*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(source))throw new Error('Arquivo XML inválido.')
    const bytes=Buffer.from(source,'base64')
    if(!bytes.length||bytes.length>8*1024*1024||bytes.toString('base64')!==source)throw new Error('Arquivo XML inválido ou muito grande.')
    // Never trust a preview object supplied by the renderer.
    const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    const parsed=parseXml(xml)
    const operation={empresa_id:payload.empresa_id,fornecedor_id:payload.fornecedor_id,categoria_id:payload.categoria_id,data_recebimento:payload.data_recebimento,destinos:payload.destinos,parcelas:payload.parcelas}
    const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])):v
    return {bytes,parsed,hash:createHash('sha256').update(bytes).digest('hex'),operationHash:createHash('sha256').update(JSON.stringify(canonical(operation))).digest('hex')}
  }
  const prepare=(payload,raw)=>{
    const n=raw.parsed,company=fiscalRow(db,'empresas',payload.empresa_id,'Empresa'),supplier=fiscalRow(db,'fornecedores',payload.fornecedor_id,'Fornecedor')
    if(company.status==='inativa'||digits(company.cnpj)!==digits(n.destinatario)||!/^\d{14}$/.test(digits(n.destinatario)))throw new Error('Destinatário da NF-e não corresponde à empresa ativa.')
    if(supplier.empresa_id!==null&&Number(supplier.empresa_id)!==Number(company.id))throw new Error('Fornecedor de outra empresa.')
    if(!digits(supplier.documento)||digits(supplier.documento)!==digits(n.documento))throw new Error('Documento do fornecedor não corresponde ao emitente.')
    if(n.ambiente!=='1'||!['100','150'].includes(n.status)||!n.protocolo)throw new Error('Somente XML de produção com protocolo informado pode ser integrado.')
    // Key encodes issuer, model, series and invoice number. A valid check digit alone is insufficient.
    if(!fiscalKeyValid(n.chave)||n.chave.slice(6,20)!==digits(n.documento).padStart(14,'0')||n.chave.slice(20,22)!=='55'||n.chave.slice(22,25)!==String(n.serie).padStart(3,'0')||n.chave.slice(25,34)!==String(n.numero).padStart(9,'0'))throw new Error('Identidade fiscal divergente da chave.')
    fiscalDate(n.emissao)
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
      const actual=byItem.get(String(item.numero))||{qty:0n,cost:0n}
      actual.qty+=qty;actual.cost+=cost;byItem.set(String(item.numero),actual)
      const category=fiscalRow(db,'categorias_financeiras',row.categoria_id??payload.categoria_id,'Categoria')
      if(category.natureza!=='despesa'||!category.ativa)throw new Error('Categoria financeira inválida.')
      let orderItem=null,order=null
      if(row.pedido_item_id){
        orderItem=fiscalRow(db,'pedido_compra_itens',row.pedido_item_id,'Item do pedido')
        order=fiscalRow(db,'pedidos_compra',orderItem.pedido_compra_id,'Pedido')
        if(Number(order.obra_id)!==Number(work.id)||Number(order.fornecedor_id)!==Number(supplier.id)||Number(order.frente_id||0)!==Number(stage?.id||0))throw new Error('Pedido incompatível com destino ou fornecedor.')
        if(String(orderItem.descricao).trim().toLowerCase()!==String(item.descricao).trim().toLowerCase()||String(orderItem.unidade).trim().toLowerCase()!==String(item.unidade).trim().toLowerCase())throw new Error('Material do pedido diverge do item fiscal; concilie antes de confirmar.')
        if(usedOrderItems.has(orderItem.id))throw new Error('O mesmo item de pedido não pode ser apropriado duas vezes.')
        usedOrderItems.add(orderItem.id)
        if(Number(received)/1e6+Number(orderItem.quantidade_recebida)>Number(orderItem.quantidade_pedida)+1e-9&&!row.recebimento_existente_id)throw new Error('Recebimento excede o pedido.')
      }
      let existingReceipt=null
      if(row.recebimento_existente_id){
        existingReceipt=fiscalRow(db,'recebimentos_materiais',row.recebimento_existente_id,'Recebimento')
        if(!orderItem||Number(existingReceipt.pedido_item_id)!==Number(orderItem.id)||fixedDecimal(existingReceipt.quantidade_recebida,6,'Recebimento existente')!==received||received<=0n)throw new Error('Recebimento existente incompatível.')
        if(db.prepare('SELECT id FROM nota_recebida_recebimentos WHERE recebimento_id=?').get(existingReceipt.id))throw new Error('Recebimento já vinculado a uma NF-e.')
      }else if(orderItem&&Number(orderItem.quantidade_recebida)>0&&received>0n)throw new Error('Pedido já possui recebimentos: concilie os recebimentos anteriores antes de registrar novas entradas.')
      const key=JSON.stringify([work.id,stage?.id||null,category.id])
      scopeKeys.add(key)
      destinos.push({index,item,work,stage,sub,qty,received,cost,category,orderItem,order,existingReceipt})
    }
    for(const [number,item] of sourceItems){
      const allocated=byItem.get(number)
      if(!allocated||allocated.qty!==fixedDecimal(item.quantidade,6,'Quantidade fiscal'))throw new Error('Quantidade dos destinos diverge do item '+number+'.')
    }
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
      const existing=db.prepare('SELECT n.id,n.status_integracao,x.sha256,x.operacao_sha256 FROM notas_recebidas n JOIN nota_recebida_xml x ON x.nota_id=n.id WHERE n.empresa_id=? AND n.chave_acesso=?').get(companyId,raw.parsed.chave)
      if(existing){
        if(existing.sha256!==raw.hash||existing.operacao_sha256!==raw.operationHash||existing.status_integracao!=='integrada')throw new Error('Chave fiscal já utilizada ou estornada; revise o registro original.')
        db.exec('COMMIT')
        return {nota_id:Number(existing.id),replayed:true}
      }
      const p=prepare(payload,raw),n=p.n
      if(db.prepare('SELECT id FROM notas_recebidas WHERE empresa_id=? AND fornecedor_id=? AND numero=? AND serie=? AND deleted_at IS NULL').get(p.company.id,p.supplier.id,n.numero,n.serie))throw new Error('Nota documental já cadastrada. Conciliação manual necessária; nenhuma duplicata será criada.')
      const principal=p.destinos[0].work.id
      const orderIds=[...new Set(p.destinos.filter(d=>d.order).map(d=>Number(d.order.id)))]
      const result=db.prepare("INSERT INTO notas_recebidas(empresa_id,obra_id,fornecedor_id,numero,serie,emissao,valor_total_centavos,pedido_compra_id,chave_acesso,status_integracao,total_produtos_centavos) VALUES(?,?,?,?,?,?,?,?,?,'integrada',?)").run(p.company.id,principal,p.supplier.id,n.numero,n.serie,n.emissao,safeInt(p.total,'Total'),orderIds.length===1?orderIds[0]:null,n.chave,safeInt(p.products,'Produtos'))
      const id=Number(result.lastInsertRowid)
      db.prepare('INSERT INTO nota_recebida_xml(nota_id,sha256,operacao_sha256,xml_original,ambiente,protocolo) VALUES(?,?,?,?,?,?)').run(id,raw.hash,raw.operationHash,raw.bytes,n.ambiente,n.protocolo)
      const insert=db.prepare('INSERT INTO nota_recebida_itens(nota_id,obra_id,frente_id,subfrente_id,pedido_item_id,descricao,unidade,quantidade,valor_unitario_centavos,valor_total_centavos,nfe_item_numero,quantidade_decimal,valor_unitario_decimal) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
      const receipt=db.prepare('INSERT INTO nota_recebida_recebimentos(nota_id,nota_item_id,movimento_id,recebimento_id,quantidade_decimal,origem,request_id,data) VALUES(?,?,?,?,?,?,?,?)')
      const date=payload.data_recebimento?fiscalDate(payload.data_recebimento):null
      for(const dest of p.destinos){
        const qty=Number(dest.qty)/1e6
        const cost=safeInt(dest.cost,'Custo')
        const itemId=Number(insert.run(id,dest.work.id,dest.stage?.id??null,dest.sub?.id??null,dest.orderItem?.id??null,dest.item.descricao,dest.item.unidade,qty,Math.round(cost/qty),cost,String(dest.item.numero),quantityText(dest.qty),String(dest.item.valor_unitario)).lastInsertRowid)
        if(dest.received===0n)continue
        if(!date&&!dest.existingReceipt)throw new Error('Confirme a data do recebimento físico.')
        let movement=null,receivedId=null
        if(dest.existingReceipt){receivedId=dest.existingReceipt.id}
        else {
          const quantity=Number(dest.received)/1e6
          const stock={obra_id:dest.work.id,frente_id:dest.stage?.id??null,pedido_item_id:dest.orderItem?.id??null,tipo:'entrada',descricao:dest.item.descricao,unidade:dest.item.unidade,quantidade:quantity,data:date,observacoes:'NF-e '+n.chave,request_id:'nfe:'+id+':'+itemId}
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
        const account=part.linked||saveEntity('contas',{empresa_id:p.company.id,obra_id:p.sameScope?scope.work.id:null,frente_id:p.sameScope?scope.stage?.id??null:null,fornecedor_id:p.supplier.id,categoria_id:scope.category.id,tipo:'pagar',descricao:'NF-e '+n.numero+' — parcela '+part.number,competencia:n.emissao.slice(0,7),emissao:n.emissao,vencimento:part.due,valor_bruto_centavos:safeInt(part.amount,'Parcela'),valor_centavos:safeInt(part.amount,'Parcela'),status:'pendente',parcela_atual:part.number,total_parcelas:p.schedule.length,origem_tipo:'nota_recebida',origem_id:id})
        db.prepare('INSERT INTO nota_recebida_contas(nota_id,conta_id,parcela,criada_na_importacao) VALUES(?,?,?,?)').run(id,account.id,part.number,part.linked?0:1)
        accounts.push(Number(account.id))
      }
      const receiptDate=p.destinos.some(d=>d.received>0n)?(date||p.destinos.find(d=>d.existingReceipt)?.existingReceipt?.data||null):null
      db.prepare('UPDATE notas_recebidas SET conta_id=?,data_recebimento=? WHERE id=?').run(accounts.length===1?accounts[0]:null,receiptDate,id)
      db.exec('COMMIT')
      return {nota_id:id,contas:accounts,replayed:false}
    }catch(e){try{db.exec('ROLLBACK')}catch{}throw e}
  }
  return {commit}
}

module.exports={createReceivedNotesService,stockPage,stockBalance,validateStockMovement,createNfeIntegrationService,fixedDecimal}
