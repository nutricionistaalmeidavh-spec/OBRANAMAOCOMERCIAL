import { useRef, useState } from 'react'
import { FilePlus } from 'lucide-react'
import { Button, Card } from './ui'
import OperationalSheetGrid, { type SheetColumn } from './OperationalSheetGrid'
import { MAX_NFE_BYTES, parseNfePreview, type NfePreview } from '../utils/nfe-preview'
import { brDate } from '../utils/format'

const money=(v:string)=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const columns:SheetColumn[]=[
  {key:'numero',label:'Item'}, {key:'codigo',label:'Código'},
  {key:'descricao',label:'Material',width:230},{key:'unidade',label:'Unidade'},
  {key:'quantidade',label:'Quantidade'},{key:'valor_unitario',label:'Preço unitário (R$)'},
  {key:'valor_produto',label:'Total (R$)'}
]
export default function NfePreviewSection({obraId}:{obraId:number|null}){
  const input=useRef<HTMLInputElement>(null)
  const [preview,setPreview]=useState<NfePreview|null>(null)
  const [fileName,setFileName]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const read=async(file:File|undefined)=>{
    if(!file||busy)return
    setBusy(true);setError('')
    try{
      if(!/\.xml$/i.test(file.name)||!file.size||file.size>MAX_NFE_BYTES)throw new Error('Selecione um XML de NF-e de até 8 MB.')
      const data=parseNfePreview(await file.text())
      setPreview(data);setFileName(file.name)
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível ler o XML.')}
    finally{setBusy(false);if(input.current)input.current.value=''}
  }
  return <Card style={{marginTop:14}}>
    <div className="card-header"><div><h2>Conferir XML de NF-e</h2><p>Leitura local para revisão dos dados fiscais. Nenhum lançamento será criado nesta etapa.</p></div><Button type="button" variant="secondary" icon={<FilePlus size={16}/>} disabled={!obraId||busy} onClick={()=>input.current?.click()}>{busy?'Lendo XML...':'Selecionar XML'}</Button></div>
    <input ref={input} type="file" accept=".xml,application/xml,text/xml" hidden onChange={e=>void read(e.target.files?.[0])}/>
    <div className="card-body">
      <p>{!obraId?'Escolha a obra antes de conferir o XML.':'Arquivo XML de NF-e modelo 55, até 8 MB. A leitura não consulta a SEFAZ.'}</p>
      {error&&<div className="notice" role="alert">{error}{preview?' A prévia anterior foi preservada.':''}</div>}
      {preview&&<><div className="row-actions"><strong>{fileName}</strong><Button variant="secondary" disabled={busy} onClick={()=>{setPreview(null);setFileName('');setError('')}}>Limpar prévia</Button></div>
        <dl><dt>Fornecedor</dt><dd>{preview.fornecedor} — {preview.documento}</dd><dt>Nota e série</dt><dd>{preview.numero} / {preview.serie}</dd><dt>Chave de acesso</dt><dd style={{overflowWrap:'anywhere'}}>{preview.chave}</dd><dt>Emissão</dt><dd>{brDate(preview.emissao)}</dd><dt>Total fiscal</dt><dd>{money(preview.total)}</dd><dt>Protocolo</dt><dd>{preview.protocolo||'Não consta no XML'} {preview.status?'(status informado no arquivo '+preview.status+')':''}</dd></dl>
        <OperationalSheetGrid area="compras" title="Itens do XML — somente conferência" rows={preview.itens.map(i=>({...i,id:i.numero}))} columns={columns} showImport={false} filename={'nfe-'+preview.numero}/>
        <h3>Parcelas informadas no XML</h3>
        {preview.parcelas.length?<ul>{preview.parcelas.map((p,i)=><li key={i}>{p.numero} — {p.vencimento?brDate(p.vencimento):'Sem vencimento'} — {money(p.valor)}</li>)}</ul>:<p>Nenhuma duplicata informada. Não é possível inferir vencimentos.</p>}
        <p role="status">Prévia concluída. O arquivo não foi arquivado, a nota não foi cadastrada e não houve movimentação de estoque ou financeiro.</p>
      </>}
    </div>
  </Card>
}
