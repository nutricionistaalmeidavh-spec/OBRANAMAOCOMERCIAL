import { Edit3, Paperclip, Plus } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Button, Card, Empty, ErrorState, Field, FormActions, Loading, Modal, PageHeader, Status } from '../components/ui'
import { useAsync } from '../hooks/useAsync'
import { brDate, brl, currentCompetence, toCents, today } from '../utils/format'

const blank = { obra_id: '', frente_id: '', contrato_id: '', empresa_id: '', numero: '', competencia: currentCompetence(), data: today(), vencimento: today(), periodo_inicio: '', periodo_fim: '', status: 'rascunho', descricao: '', retencoes: '0', descontos: '0', valor_bruto: '0', observacoes: '', itens: [] }

export default function MeasurementsPage() {
  const [work, setWork] = useState('')
  const [form, setForm] = useState<any>(null)
  const [notice, setNotice] = useState('')
  const works = useAsync(() => window.fluxoDre.obras.list(), [])
  const companies = useAsync(() => window.fluxoDre.empresas.list(), [])
  const fronts = useAsync(() => work ? window.fluxoDre.frentes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const contracts = useAsync(() => work ? window.fluxoDre.contratos.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const budget = useAsync(() => work ? window.fluxoDre.orcamentos.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const items = useAsync(() => work ? window.fluxoDre.medicoes.list({ obra_id: Number(work) }) : Promise.resolve([]), [work])
  const loadError = works.error || companies.error || fronts.error || contracts.error || budget.error || items.error
  async function open(item?: any) {
    if (!item) {
      setForm({ ...blank, obra_id: work })
      return
    }
    const measuredItems = await window.fluxoDre.medicoes.itensMedidos.list({ medicao_id: item.id }).catch(() => [])
    setForm({
      ...item,
      frente_id: item.frente_id || '',
      contrato_id: item.contrato_id || '',
      empresa_id: '',
      vencimento: item.data,
      retencoes: (item.retencoes_centavos / 100).toFixed(2).replace('.', ','),
      descontos: (item.descontos_centavos / 100).toFixed(2).replace('.', ','),
      valor_bruto: (item.valor_bruto_centavos / 100).toFixed(2).replace('.', ','),
      itens: measuredItems.map((row: any) => ({ ...row, item_orcamentario_id: row.item_orcamentario_id || '', quantidade_periodo: String(row.quantidade_periodo), valor_periodo: (row.valor_periodo_centavos / 100).toFixed(2).replace('.', ',') }))
    })
  }
  const addMeasuredItem = () => setForm((current: any) => ({ ...(current || blank), itens: [...(current?.itens || []), { item_orcamentario_id: '', descricao: '', unidade: 'un', quantidade_total: '0', quantidade_periodo: '0', valor_periodo: '0', justificativa_excesso: '' }] }))
  const changeItem = (index: number, field: string, value: string) => setForm((current: any) => ({ ...(current || blank), itens: (current?.itens || []).map((row: any, i: number) => i === index ? { ...row, [field]: value } : row) }))
  const removeItem = (index: number) => setForm((current: any) => ({ ...(current || blank), itens: (current?.itens || []).filter((_: any, i: number) => i !== index) }))
  async function submit(event: FormEvent) {
    event.preventDefault()
    const measuredItems = form.itens || []
    const gross = measuredItems.length ? measuredItems.reduce((sum: number, item: any) => sum + toCents(item.valor_periodo), 0) : toCents(form.valor_bruto)
    const ret = toCents(form.retencoes)
    const disc = toCents(form.descontos)
    await window.fluxoDre.medicoes.saveWithItems({
      ...form,
      obra_id: Number(form.obra_id),
      frente_id: form.frente_id ? Number(form.frente_id) : null,
      contrato_id: form.contrato_id ? Number(form.contrato_id) : null,
      retencoes_centavos: ret,
      descontos_centavos: disc,
      valor_bruto_centavos: gross,
      valor_liquido_centavos: Math.max(0, gross - ret - disc),
      itens: measuredItems.map((item: any) => ({ ...item, item_orcamentario_id: item.item_orcamentario_id ? Number(item.item_orcamentario_id) : null, quantidade_total: Number(item.quantidade_total || 0), quantidade_periodo: Number(item.quantidade_periodo || 0), valor_periodo_centavos: toCents(item.valor_periodo) })),
      conta: form.empresa_id ? { empresa_id: Number(form.empresa_id), competencia: form.competencia, vencimento: form.vencimento } : null
    })
    setWork(String(form.obra_id))
    setForm(null)
    items.reload()
  }
  async function attach(medicao: any) {
    const result = await window.fluxoDre.medicoes.importAttachment({ medicao_id: medicao.id })
    setNotice(result ? `Anexo vinculado a medicao ${medicao.numero}.` : '')
  }
  if (loadError) return <Card><ErrorState error={loadError} retry={() => { works.reload(); companies.reload(); fronts.reload(); contracts.reload(); budget.reload(); items.reload() }}/></Card>
  return <>
    <PageHeader title="Medicoes" description="Registre avancos por item/etapa, anexe PDFs e acompanhe faturamento/recebimento." actions={<Button icon={<Plus size={16}/>} disabled={!work} onClick={() => open()}>Nova medicao</Button>}/>
    <div className="filters"><Field label="Obra"><select value={work} onChange={(event) => setWork(event.target.value)}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field></div>
    {notice && <div className="success-box">{notice}</div>}
    <Card>{items.loading ? <Loading/> : items.data?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Numero</th><th>Frente</th><th>Contrato</th><th>Periodo</th><th>Status</th><th className="number">Liquido</th><th/></tr></thead><tbody>{items.data.map((item: any) => <tr key={item.id}><td><strong>{item.numero}</strong><small>{item.descricao}</small></td><td>{fronts.data?.find((front: any) => front.id === item.frente_id)?.nome || 'Obra geral'}</td><td>{contracts.data?.find((contract: any) => contract.id === item.contrato_id)?.numero || '-'}</td><td>{brDate(item.periodo_inicio || item.data)} a {brDate(item.periodo_fim || item.data)}</td><td><Status value={item.status}/></td><td className="number">{brl(item.valor_liquido_centavos)}</td><td><div className="row-actions"><button className="icon-button" title="Editar" onClick={() => open(item)}><Edit3 size={15}/></button><button className="icon-button" title="Anexar PDF ou comprovante" onClick={() => attach(item)}><Paperclip size={15}/></button></div></td></tr>)}</tbody></table></div> : <Empty title={work ? 'Nenhuma medicao' : 'Selecione uma obra'} description="Cadastre a medicao e anexe boletins, memoria de calculo ou notas."/>}</Card>
    <Modal open={!!form} title={form?.id ? 'Editar medicao' : 'Nova medicao'} onClose={() => setForm(null)} size="xl"><form onSubmit={submit}><div className="modal-body">
      <div className="form-grid form-grid-3">
        <Field label="Obra" required><select required value={form?.obra_id || ''} onChange={(event) => { setForm({ ...form, obra_id: event.target.value, frente_id: '', contrato_id: '' }); setWork(event.target.value) }}><option value="">Selecione</option>{works.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
        <Field label="Frente"><select value={form?.frente_id || ''} onChange={(event) => setForm({ ...form, frente_id: event.target.value })}><option value="">Obra geral</option>{fronts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Field>
        <Field label="Contrato"><select value={form?.contrato_id || ''} onChange={(event) => setForm({ ...form, contrato_id: event.target.value })}><option value="">Sem contrato</option>{contracts.data?.map((item: any) => <option key={item.id} value={item.id}>{item.numero || item.descricao}</option>)}</select></Field>
        <Field label="Numero" required><input required value={form?.numero || ''} onChange={(event) => setForm({ ...form, numero: event.target.value })}/></Field>
        <Field label="Competencia"><input type="month" value={form?.competencia || ''} onChange={(event) => setForm({ ...form, competencia: event.target.value })}/></Field>
        <Field label="Status"><select value={form?.status || 'rascunho'} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="rascunho">Rascunho</option><option value="enviada">Enviada</option><option value="aprovada">Aprovada</option><option value="faturada">Faturada</option><option value="recebida">Recebida</option><option value="cancelada">Cancelada</option></select></Field>
        <Field label="Inicio"><input type="date" value={form?.periodo_inicio || ''} onChange={(event) => setForm({ ...form, periodo_inicio: event.target.value })}/></Field>
        <Field label="Fim"><input type="date" value={form?.periodo_fim || ''} onChange={(event) => setForm({ ...form, periodo_fim: event.target.value })}/></Field>
        <Field label="Vencimento financeiro"><input type="date" value={form?.vencimento || ''} onChange={(event) => setForm({ ...form, vencimento: event.target.value })}/></Field>
        <Field label="Empresa para receber"><select value={form?.empresa_id || ''} onChange={(event) => setForm({ ...form, empresa_id: event.target.value })}><option value="">Nao gerar conta</option>{companies.data?.map((item: any) => <option key={item.id} value={item.id}>{item.nome_fantasia || item.razao_social}</option>)}</select></Field>
        <Field label="Valor bruto manual"><input value={form?.valor_bruto || ''} onChange={(event) => setForm({ ...form, valor_bruto: event.target.value })}/></Field>
        <Field label="Retencoes"><input value={form?.retencoes || ''} onChange={(event) => setForm({ ...form, retencoes: event.target.value })}/></Field>
        <Field label="Descontos"><input value={form?.descontos || ''} onChange={(event) => setForm({ ...form, descontos: event.target.value })}/></Field>
        <Field label="Descricao" wide><textarea value={form?.descricao || ''} onChange={(event) => setForm({ ...form, descricao: event.target.value })}/></Field>
      </div>
      <section className="rdo-section"><div><h3>Itens medidos</h3><Button type="button" variant="secondary" icon={<Plus size={14}/>} onClick={addMeasuredItem}>Adicionar item</Button></div>{(form?.itens || []).map((row: any, index: number) => <div className="rdo-row rdo-occurrence" key={index}><select value={row.item_orcamentario_id || ''} onChange={(event) => { const budgetItem = budget.data?.find((item: any) => item.id === Number(event.target.value)); changeItem(index, 'item_orcamentario_id', event.target.value); if (budgetItem) { changeItem(index, 'descricao', budgetItem.descricao); changeItem(index, 'unidade', budgetItem.unidade); changeItem(index, 'quantidade_total', String(budgetItem.quantidade)) } }}><option value="">Item livre</option>{budget.data?.map((item: any) => <option key={item.id} value={item.id}>{item.descricao}</option>)}</select><input placeholder="Descricao" value={row.descricao || ''} onChange={(event) => changeItem(index, 'descricao', event.target.value)}/><input placeholder="Un" value={row.unidade || 'un'} onChange={(event) => changeItem(index, 'unidade', event.target.value)}/><input type="number" min="0" step="0.001" placeholder="Total" value={row.quantidade_total || ''} onChange={(event) => changeItem(index, 'quantidade_total', event.target.value)}/><input type="number" min="0" step="0.001" placeholder="Medido" value={row.quantidade_periodo || ''} onChange={(event) => changeItem(index, 'quantidade_periodo', event.target.value)}/><input placeholder="Valor periodo" value={row.valor_periodo || ''} onChange={(event) => changeItem(index, 'valor_periodo', event.target.value)}/><button type="button" className="icon-button" onClick={() => removeItem(index)}>x</button></div>)}</section>
    </div><FormActions onCancel={() => setForm(null)} submitLabel="Salvar medicao"/></form></Modal>
  </>
}
