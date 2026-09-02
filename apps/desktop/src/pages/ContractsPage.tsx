import { Edit3, FilePlus2, Paperclip, Plus } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Button, Card, Empty, Field, FormActions, Loading, Modal, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl, toCents, today } from '../utils/format'

const blank = { obra_id: '', frente_id: '', cliente_id: '', fornecedor_id: '', empresa_id: '', numero: '', tipo: 'principal', descricao: '', valor: '', retencao: '0', garantia: '', reajuste: '', data_inicio: today(), data_fim: '', status: 'ativo', competencia: today().slice(0, 7), vencimento: today(), observacoes: '' }

export default function ContractsPage() {
  const [work, setWork] = useState(new URLSearchParams(location.search).get('obra') || '')
  const [form, setForm] = useState<any>(null)
  const [addendum, setAddendum] = useState<any>(null)
  const [notice, setNotice] = useState('')
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const clients = useAsync(() => window.fluxoDre.clientes.list(), [])
  const suppliers = useAsync(() => window.fluxoDre.fornecedores.list(), [])
  const companies = useAsync(() => window.fluxoDre.empresas.list(), [])
  const fronts = useAsync(() => work ? window.fluxoDre.frentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const contracts = useAsync(() => work ? window.fluxoDre.contratos.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const addenda = useAsync(() => window.fluxoDre.contratos.aditivos.list(), [])
  const open = (contract?: any) => setForm(contract ? { ...contract, frente_id: contract.frente_id || '', cliente_id: contract.cliente_id || '', fornecedor_id: contract.fornecedor_id || '', empresa_id: '', retencao: (contract.retencao_centavos / 100).toFixed(2).replace('.', ','), valor: (contract.valor_centavos / 100).toFixed(2).replace('.', ','), vencimento: contract.data_inicio || today(), competencia: (contract.data_inicio || today()).slice(0, 7) } : { ...blank, obra_id: work })
  async function save(event: FormEvent) {
    event.preventDefault()
    await window.fluxoDre.contratos.create({
      ...form,
      obra_id: Number(form.obra_id),
      frente_id: form.frente_id ? Number(form.frente_id) : null,
      cliente_id: form.cliente_id ? Number(form.cliente_id) : null,
      fornecedor_id: form.fornecedor_id ? Number(form.fornecedor_id) : null,
      valor_centavos: toCents(form.valor),
      retencao_centavos: toCents(form.retencao),
      conta: form.empresa_id ? { empresa_id: Number(form.empresa_id), competencia: form.competencia, vencimento: form.vencimento } : null
    })
    setForm(null)
    contracts.reload()
  }
  async function saveAddendum(event: FormEvent) {
    event.preventDefault()
    await window.fluxoDre.contratos.addendum({ contrato_id: addendum.contrato_id, numero: addendum.numero, descricao: addendum.descricao, valor_centavos: toCents(addendum.valor), data: addendum.data, status: addendum.status, impacto_prazo_dias: Number(addendum.impacto_prazo_dias || 0), observacoes: addendum.observacoes })
    setAddendum(null)
    addenda.reload()
    contracts.reload()
  }
  async function attach(contract: any) {
    const result = await window.fluxoDre.documentos.importForWork({ obra_id: contract.obra_id, frente_id: contract.frente_id || null, contrato_id: contract.id, categoria: 'contrato', title: `Contrato ${contract.numero || contract.id}` })
    if (result) setNotice('Documento vinculado ao contrato.')
  }
  return <>
    <PageHeader title="Contratos e aditivos" description="Controle contratos, garantias, retencoes, reajustes, documentos e impactos financeiros." actions={<Button icon={<Plus size={16}/>} disabled={!work} onClick={() => open()}>Novo contrato</Button>}/>
    <div className="filters"><Field label="Obra"><select value={work} onChange={(event) => setWork(event.target.value)}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field></div>
    {notice && <div className="success-box">{notice}</div>}
    <Card>{contracts.loading ? <Loading/> : contracts.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Contrato</th><th>Frente</th><th>Tipo</th><th>Periodo</th><th className="number">Valor</th><th>Status</th><th>Aditivos</th><th/></tr></thead><tbody>{contracts.data.map((item: any) => <tr key={item.id}><td><strong>{item.numero || `#${item.id}`}</strong><small>{item.descricao}</small></td><td>{fronts.data?.find((front: any) => front.id === item.frente_id)?.nome || 'Obra geral'}</td><td>{item.tipo}</td><td>{brDate(item.data_inicio)} a {brDate(item.data_fim)}</td><td className="number">{brl(item.valor_centavos)}<small>Ret. {brl(item.retencao_centavos || 0)}</small></td><td><Status value={item.status}/></td><td>{addenda.data?.filter((add: any) => add.contrato_id === item.id).length || 0}</td><td><div className="row-actions"><button className="icon-button" onClick={() => open(item)} title="Editar"><Edit3 size={15}/></button><button className="icon-button" onClick={() => attach(item)} title="Anexar documento"><Paperclip size={15}/></button><Button variant="secondary" icon={<FilePlus2 size={15}/>} onClick={() => setAddendum({ contrato_id: item.id, numero: '', descricao: '', valor: '', data: today(), status: 'contratado', impacto_prazo_dias: 0, observacoes: '' })}>Aditivo</Button></div></td></tr>)}</tbody></table></div> : <Empty title={work ? 'Nenhum contrato' : 'Selecione uma obra'} description="Cadastre contratos e aditivos para acompanhar valor contratado."/>}</Card>
    <Modal open={!!form} title={form?.id ? 'Editar contrato' : 'Novo contrato'} onClose={() => setForm(null)} size="lg"><form onSubmit={save}><div className="modal-body form-grid form-grid-3">
      <Field label="Frente"><select value={form?.frente_id || ''} onChange={(event) => setForm({ ...form, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
      <Field label="Tipo"><select value={form?.tipo || 'principal'} onChange={(event) => setForm({ ...form, tipo: event.target.value })}><option value="principal">Principal</option><option value="subempreitada">Subempreitada</option><option value="fornecimento">Fornecimento</option><option value="servico">Servico</option></select></Field>
      <Field label="Status"><select value={form?.status || 'ativo'} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ativo">Ativo</option><option value="em_negociacao">Em negociacao</option><option value="suspenso">Suspenso</option><option value="encerrado">Encerrado</option><option value="cancelado">Cancelado</option></select></Field>
      <Field label="Cliente"><select value={form?.cliente_id || ''} onChange={(event) => setForm({ ...form, cliente_id: event.target.value })}><option value="">Nao informado</option>{clients.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
      <Field label="Fornecedor"><select value={form?.fornecedor_id || ''} onChange={(event) => setForm({ ...form, fornecedor_id: event.target.value })}><option value="">Nao informado</option>{suppliers.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
      <Field label="Empresa para conta"><select value={form?.empresa_id || ''} onChange={(event) => setForm({ ...form, empresa_id: event.target.value })}><option value="">Nao gerar conta</option>{companies.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome_fantasia || item.razao_social}</option>)}</select></Field>
      <Field label="Numero"><input value={form?.numero || ''} onChange={(event) => setForm({ ...form, numero: event.target.value })}/></Field>
      <Field label="Valor" required><input required value={form?.valor || ''} onChange={(event) => setForm({ ...form, valor: event.target.value })}/></Field>
      <Field label="Retencao"><input value={form?.retencao || ''} onChange={(event) => setForm({ ...form, retencao: event.target.value })}/></Field>
      <Field label="Garantia"><input value={form?.garantia || ''} onChange={(event) => setForm({ ...form, garantia: event.target.value })}/></Field>
      <Field label="Reajuste"><input value={form?.reajuste || ''} onChange={(event) => setForm({ ...form, reajuste: event.target.value })}/></Field>
      <Field label="Inicio"><input type="date" value={form?.data_inicio || ''} onChange={(event) => setForm({ ...form, data_inicio: event.target.value })}/></Field>
      <Field label="Fim"><input type="date" value={form?.data_fim || ''} onChange={(event) => setForm({ ...form, data_fim: event.target.value })}/></Field>
      <Field label="Descricao" wide required><textarea required value={form?.descricao || ''} onChange={(event) => setForm({ ...form, descricao: event.target.value })}/></Field>
      <Field label="Observacoes" wide><textarea value={form?.observacoes || ''} onChange={(event) => setForm({ ...form, observacoes: event.target.value })}/></Field>
    </div><FormActions onCancel={() => setForm(null)}/></form></Modal>
    <Modal open={!!addendum} title="Aditivo" onClose={() => setAddendum(null)}><form onSubmit={saveAddendum}><div className="modal-body form-grid"><Field label="Numero"><input value={addendum?.numero || ''} onChange={(event) => setAddendum({ ...addendum, numero: event.target.value })}/></Field><Field label="Data"><input type="date" value={addendum?.data || ''} onChange={(event) => setAddendum({ ...addendum, data: event.target.value })}/></Field><Field label="Status"><select value={addendum?.status || 'contratado'} onChange={(event) => setAddendum({ ...addendum, status: event.target.value })}><option value="solicitado">Solicitado</option><option value="contratado">Contratado</option><option value="recusado">Recusado</option></select></Field><Field label="Valor" required><input required value={addendum?.valor || ''} onChange={(event) => setAddendum({ ...addendum, valor: event.target.value })}/></Field><Field label="Impacto prazo dias"><input type="number" value={addendum?.impacto_prazo_dias || 0} onChange={(event) => setAddendum({ ...addendum, impacto_prazo_dias: event.target.value })}/></Field><Field label="Descricao" wide required><textarea required value={addendum?.descricao || ''} onChange={(event) => setAddendum({ ...addendum, descricao: event.target.value })}/></Field></div><FormActions onCancel={() => setAddendum(null)} submitLabel="Salvar aditivo"/></form></Modal>
  </>
}
