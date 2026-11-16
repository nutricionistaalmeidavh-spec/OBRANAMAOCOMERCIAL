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
  return { create,list,read,summary,attach }
}
module.exports={createReceivedNotesService}
