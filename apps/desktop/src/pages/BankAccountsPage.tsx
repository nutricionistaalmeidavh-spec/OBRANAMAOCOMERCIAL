import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Landmark, FileUp, Plus, RefreshCw } from 'lucide-react'
import { Button, Card, Empty, ErrorState, Field, Loading, PageHeader } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import './BankAccountsPage.css'

type Bank = { id:number; empresa_id:number; nome:string; banco_nome:string; agencia?:string; conta_identificador?:string; tipo_conta:string; saldo_inicial_centavos:number; saldo_referencia_data:string; ativo:number }
type PreviewRow = { line:number; date:string; description:string; amountCents:number; duplicate:boolean }
type Preview = { previewHash:string; total:number; importable:number; duplicates:number; invalid:number; invalidRows:{line:number;reason:string}[]; preview:PreviewRow[]; headers:string[]; mapping:Record<string,number|string>; duplicatedFile:boolean }
type Result = { duplicateFile:boolean; imported:number; duplicates:number; rejected:number; importId:number }
type Draft = { nome:string; bancoNome:string; agencia:string; contaIdentificador:string; tipoConta:string; saldoInicial:string; saldoReferenciaData:string; requestId:string }
const blank = ():Draft => ({ nome:'', bancoNome:'', agencia:'', contaIdentificador:'', tipoConta:'corrente', saldoInicial:'0,00', saldoReferenciaData:new Date().toISOString().slice(0,10), requestId:crypto.randomUUID() })
const money = (cents:number) => new Intl.NumberFormat('pt-BR',{ style:'currency',currency:'BRL' }).format(Number(cents||0)/100)
const displayDate = (date:string) => { const [year,month,day]=String(date||'').split('-');return year&&month&&day?day+'/'+month+'/'+year:String(date||'') }
const cents = (value:string) => {
  const trimmed=String(value||'').replace(/R\$/gi,'').replace(/\s/g,'').trim()
  if (!/^-?\d{1,12}(?:\.\d{3})*(?:,\d{1,2})?$/.test(trimmed) && !/^-?\d{1,12}(?:,\d{1,2})?$/.test(trimmed)) throw new Error('Informe o saldo em reais, por exemplo 1500,00.')
  const total=Math.round(Number(trimmed.replace(/\./g,'').replace(',','.'))*100)
  if(!Number.isSafeInteger(total)) throw new Error('Saldo fora do limite permitido.')
  return total
}
const bytesBase64 = (file:File) => new Promise<string>((resolve,reject)=>{
  const reader=new FileReader()
  reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'')
  reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'))
  reader.readAsDataURL(file)
})
const mask = (value:string|undefined) => {
  const s=String(value||'');return s.length>4?'••••'+s.slice(-4):s
}

export default function BankAccountsPage(){
  const [empresaId,setEmpresaId]=useState('')
  const [version,setVersion]=useState(0)
  const [bankId,setBankId]=useState('')
  const [adding,setAdding]=useState(false)
  const [draft,setDraft]=useState<Draft>(blank)
  const [file,setFile]=useState<File|null>(null)
  const [base64,setBase64]=useState('')
  const [mapping,setMapping]=useState<Record<string,string>>({})
  const [headers,setHeaders]=useState<string[]>([])
  const [delimiter,setDelimiter]=useState(';')
  const [showMapping,setShowMapping]=useState(false)
  const [preview,setPreview]=useState<Preview|null>(null)
  const [acceptInvalid,setAcceptInvalid]=useState(false)
  const [result,setResult]=useState<Result|null>(null)
  const [working,setWorking]=useState(false)
  const [error,setError]=useState('')
  const companies=useAsync<any[]>(()=>window.fluxoDre.empresas.list(),[])
  useEffect(()=>{if(!empresaId&&companies.data?.length)setEmpresaId(String(companies.data[0].id))},[companies.data,empresaId])
  const banks=useAsync<Bank[]>(()=>empresaId?window.fluxoDre.bancos.list(Number(empresaId)):Promise.resolve([]),[empresaId,version])
  useEffect(()=>{
    if(!banks.data?.length){setBankId('');return}
    if(!banks.data.some(item=>String(item.id)===bankId))setBankId(String(banks.data[0].id))
  },[banks.data,bankId])
  const selected=useMemo(()=>banks.data?.find(x=>String(x.id)===bankId),[banks.data,bankId])
  const imports=useAsync<any[]>(()=>empresaId&&bankId?window.fluxoDre.bancos.imports({empresaId:Number(empresaId),contaBancariaId:Number(bankId)}):Promise.resolve([]),[empresaId,bankId,version])
  const transactions=useAsync<any[]>(()=>empresaId&&bankId?window.fluxoDre.bancos.transactions({empresaId:Number(empresaId),contaBancariaId:Number(bankId)}):Promise.resolve([]),[empresaId,bankId,version])
  const updateDraft=(field:keyof Draft,value:string)=>setDraft(v=>({...v,[field]:value}))
  const resetFile=()=>{setFile(null);setBase64('');setPreview(null);setResult(null);setAcceptInvalid(false);setError('');setHeaders([]);setMapping({})}

  const submitBank=async(event:FormEvent)=>{
    event.preventDefault();setError('');setWorking(true)
    try{
      const bank=await window.fluxoDre.bancos.save({empresaId:Number(empresaId),nome:draft.nome,bancoNome:draft.bancoNome,agencia:draft.agencia,contaIdentificador:draft.contaIdentificador,tipoConta:draft.tipoConta,saldoInicialCentavos:cents(draft.saldoInicial),saldoReferenciaData:draft.saldoReferenciaData,requestId:draft.requestId})
      setAdding(false);setDraft(blank());setVersion(v=>v+1);setBankId(String(bank.id));resetFile()
    }catch(err){setError((err as Error).message)}
    finally{setWorking(false)}
  }
  const chooseFile=async(next:File|null)=>{
    resetFile()
    if(!next)return
    if(next.size>4*1024*1024){setError('Selecione um extrato de até 4 MB.');return}
    if(!/\.(csv|ofx)$/i.test(next.name)){setError('O arquivo precisa ser CSV ou OFX.');return}
    setWorking(true)
    try{
      const raw=await bytesBase64(next)
      setFile(next);setBase64(raw)
      if(/\.csv$/i.test(next.name)){
        const text=(await next.text()).replace(/^\uFEFF/,'')
        const first=text.split(/\r?\n/).find(line=>line.trim())||''
        const sep=first.includes(';')?';':first.includes('\t')?'\t':','
        setDelimiter(sep)
        setHeaders(first.split(sep).map(s=>s.replace(/^"|"$/g,'').trim()))
      }
    }catch(err){setError((err as Error).message)}
    finally{setWorking(false)}
  }
  const uploadPayload=()=>({
    empresaId:Number(empresaId), contaBancariaId:Number(bankId), fileName:file?.name||'',
    format:file?.name.split('.').pop()?.toLowerCase(), contentBase64:base64,
    mapping:{ ...Object.fromEntries(Object.entries(mapping).filter(([,v])=>v!=='').map(([k,v])=>[k,Number(v)])),delimiter }
  })
  const doPreview=async()=>{
    setWorking(true);setError('');setPreview(null);setResult(null)
    try{setPreview(await window.fluxoDre.bancos.preview(uploadPayload()))}
    catch(err){setError((err as Error).message);if(file?.name.toLowerCase().endsWith('.csv'))setShowMapping(true)}
    finally{setWorking(false)}
  }
  const confirm=async()=>{
    if(!preview)return
    setWorking(true);setError('')
    try{
      const saved=await window.fluxoDre.bancos.confirm({...uploadPayload(),previewHash:preview.previewHash,acceptInvalid})
      setResult(saved);setPreview(null);setVersion(v=>v+1)
    }catch(err){setError((err as Error).message)}
    finally{setWorking(false)}
  }
  const changeAccount=(id:string)=>{setBankId(id);resetFile()}
  const setColumn=(name:string,value:string)=>{setMapping(v=>({...v,[name]:value}));setPreview(null)}

  return <div className="bank-finance">
    <PageHeader title="Contas bancárias e extratos" description="Cadastre as contas da empresa, importe extratos e confira as movimentações antes de conciliar." actions={<Button icon={<Plus size={16}/>} onClick={()=>{setDraft(blank());setAdding(v=>!v);setError('')}}>{adding?'Fechar cadastro':'Adicionar conta'}</Button>}/>
    <div className="bank-section">
      <Field label="Empresa">
        <select value={empresaId} onChange={e=>{setEmpresaId(e.target.value);changeAccount('')}}>
          {companies.data?.map(x=><option key={x.id} value={x.id}>{x.nome_fantasia||x.razao_social||'Empresa '+x.id}</option>)}
        </select>
      </Field>
      <Button variant="secondary" disabled={working} icon={<RefreshCw size={15}/>} onClick={()=>setVersion(v=>v+1)}>Atualizar</Button>
    </div>
    {error&&<div className="bank-message bank-error" role="alert">{error}</div>}
    {adding&&<Card className="bank-form-card">
      <h2>Adicionar conta bancária</h2>
      <p>Esta conta pertence à empresa selecionada. As obras continuarão vinculadas aos lançamentos financeiros.</p>
      <form onSubmit={submitBank} className="bank-form">
        <Field label="Nome da conta" required><input required minLength={2} maxLength={120} value={draft.nome} onChange={e=>updateDraft('nome',e.target.value)} placeholder="Ex.: Conta operacional"/></Field>
        <Field label="Banco" required><input required minLength={2} maxLength={120} value={draft.bancoNome} onChange={e=>updateDraft('bancoNome',e.target.value)} placeholder="Ex.: Banco do Brasil"/></Field>
        <Field label="Agência"><input value={draft.agencia} onChange={e=>updateDraft('agencia',e.target.value)}/></Field>
        <Field label="Identificação da conta"><input value={draft.contaIdentificador} onChange={e=>updateDraft('contaIdentificador',e.target.value)} placeholder="Conta e dígito"/></Field>
        <Field label="Tipo de conta"><select value={draft.tipoConta} onChange={e=>updateDraft('tipoConta',e.target.value)}><option value="corrente">Corrente</option><option value="poupanca">Poupança</option><option value="pagamento">Pagamento</option><option value="outra">Outra</option></select></Field>
        <Field label="Saldo inicial (R$)" required><input required value={draft.saldoInicial} onChange={e=>updateDraft('saldoInicial',e.target.value)} placeholder="0,00"/></Field>
        <Field label="Data de referência do saldo" required><input required type="date" value={draft.saldoReferenciaData} onChange={e=>updateDraft('saldoReferenciaData',e.target.value)}/></Field>
        <div className="bank-form-actions"><Button type="button" variant="secondary" onClick={()=>setAdding(false)}>Cancelar</Button><Button disabled={working||!empresaId} type="submit">{working?'Salvando...':'Salvar conta'}</Button></div>
      </form>
    </Card>}
    {banks.loading?<Loading label="Carregando contas bancárias..."/>:banks.error?<ErrorState error={banks.error} retry={banks.reload}/>:!banks.data?.length?<Card><Empty title="Nenhuma conta bancária cadastrada" description="Adicione a conta usada pela empresa para começar a importar extratos."/></Card>:<>
      <div className="bank-card-grid">
        {banks.data.map(bank=><button type="button" className={'bank-account-card'+(bankId===String(bank.id)?' selected':'')} key={bank.id} onClick={()=>changeAccount(String(bank.id))} aria-pressed={bankId===String(bank.id)}>
          <Landmark size={21}/><strong>{bank.nome}</strong><span>{bank.banco_nome} · {mask(bank.conta_identificador)}</span><small>Saldo de referência: {money(bank.saldo_inicial_centavos)} em {displayDate(bank.saldo_referencia_data)}</small><small>{bank.ativo?'Ativa':'Inativa'}</small>
        </button>)}
      </div>
      {selected&&<Card className="bank-import-card">
        <div className="bank-card-title"><div><h2>Importar extrato — {selected.nome}</h2><p>Os valores serão registrados como movimentos bancários. Contas a pagar e receber não serão baixadas nesta etapa.</p></div><FileUp size={23}/></div>
        <div className="bank-import-grid">
          <Field label="Arquivo OFX ou CSV"><input type="file" accept=".csv,.ofx" onChange={e=>void chooseFile(e.target.files?.[0]||null)}/></Field>
          <div className="bank-import-action"><Button disabled={!base64||working||!selected.ativo} onClick={()=>void doPreview()}>{working?'Processando...':'Conferir prévia'}</Button></div>
        </div>
        {!!file&&<p className="bank-hint">Arquivo selecionado: {file.name} — {(file.size/1024).toFixed(1)} KB.</p>}
        {!!headers.length&&<details open={showMapping} onToggle={e=>setShowMapping(e.currentTarget.open)} className="bank-mapping"><summary>Configurar colunas do CSV (se necessário)</summary>
          <div className="bank-form">
            {(['date','description','amount','credit','debit','id'] as const).map(key=><Field key={key} label={({date:'Data',description:'Descrição',amount:'Valor (com sinal)',credit:'Entrada',debit:'Saída',id:'Identificador'} as Record<string,string>)[key]}><select value={mapping[key]??''} onChange={e=>setColumn(key,e.target.value)}><option value="">Detectar automaticamente</option>{headers.map((h,i)=><option value={String(i)} key={i}>{h}</option>)}</select></Field>)}
            <Field label="Separador"><select value={delimiter} onChange={e=>{setDelimiter(e.target.value);setPreview(null)}}><option value=";">Ponto e vírgula</option><option value=",">Vírgula</option><option value={'\t'}>Tabulação</option></select></Field>
          </div>
        </details>}
        {preview&&<div className="bank-preview" aria-live="polite">
          <h3>Prévia do extrato</h3>
          {preview.duplicatedFile&&<div className="bank-message">Este arquivo já foi importado nesta conta.</div>}
          <div className="bank-stats"><span><strong>{preview.total}</strong> linhas</span><span><strong>{preview.importable}</strong> novas</span><span><strong>{preview.duplicates}</strong> duplicadas</span><span><strong>{preview.invalid}</strong> inválidas</span></div>
          {preview.invalidRows.length>0&&<div className="bank-invalid"><strong>Linhas que precisam de atenção</strong>{preview.invalidRows.map(x=><div key={x.line}>Linha {x.line}: {x.reason}</div>)}</div>}
          <div className="bank-table"><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Situação</th></tr></thead><tbody>
            {preview.preview.map((tx,i)=><tr key={i}><td>{displayDate(tx.date)}</td><td>{tx.description}</td><td>{money(tx.amountCents)}</td><td>{tx.duplicate?'Já existente':'Nova'}</td></tr>)}
          </tbody></table></div>
          {preview.invalid>0&&<label className="bank-check"><input type="checkbox" checked={acceptInvalid} onChange={e=>setAcceptInvalid(e.target.checked)}/> Estou ciente de que as {preview.invalid} linhas inválidas não serão importadas.</label>}
          <div className="bank-form-actions"><Button variant="secondary" onClick={()=>setPreview(null)}>Voltar</Button><Button onClick={()=>void confirm()} disabled={working||preview.duplicatedFile||preview.importable===0||(preview.invalid>0&&!acceptInvalid)}>{working?'Importando...':'Confirmar importação'}</Button></div>
        </div>}
        {result&&<div className="bank-message bank-success" role="status">{result.duplicateFile?'Este extrato já foi importado.':'Importação concluída.'} {result.imported} movimentações novas, {result.duplicates} duplicadas, {result.rejected} inválidas. Nenhuma baixa financeira foi criada.</div>}
      </Card>}
      <div className="bank-history-grid">
        <Card><h2>Movimentações importadas</h2>{transactions.loading?<Loading/>:transactions.error?<ErrorState error={transactions.error} retry={transactions.reload}/>:!transactions.data?.length?<Empty title="Sem movimentações" description="Importe o primeiro extrato para visualizar seus lançamentos."/>:<div className="bank-table"><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>{transactions.data.map(tx=><tr key={tx.id}><td>{displayDate(tx.data)}</td><td>{tx.descricao}</td><td>{money(tx.valor_centavos)}</td></tr>)}</tbody></table></div>}</Card>
        <Card><h2>Histórico de importações</h2>{imports.loading?<Loading/>:imports.error?<ErrorState error={imports.error} retry={imports.reload}/>:!imports.data?.length?<Empty title="Nenhuma importação" description="O histórico será exibido após a confirmação do primeiro extrato."/>:<div className="bank-table"><table><thead><tr><th>Arquivo</th><th>Novas</th><th>Duplicadas</th></tr></thead><tbody>{imports.data.map(x=><tr key={x.id}><td>{x.nome_arquivo}</td><td>{x.importadas}</td><td>{x.duplicadas}</td></tr>)}</tbody></table></div>}</Card>
      </div>
    </>}
  </div>
}
