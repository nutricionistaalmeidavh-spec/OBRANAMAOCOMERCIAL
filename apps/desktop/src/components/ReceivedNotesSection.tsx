import { FilePlus, Plus, Trash2 } from 'lucide-react'
import ReceivedCostsReport from './ReceivedCostsReport'
import { FormEvent, useMemo, useState } from 'react'
import { Button, Card, Empty, Field, FormActions, Loading, Modal } from './ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl, toCents, today } from '../utils/format'

type NoteItem = { descricao:string; quantidade:string; unidade:string; valor_unitario:string; frente_id:string; subfrente_id:string; pedido_item_id:string }
type NoteForm = { id?:number; revision?:number; documento_id?:number|null; fornecedor_id:string; numero:string; serie:string; emissao:string; data_recebimento:string; pedido_compra_id:string; conta_id:string; observacoes:string; itens:NoteItem[] }
const emptyItem=():NoteItem=>({descricao:'',quantidade:'1',unidade:'un',valor_unitario:'',frente_id:'',subfrente_id:'',pedido_item_id:''})
const blank=():NoteForm=>({fornecedor_id:'',numero:'',serie:'',emissao:today(),data_recebimento:today(),pedido_compra_id:'',conta_id:'',observacoes:'',itens:[emptyItem()]})

export default function ReceivedNotesSection({obraId}:{obraId:number|null}) {
  const [form,setForm]=useState<NoteForm|null>(null)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [pendingAttachment,setPendingAttachment]=useState<number|null>(null)
  const [reportRevision,setReportRevision]=useState(0)
  const [attachment,setAttachment]=useState<File|null>(null)
  const [supplierForm,setSupplierForm]=useState<{nome:string;documento:string;telefone:string;email:string}|null>(null)
  const [supplierSaving,setSupplierSaving]=useState(false)
  const [historyItems,setHistoryItems]=useState<any[]|null>(null)
  const [historyError,setHistoryError]=useState('')
  const works=useAsync(()=>obraId?window.fluxoDre.obras.list():Promise.resolve([]),[obraId])
  const work=works.data?.find((item:any)=>Number(item.id)===obraId)
  const suppliers=useAsync(()=>window.fluxoDre.fornecedores.list(),[])
  const stages=useAsync(()=>obraId?window.fluxoDre.frentes.list({obra_id:obraId}):Promise.resolve([]),[obraId])
  const substages=useAsync(()=>obraId?window.fluxoDre.subfrentes.list({obra_id:obraId}):Promise.resolve([]),[obraId])
  const orders=useAsync(()=>obraId?window.fluxoDre.compras.pedidos.list({obra_id:obraId}):Promise.resolve([]),[obraId])
  const accounts=useAsync(()=>obraId?window.fluxoDre.contas.list({obra_id:obraId,tipo:'pagar'}):Promise.resolve([]),[obraId])
  const selectedOrderItems=useAsync(()=>form?.pedido_compra_id?window.fluxoDre.compras.itens.list({pedido_compra_id:Number(form.pedido_compra_id)}):Promise.resolve([]),[form?.pedido_compra_id])
  const notes=useAsync(()=>obraId?window.fluxoDre.compras.notas.list(obraId):Promise.resolve([]),[obraId])
  const summary=useAsync(()=>obraId?window.fluxoDre.compras.notas.summary(obraId):Promise.resolve({etapas:[],total_centavos:0}),[obraId])

  const amount=useMemo(()=>(form?.itens||[]).reduce((sum,item)=>sum+Math.round(Number(item.quantidade||0)*toCents(item.valor_unitario||'0')),0),[form])
  function itemChange(index:number,patch:Partial<NoteItem>){
    setForm(current=>{
      if(!current) return null
      const itens=current.itens.map((item,i)=>i===index?{...item,...patch}:item)
      return {...current,itens}
    })
  }
  function open(){
    setError('')
    setAttachment(null)
    setForm(blank())
  }
  async function editNote(id:number) {
    setError('')
    try {
      const note=await window.fluxoDre.compras.notas.get(id)
      setAttachment(null)
      setForm({
        id:note.id,revision:note.revision,documento_id:note.documento_id,
        fornecedor_id:String(note.fornecedor_id),numero:note.numero,
        serie:note.serie||'',emissao:note.emissao,data_recebimento:note.data_recebimento||'',
        pedido_compra_id:note.pedido_compra_id?String(note.pedido_compra_id):'',
        conta_id:note.conta_id?String(note.conta_id):'',observacoes:note.observacoes||'',
        itens:note.itens.map((item:any)=>({
          descricao:item.descricao,quantidade:String(item.quantidade),unidade:item.unidade||'un',
          valor_unitario:(Number(item.valor_unitario_centavos)/100).toFixed(2).replace('.',','),
          frente_id:item.frente_id?String(item.frente_id):'',subfrente_id:item.subfrente_id?String(item.subfrente_id):'',
          pedido_item_id:item.pedido_item_id?String(item.pedido_item_id):''
        }))
      })
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível abrir a nota.')}
  }
  async function showHistory(id:number) {
    setHistoryError('')
    try { setHistoryItems(await window.fluxoDre.compras.notas.history(id)) }
    catch(e){setHistoryError(e instanceof Error?e.message:'Falha ao carregar histórico.')}
  }
  async function saveSupplier(event:FormEvent) {
    event.preventDefault()
    if(!supplierForm||!work||supplierSaving)return
    setSupplierSaving(true)
    setError('')
    try{
      const created=await window.fluxoDre.fornecedores.save({
        empresa_id:Number(work.empresa_id),nome:supplierForm.nome.trim(),
        documento:supplierForm.documento.trim(),telefone:supplierForm.telefone.trim(),email:supplierForm.email.trim()
      })
      await suppliers.reload()
      setForm(current=>current?{...current,fornecedor_id:String(created.id),pedido_compra_id:'',conta_id:''}:null)
      setSupplierForm(null)
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível cadastrar fornecedor.')}
    finally{setSupplierSaving(false)}
  }
  function fileToBase64(file:File):Promise<string>{
    return new Promise((resolve,reject)=>{
      const reader=new FileReader()
      reader.onload=()=>{const result=String(reader.result||'');resolve(result.split(',')[1]||'')}
      reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo selecionado.'))
      reader.readAsDataURL(file)
    })
  }
  async function uploadAttachment(note:any,file:File){
    if(!obraId)throw new Error('Selecione uma obra para anexar documento.')
    if(file.size>12*1024*1024)throw new Error('O anexo deve ter no máximo 12 MB.')
    const document=await window.fluxoDre.documentos.importReceivedNote({
      obra_id:obraId,frente_id:note.itens.find((item:any)=>item.frente_id)?.frente_id||null,
      title:'Nota recebida '+note.numero,
      file:{name:file.name,contentBase64:await fileToBase64(file)}
    })
    await window.fluxoDre.compras.notas.attach(note.id,document.id)
  }
  async function submit(event:FormEvent){
    event.preventDefault()
    if(!form||!obraId||!work||saving)return
    setSaving(true)
    setError('')
    try{
      const payload={
        empresa_id:Number(work.empresa_id),obra_id:obraId,fornecedor_id:Number(form.fornecedor_id),
        numero:form.numero.trim(),serie:form.serie.trim(),emissao:form.emissao,data_recebimento:form.data_recebimento,
        pedido_compra_id:form.pedido_compra_id?Number(form.pedido_compra_id):null,
        conta_id:form.conta_id?Number(form.conta_id):null,
        observacoes:form.observacoes,valor_total_centavos:Math.round(amount),
        itens:form.itens.map(item=>({
          descricao:item.descricao.trim(),quantidade:Number(item.quantidade),unidade:item.unidade.trim(),
          valor_unitario_centavos:toCents(item.valor_unitario||'0'),
          frente_id:item.frente_id?Number(item.frente_id):null,
          subfrente_id:item.subfrente_id?Number(item.subfrente_id):null,
          pedido_item_id:item.pedido_item_id?Number(item.pedido_item_id):null
        }))
      }
      const saved=form.id
        ?await window.fluxoDre.compras.notas.update(form.id,{...payload,revision:form.revision})
        :await window.fluxoDre.compras.notas.create(payload)
      setForm(null)
      notes.reload()
      summary.reload()
      setReportRevision(value=>value+1)
      setNotice('Nota '+saved.numero+(form.id?' atualizada':' cadastrada')+' com '+saved.itens.length+' item(ns). Sem gerar contas ou estoque.')
      if(attachment&&!saved.documento_id){
        try{
          await uploadAttachment(saved,attachment)
          setAttachment(null)
          setPendingAttachment(null)
          setNotice('Nota '+saved.numero+' salva com documento anexado.')
          notes.reload()
        }catch(err){
          setPendingAttachment(saved.id)
          setNotice('Nota '+saved.numero+' salva. O anexo não foi concluído; use “Tentar anexo novamente”.')
          setError(err instanceof Error?err.message:'Falha ao anexar documento.')
        }
      }else{
        setAttachment(null)
        setPendingAttachment(null)
      }
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar a nota.')}
    finally{setSaving(false)}
  }
  async function retryAttachment(){
    if(!attachment||!pendingAttachment)return
    try{
      const note=await window.fluxoDre.compras.notas.get(pendingAttachment)
      await uploadAttachment(note,attachment)
      setPendingAttachment(null)
      setAttachment(null)
      setError('')
      setNotice('Documento anexado à nota recebida.')
      notes.reload()
    }catch(e){setError(e instanceof Error?e.message:'Falha ao anexar novamente.')}
  }
  async function attach(id:number){
    if(!obraId||!work)return
    setError('')
    try{
      const note=await window.fluxoDre.compras.notas.get(id)
      const document=await window.fluxoDre.documentos.importForWork({
        obra_id:obraId,categoria:'nota_fiscal',title:'Nota recebida '+note.numero,
        frente_id:note.itens.find((item:any)=>item.frente_id)?.frente_id||null
      })
      if(!document)return
      await window.fluxoDre.compras.notas.attach(id,document.id)
      setPendingAttachment(null)
      setNotice('Documento anexado à nota recebida. Os dados continuam vinculados ao mesmo registro.')
      notes.reload()
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível anexar o arquivo.')}
  }
  async function openAttachment(documentId:number) {
    setError('')
    try {
      const document=await window.fluxoDre.documentos.get(documentId)
      if (!document?.arquivo_id) throw new Error('O documento não possui arquivo anexado.')
      const file=await window.fluxoDre.arquivos.get(Number(document.arquivo_id))
      if (!file?.caminho) throw new Error('O arquivo deste documento não foi encontrado.')
      await window.fluxoDre.documentos.open(file.caminho)
    } catch(e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o documento.') }
  }
  return <><Card style={{marginTop:14}}>
    <div className="card-header">
      <div><h2>Notas recebidas</h2><span>Organize documentos e itens por etapa e subetapa — sem emitir notas</span></div>
      <Button icon={<Plus size={15}/>} disabled={!obraId} onClick={open}>Cadastrar nota recebida</Button>
    </div>
    {notice&&<div className="success-box" role="status">{notice}{pendingAttachment&&<div style={{marginTop:8}}><Button variant="secondary" icon={<FilePlus size={15}/>} onClick={attachment?retryAttachment:()=>attach(pendingAttachment)}>{attachment?'Tentar anexo novamente':'Anexar PDF ou imagem'}</Button></div>}</div>}
    {error&&<p role="alert" style={{color:'#b42318',padding:12}}>{error}</p>}
    {notes.loading?<Loading/>:notes.data?.length?<div className="table-wrap"><table className="data-table">
      <thead><tr><th>Nota</th><th>Fornecedor</th><th>Emissão</th><th>Itens</th><th>Valor</th><th>Documento</th><th>Ações</th></tr></thead>
      <tbody>{notes.data.map((item:any)=><tr key={item.id}>
        <td><strong>{item.numero}</strong><small>Série {item.serie||'—'}</small></td>
        <td>{item.fornecedor_nome}</td><td>{brDate(item.emissao)}</td>
        <td>{item.quantidade_itens}</td><td>{brl(item.valor_total_centavos)}</td>
        <td>{item.documento_id?<Button variant="secondary" onClick={()=>openAttachment(item.documento_id)}>Abrir documento</Button>:<Button variant="secondary" onClick={()=>attach(item.id)}>Anexar</Button>}</td><td><div className="row-actions"><Button variant="secondary" onClick={()=>editNote(item.id)}>Editar</Button><Button variant="secondary" onClick={()=>showHistory(item.id)}>Histórico</Button></div></td>
      </tr>)}</tbody>
    </table></div>:<Empty title={obraId?'Nenhuma nota recebida':'Selecione uma obra'} description="Cadastre notas de fornecedores com seus produtos, quantidades e valores. Um documento pode ser anexado depois." action={obraId?<Button onClick={open}>Cadastrar primeira nota</Button>:undefined}/>}
    {!!summary.data?.etapas?.length&&<div className="card-body">
      <h3>Valores documentados por etapa e subetapa</h3>
      <p style={{fontSize:12,color:'#647084'}}>Valores documentados nas notas recebidas, não despesas pagas nem materiais consumidos.</p>
      <div className="stage-list">{summary.data.etapas.map((item:any)=><div key={String(item.frente_id??'geral')}><div><strong>Etapa: {item.nome}</strong></div><strong>{brl(item.valor_centavos)}</strong></div>)}</div>
      <div className="stage-list">{summary.data.subetapas?.map((item:any)=><div key={String(item.frente_id??'geral')+':'+String(item.subfrente_id??'geral')}><div><strong>{item.etapa_nome} / {item.subetapa_nome}</strong><span>{item.quantidade_itens} item(ns) de notas recebidas</span></div><span>{brl(item.valor_centavos)}</span></div>)}</div>
    </div>}
    <Modal open={!!form} title={form?.id?"Editar nota recebida":"Cadastrar nota recebida"} onClose={()=>!saving&&setForm(null)} size="lg">
      <form onSubmit={submit}>
        <div className="modal-body form-grid">
          <Field label="Fornecedor" required wide><div style={{display:'flex',gap:8,alignItems:'center'}}><select required value={form?.fornecedor_id||''} onChange={e=>setForm({...form!,fornecedor_id:e.target.value,pedido_compra_id:'',conta_id:''})}><option value="">Selecione o fornecedor</option>{suppliers.data?.filter((supplier:any)=>!supplier.empresa_id||Number(supplier.empresa_id)===Number(work?.empresa_id)).map((supplier:any)=><option value={supplier.id} key={supplier.id}>{supplier.nome}</option>)}</select><Button type="button" variant="secondary" onClick={()=>setSupplierForm({nome:'',documento:'',telefone:'',email:''})}>Novo fornecedor</Button></div></Field>
          <Field label="Número da nota" required><input required value={form?.numero||''} onChange={e=>setForm({...form!,numero:e.target.value})}/></Field>
          <Field label="Série"><input value={form?.serie||''} onChange={e=>setForm({...form!,serie:e.target.value})}/></Field>
          <Field label="Emissão" required><input required type="date" value={form?.emissao||''} onChange={e=>setForm({...form!,emissao:e.target.value})}/></Field>
          <Field label="Recebimento"><input type="date" value={form?.data_recebimento||''} onChange={e=>setForm({...form!,data_recebimento:e.target.value})}/></Field>
          <Field label="Vincular pedido existente"><select value={form?.pedido_compra_id||''} onChange={e=>setForm({...form!,pedido_compra_id:e.target.value,itens:form!.itens.map(item=>({...item,pedido_item_id:''}))})}><option value="">Nenhum — não criar pedido</option>{orders.data?.filter((item:any)=>!item.fornecedor_id||String(item.fornecedor_id)===form?.fornecedor_id).map((item:any)=><option key={item.id} value={item.id}>{item.numero||'#'+item.id} — {item.descricao}</option>)}</select></Field>
          <Field label="Vincular conta existente"><select value={form?.conta_id||''} onChange={e=>setForm({...form!,conta_id:e.target.value})}><option value="">Nenhuma — não gerar conta</option>{accounts.data?.filter((item:any)=>!item.fornecedor_id||String(item.fornecedor_id)===form?.fornecedor_id).map((item:any)=><option key={item.id} value={item.id}>{item.descricao} — {brl(item.valor_centavos)}</option>)}</select></Field>
          <div className="field-wide">
            <h3>Itens e classificação</h3>
            <p style={{fontSize:12,color:'#647084'}}>Cada item pode ter sua etapa e subetapa. Sem obrigar vínculo ao cronograma.</p>
            {form?.itens.map((item,index)=><div key={index} style={{border:'1px solid #d7dce5',borderRadius:9,padding:12,marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}><strong>Item {index+1}</strong><button className="icon-button" type="button" title="Remover item" aria-label={'Remover item '+(index+1)} disabled={form.itens.length===1} onClick={()=>setForm(current=>current?{...current,itens:current.itens.filter((_,i)=>i!==index)}:null)}><Trash2 size={15}/></button></div>
              <div className="form-grid">
                {!!form?.pedido_compra_id && <Field label="Item do pedido já cadastrado" wide><select value={item.pedido_item_id} onChange={e=>{
                  const selected=selectedOrderItems.data?.find((value:any)=>String(value.id)===e.target.value)
                  if (!selected) return itemChange(index,{pedido_item_id:''})
                  const qty=Number(selected.quantidade_pedida||1)
                  itemChange(index,{
                    pedido_item_id:e.target.value,descricao:selected.descricao||item.descricao,
                    unidade:selected.unidade||item.unidade,quantidade:String(qty),
                    valor_unitario:(Number(selected.valor_centavos||0)/Math.max(qty,0.001)/100).toFixed(2).replace('.',',')
                  })
                }}><option value="">Sem vínculo com item do pedido</option>{selectedOrderItems.data?.map((orderItem:any)=><option value={orderItem.id} key={orderItem.id}>{orderItem.descricao} — {orderItem.quantidade_pedida} {orderItem.unidade}</option>)}</select></Field>}
                <Field label="Descrição" required wide><input required value={item.descricao} onChange={e=>itemChange(index,{descricao:e.target.value})}/></Field>
                <Field label="Quantidade" required><input required type="number" min="0.001" step="0.001" value={item.quantidade} onChange={e=>itemChange(index,{quantidade:e.target.value})}/></Field>
                <Field label="Unidade"><input value={item.unidade} onChange={e=>itemChange(index,{unidade:e.target.value})}/></Field>
                <Field label="Preço unitário (R$)" required><input required value={item.valor_unitario} placeholder="0,00" onChange={e=>itemChange(index,{valor_unitario:e.target.value})}/></Field>
                <Field label="Etapa"><select value={item.frente_id} onChange={e=>itemChange(index,{frente_id:e.target.value,subfrente_id:''})}><option value="">Sem etapa</option>{stages.data?.map((stage:any)=><option key={stage.id} value={stage.id}>{stage.nome}</option>)}</select></Field>
                <Field label="Subetapa"><select disabled={!item.frente_id} value={item.subfrente_id} onChange={e=>itemChange(index,{subfrente_id:e.target.value})}><option value="">Sem subetapa</option>{substages.data?.filter((sub:any)=>String(sub.frente_id)===item.frente_id).map((sub:any)=><option key={sub.id} value={sub.id}>{sub.nome}</option>)}</select></Field>
              </div>
            </div>)}
            <Button type="button" variant="secondary" icon={<Plus size={15}/>} onClick={()=>setForm(current=>current?{...current,itens:[...current.itens,emptyItem()]}:null)}>Adicionar item</Button>
          </div>
          <Field label="Anexar PDF ou imagem" wide><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" disabled={!!form?.documento_id} onChange={e=>{
            const selected=e.target.files?.[0]||null
            if(selected&&selected.size>12*1024*1024){setError('O anexo deve ter no máximo 12 MB.');e.target.value='';setAttachment(null);return}
            setAttachment(selected)
          }}/><small>{form?.documento_id?'Esta nota já possui um documento; o anexo existente será preservado.':attachment?'Selecionado: '+attachment.name:'O arquivo será enviado depois de salvar a nota. Limite de 12 MB.'}</small></Field>
          <Field label="Observações" wide><textarea value={form?.observacoes||''} onChange={e=>setForm({...form!,observacoes:e.target.value})}/></Field>
          <div className="field-wide"><strong>Total da nota: {brl(Math.round(amount))}</strong><p style={{fontSize:12,color:'#647084'}}>Salvar a nota não gera contas ou entrada de estoque. Se essa compra já foi importada no financeiro, vincule a conta existente para evitar custos duplicados.</p></div>
          {error&&<p role="alert" className="field-wide" style={{color:'#b42318'}}>{error}</p>}
        </div>
        <FormActions onCancel={()=>setForm(null)} submitLabel={form?.id?"Salvar alterações":"Salvar nota recebida"} loading={saving}/>
      </form>
    </Modal>
  </Card>
  <ReceivedCostsReport obraId={obraId} revision={reportRevision}/>
  <Modal open={!!supplierForm} title="Cadastrar fornecedor" onClose={()=>!supplierSaving&&setSupplierForm(null)}>
    <form onSubmit={saveSupplier}><div className="modal-body form-grid">
      <Field label="Nome do fornecedor" required wide><input required value={supplierForm?.nome||''} onChange={e=>setSupplierForm({...supplierForm!,nome:e.target.value})}/></Field>
      <Field label="CPF/CNPJ"><input value={supplierForm?.documento||''} onChange={e=>setSupplierForm({...supplierForm!,documento:e.target.value})}/></Field>
      <Field label="Telefone"><input value={supplierForm?.telefone||''} onChange={e=>setSupplierForm({...supplierForm!,telefone:e.target.value})}/></Field>
      <Field label="E-mail"><input type="email" value={supplierForm?.email||''} onChange={e=>setSupplierForm({...supplierForm!,email:e.target.value})}/></Field>
      {error&&<p role="alert" className="field-wide" style={{color:'#b42318'}}>{error}</p>}
    </div><FormActions loading={supplierSaving} onCancel={()=>setSupplierForm(null)} submitLabel="Cadastrar fornecedor"/></form>
  </Modal>
  <Modal open={historyItems!==null} title="Histórico de alterações da nota" onClose={()=>setHistoryItems(null)}>
    <div className="modal-body">
      {historyItems?.length?historyItems.map((revision:any)=>{
        const previous=JSON.parse(revision.anterior_json)
        return <div key={revision.id} style={{padding:12,borderBottom:'1px solid #d7dce5'}}>
          <strong>Versão anterior {revision.revision_anterior}</strong>
          <p>Registrada em {revision.created_at} — Nota {previous.numero} — {brl(previous.valor_total_centavos)}</p>
          <small>{previous.itens?.length||0} item(ns) anteriores preservados</small>
          <div className="table-wrap" style={{marginTop:8}}><table className="data-table">
            <thead><tr><th>Descrição anterior</th><th>Quantidade</th><th>Preço unitário</th><th>Etapa / subetapa</th></tr></thead>
            <tbody>{previous.itens?.map((item:any)=><tr key={item.id||item.descricao}>
              <td>{item.descricao}</td><td>{item.quantidade} {item.unidade}</td>
              <td>{brl(item.valor_unitario_centavos)}</td>
              <td>{item.frente_id||'Sem etapa'} / {item.subfrente_id||'Sem subetapa'}</td>
            </tr>)}</tbody>
          </table></div>
        </div>
      }):<Empty title="Nenhuma alteração anterior" description="As revisões da nota serão exibidas aqui."/>}
    </div>
  </Modal>
  {historyError&&<p role="alert" style={{color:'#b42318'}}>{historyError}</p>}
  </>
}
