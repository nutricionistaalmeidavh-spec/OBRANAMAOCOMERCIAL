import { Download } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Field, Modal } from '../components/ui'
import { currentCompetence } from '../utils/format'

const fields: { key: EmployeeReportField; label: string }[] = [
  { key: 'empresa', label: 'Empresa' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'nome', label: 'Nome completo' },
  { key: 'cpf', label: 'CPF' },
  { key: 'data_nascimento', label: 'Data de nascimento' },
  { key: 'email', label: 'E-mail' },
  { key: 'telefone', label: 'Celular / telefone' },
  { key: 'beneficios', label: 'Benefícios fixos' },
]

type Employee = { id: number; nome: string; empresa_id: number | null; status: string }
type Company = { id: number; nome_fantasia: string | null; razao_social: string }
const companyName = (company: Company) => company.nome_fantasia || company.razao_social

export default function EmployeeReportDialog({ employees, companies, onClose, onSaved }: {
  employees: Employee[]
  companies: Company[]
  onClose: () => void
  onSaved: (filename: string) => void
}) {
  const mh = companies.find(company => /\bMH\b/i.test(companyName(company)))
  const [companyId, setCompanyId] = useState<number | null>(mh?.id ?? null)
  const [fieldsSelected, setFieldsSelected] = useState(new Set(fields.map(field => field.key)))
  const [employeeIds, setEmployeeIds] = useState(new Set(employees.filter(employee =>
    employee.status === 'ativo' && (!mh || employee.empresa_id === mh.id)
  ).map(employee => employee.id)))
  const [format, setFormat] = useState<EmployeeReportFormat>('xlsx')
  const [competence, setCompetence] = useState(currentCompetence)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const scoped = employees.filter(employee => companyId === null || employee.empresa_id === companyId)
  const visible = scoped.filter(employee => employee.nome.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))
  const selectedIds = scoped.filter(employee => employeeIds.has(employee.id)).map(employee => employee.id)
  const close = () => { if (!saving) onClose() }

  function changeCompany(id: number | null) {
    setCompanyId(id)
    setEmployeeIds(new Set(employees.filter(employee =>
      employee.status === 'ativo' && (id === null || employee.empresa_id === id)
    ).map(employee => employee.id)))
  }

  async function generate(event: FormEvent) {
    event.preventDefault()
    if (saving || !selectedIds.length || !fieldsSelected.size) return
    setSaving(true)
    setError('')
    try {
      const filename = await window.fluxoDre.funcionarios.exportReport({
        ids: selectedIds, empresaId: companyId, campos: [...fieldsSelected], formato: format, competencia: competence
      })
      if (filename) onSaved(filename)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o relatório.')
    } finally {
      setSaving(false)
    }
  }

  return <Modal open title="Relatório de funcionários" size="lg" onClose={close}>
    <form onSubmit={generate}>
      <fieldset disabled={saving} className="modal-body form-grid form-grid-3 employee-report-options">
        <Field label="Empresa">
          <select value={companyId ?? ''} onChange={event => changeCompany(event.target.value ? Number(event.target.value) : null)}>
            <option value="">Todas as empresas</option>
            {companies.map(company => <option key={company.id} value={company.id}>{companyName(company)}</option>)}
          </select>
        </Field>
        <Field label="Formato">
          <select value={format} onChange={event => setFormat(event.target.value as EmployeeReportFormat)}>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV (.csv)</option>
            <option value="pdf">PDF (.pdf)</option>
            <option value="docx">Word (.docx)</option>
          </select>
        </Field>
        <Field label="Competência dos benefícios">
          <input type="month" required value={competence} onChange={event => setCompetence(event.target.value)}/>
        </Field>
        <fieldset className="field-wide employee-report-group">
          <legend>Dados do relatório</legend>
          <div className="doc-grid">
            {fields.map(({ key, label }) => <label key={key} className="doc-option">
              <input type="checkbox" checked={fieldsSelected.has(key)} onChange={event => {
                const next = new Set(fieldsSelected)
                if (event.target.checked) next.add(key)
                else next.delete(key)
                setFieldsSelected(next)
              }}/>{label}
            </label>)}
          </div>
        </fieldset>
        <fieldset className="field-wide employee-report-group">
          <legend>Funcionários ({selectedIds.length} selecionados)</legend>
          <div className="toolbar">
            <Field label="Buscar por nome"><input type="search" value={search} onChange={event => setSearch(event.target.value)}/></Field>
            <div className="toolbar-right">
              <Button type="button" variant="secondary" disabled={!visible.length} onClick={() =>
                setEmployeeIds(new Set([...employeeIds, ...visible.map(employee => employee.id)]))
              }>Selecionar exibidos</Button>
              <Button type="button" variant="ghost" disabled={!selectedIds.length} onClick={() => setEmployeeIds(new Set())}>Limpar seleção</Button>
            </div>
          </div>
          <ul className="employee-report-list">
            {visible.map(employee => <li key={employee.id}>
              <label className="benefit-toggle">
                <input type="checkbox" checked={employeeIds.has(employee.id)} onChange={event => {
                  const next = new Set(employeeIds)
                  if (event.target.checked) next.add(employee.id)
                  else next.delete(employee.id)
                  setEmployeeIds(next)
                }}/>
                <span>{employee.nome} <small>{employee.status}</small></span>
              </label>
            </li>)}
          </ul>
          {!visible.length && <p>Nenhum funcionário encontrado.</p>}
        </fieldset>
        {error && <div className="notice field-wide" role="alert">{error}</div>}
      </fieldset>
      <div className="form-actions">
        <Button type="button" variant="secondary" disabled={saving} onClick={close}>Cancelar</Button>
        <Button type="submit" disabled={saving || !selectedIds.length || !fieldsSelected.size} icon={<Download size={16}/>}>
          {saving ? 'Gerando…' : 'Gerar relatório'}
        </Button>
      </div>
    </form>
  </Modal>
}
