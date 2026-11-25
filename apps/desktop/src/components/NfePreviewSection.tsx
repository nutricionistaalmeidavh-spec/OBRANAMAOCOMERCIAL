import { useRef, useState } from 'react'
import { FilePlus } from 'lucide-react'
import { Button, Card } from './ui'
import OperationalSheetGrid, { type SheetColumn } from './OperationalSheetGrid'
import { MAX_NFE_BYTES, parseNfePreview, type NfePreview } from '../utils/nfe-preview'
import NfeCommitPanel from './NfeCommitPanel'
import { brDate } from '../utils/format'

type Recognition=Awaited<ReturnType<typeof window.fluxoDre.compras.nfeRecognize>>
type Candidate=Recognition['itens'][number]['candidatos'][number]
const operationLabels:Record<string,string>={compra:'Compra',devolucao:'Devolução',remessa:'Remessa',revisar:'Classificação fiscal pendente'}
const money=(v:string)=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const columns:SheetColumn[]=[
  {key:'numero',label:'Item'}, {key:'codigo',label:'Código'},
  {key:'descricao',label:'Material',width:230},{key:'cfop',label:'CFOP'},{key:'ncm',label:'NCM'},{key:'unidade',label:'Unidade'},
  {key:'quantidade',label:'Quantidade'},{key:'valor_unitario',label:'Preço unitário (R$)'},
  {key:'valor_produto',label:'Total (R$)'}
]
export default function NfePreviewSection({obraId,onImported}:{obraId:number|null;onImported?:()=>void}){
  const input=useRef<HTMLInputElement>(null)
  const [preview,setPreview]=useState<NfePreview|null>(null)
  const [fileName,setFileName]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [xmlBase64,setXmlBase64]=useState('')
  const [recognition,setRecognition]=useState<Recognition|null>(null)
  const [recognitionError,setRecognitionError]=useState('')
  const [review,setReview]=useState<{numero:string;candidate:Candidate;num:string;den:string;confirmed:boolean}|null>(null)
  const [page,setPage]=useState(0)
  const lock=useRef(false)
  const recognize=async(source:string)=>{
    if(!obraId)return
    setRecognition(null);setRecognitionError('');setReview(null);setPage(0)
    try{setRecognition(await window.fluxoDre.compras.nfeRecognize({obra_id:obraId,xml_base64:source}))}
    catch(e){setRecognitionError(e instanceof Error?e.message:'Não foi possível consultar o catálogo.')}
  }
  const confirm=async()=>{
    if(!review?.confirmed||!recognition||!preview||lock.current)return
    const item=preview.itens.find(i=>i.numero===review.numero)
    if(!item||review.candidate.conflitos.length)return
    const num=Number(review.num),den=Number(review.den)
    if(!Number.isSafeInteger(num)||!Number.isSafeInteger(den)||num<1||den<1||num>1e9||den>1e9){setRecognitionError('Informe um fator racional positivo e válido.');return}
    lock.current=true;setBusy(true);setRecognitionError('')
    try{
      await window.fluxoDre.compras.catalogConfirm({empresa_id:recognition.empresa_id,fornecedor_id:recognition.fornecedor_id,material_id:review.candidate.material_id,codigo:item.codigo,unidade_comercial:item.unidade,descricao_origem:item.descricao,gtin:/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(item.gtin)?item.gtin:'',fator_num:num,fator_den:den})
      await recognize(xmlBase64)
    }catch(e){setRecognitionError(e instanceof Error?e.message:'Não foi possível confirmar a equivalência.')}
    finally{lock.current=false;setBusy(false)}
  }
  const read=async(file:File|undefined)=>{
    if(!file||busy)return
    setBusy(true);setError('')
    try{
      if(!/\.xml$/i.test(file.name)||!file.size||file.size>MAX_NFE_BYTES)throw new Error('Selecione um XML de NF-e de até 8 MB.')
      const bytes=new Uint8Array(await file.arrayBuffer())
      const data=parseNfePreview(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
      let raw='';for(let start=0;start<bytes.length;start+=8192)raw+=String.fromCharCode(...bytes.subarray(start,start+8192))
      const source=btoa(raw)
      setXmlBase64(source);setPreview(data);setFileName(file.name);await recognize(source)
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível ler o XML.')}
    finally{setBusy(false);if(input.current)input.current.value=''}
  }
  return <Card style={{marginTop:14}}>
    <div className="card-header"><div><h2>Conferir XML de NF-e</h2><p>Leitura local para revisão dos dados fiscais. Nenhum lançamento será criado nesta etapa.</p></div><Button type="button" variant="secondary" icon={<FilePlus size={16}/>} disabled={!obraId||busy} onClick={()=>input.current?.click()}>{busy?'Lendo XML...':'Selecionar XML'}</Button></div>
    <input ref={input} type="file" accept=".xml,application/xml,text/xml" hidden onChange={e=>void read(e.target.files?.[0])}/>
    <div className="card-body">
      <p>{!obraId?'Escolha a obra antes de conferir o XML.':'Arquivo XML de NF-e modelo 55, até 8 MB. A leitura não consulta a SEFAZ.'}</p>
      {error&&<div className="notice" role="alert">{error}{preview?' A prévia anterior foi preservada.':''}</div>}
      {preview&&<><div className="row-actions"><strong>{fileName}</strong><Button variant="secondary" disabled={busy} onClick={()=>{setPreview(null);setXmlBase64('');setFileName('');setError('');setRecognition(null);setRecognitionError('');setReview(null)}}>Limpar prévia</Button></div>
        <dl><dt>Fornecedor</dt><dd>{preview.fornecedor} — {preview.documento}</dd><dt>Nota e série</dt><dd>{preview.numero} / {preview.serie}</dd><dt>Chave de acesso</dt><dd style={{overflowWrap:'anywhere'}}>{preview.chave}</dd><dt>Emissão</dt><dd>{brDate(preview.emissao)}</dd><dt>Total fiscal</dt><dd>{money(preview.total)}</dd><dt>Protocolo</dt><dd>{preview.protocolo||'Não consta no XML'} {preview.status?'(status informado no arquivo '+preview.status+')':''}</dd></dl>
        <OperationalSheetGrid area="compras" title="Itens do XML — somente conferência" rows={preview.itens.map(i=>({...i,id:i.numero}))} columns={columns} showImport={false} filename={'nfe-'+preview.numero}/>
        <h3>Reconhecimento de materiais</h3>
        <p>Consulta determinística do catálogo da empresa. Sugestões não criam lançamentos e exigem confirmação.</p>
        {recognitionError&&<p role="alert">{recognitionError}</p>}
        <Button variant="secondary" disabled={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{await recognize(xmlBase64)}finally{lock.current=false;setBusy(false)}}}>Atualizar reconhecimento</Button>
        {recognition&&<>
          {recognition.registro_existente&&<p role="status">Nota já registrada (#{recognition.registro_existente.id}). A importação deve preservar o registro anterior.</p>}
          {!recognition.elegivel_compra&&<p role="status">Esta nota não está elegível para integração automática como compra. Revise ambiente, finalidade, protocolo, classificação e eventual duplicidade.</p>}
          {recognition.pedidos_referenciados.map(ref=><p key={ref.referencia}>Referência de pedido {ref.referencia}: {ref.pedidos.length?ref.pedidos.map(p=>p.numero+' — '+p.obra_nome+' ('+p.status+')').join('; '):'nenhum pedido correspondente encontrado'}. Confira antes de conciliar.</p>)}
          <p><strong>Classificação: {operationLabels[recognition.operacao]||'Revisar'}</strong> · {recognition.itens.filter(i=>i.status==='confirmado').length}/{recognition.itens.length} vínculos confirmados</p>
          {recognition.itens.slice(page*20,page*20+20).map(row=>{
            const item=preview.itens.find(i=>i.numero===row.numero)
            return <section key={row.numero} style={{padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
              <strong>Item {row.numero} — {item?.descricao}</strong>
              <p>{row.status==='confirmado'?'Equivalência confirmada: '+row.descricao+' · '+row.fator_num+'/'+row.fator_den+' '+row.unidade:row.status==='conflito'?'Vínculo existente em conflito: '+row.conflitos.join(', '):row.status==='sem_correspondencia'?'Nenhuma correspondência. Cadastre o material no catálogo e atualize.':'Revise as sugestões abaixo.'}</p>
              {row.candidatos.map(candidate=><div key={candidate.material_id} className="row-actions">
                <span>{candidate.descricao} — {candidate.unidade} · {candidate.pontuacao}/100 {candidate.conflitos.length?' · Divergência: '+candidate.conflitos.join(', '):''}{candidate.conversao_necessaria?' · Conversão necessária':''}</span>
                <Button variant="secondary" disabled={busy||!!candidate.conflitos.length} onClick={()=>{setRecognitionError('');setReview({numero:row.numero,candidate,num:candidate.conversao_necessaria?'':'1',den:candidate.conversao_necessaria?'':'1',confirmed:false})}}>Revisar vínculo</Button>
              </div>)}
              {review?.numero===row.numero&&<div className="card-body">
                <p><strong>{review.candidate.descricao}</strong> — 1 unidade fiscal ({item?.unidade}) corresponde à fração abaixo em {review.candidate.unidade}.</p>
                <div className="row-actions"><label>Numerador <input type="number" min="1" max="1000000000" value={review.num} onChange={e=>setReview({...review,num:e.target.value,confirmed:false})}/></label><label>Denominador <input type="number" min="1" max="1000000000" value={review.den} onChange={e=>setReview({...review,den:e.target.value,confirmed:false})}/></label></div>
                <label><input type="checkbox" checked={review.confirmed} onChange={e=>setReview({...review,confirmed:e.target.checked})}/> Conferi material, especificações e unidade. Salvar equivalência para próximas notas deste fornecedor.</label>
                <div className="row-actions"><Button disabled={busy||!review.confirmed} onClick={()=>void confirm()}>Confirmar equivalência</Button><Button variant="secondary" disabled={busy} onClick={()=>setReview(null)}>Cancelar</Button></div>
              </div>}
            </section>
          })}
          <div className="row-actions"><Button variant="secondary" disabled={!page||busy} onClick={()=>{setReview(null);setPage(p=>p-1)}}>Anterior</Button><span>{page+1} de {Math.ceil(recognition.itens.length/20)}</span><Button variant="secondary" disabled={(page+1)*20>=recognition.itens.length||busy} onClick={()=>{setReview(null);setPage(p=>p+1)}}>Próxima</Button></div>
        </>}
        <h3>Parcelas informadas no XML</h3>
        {preview.parcelas.length?<ul>{preview.parcelas.map((p,i)=><li key={i}>{p.numero} — {p.vencimento?brDate(p.vencimento):'Sem vencimento'} — {money(p.valor)}</li>)}</ul>:<p>Nenhuma duplicata informada. Não é possível inferir vencimentos.</p>}
        {obraId&&recognition?.elegivel_compra&&recognition.itens.every(i=>i.status==='confirmado')&&<NfeCommitPanel key={preview.chave} obraId={obraId} preview={preview} recognition={recognition} source={xmlBase64} onImported={async()=>{onImported?.();await recognize(xmlBase64)}}/>}
        <p role="status">Prévia concluída. A conferência isolada não movimenta estoque ou financeiro. A importação integrada exige confirmação separada.</p>
      </>}
    </div>
  </Card>
}
