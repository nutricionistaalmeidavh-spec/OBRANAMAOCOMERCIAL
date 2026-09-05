import { statusTone } from '../utils/ux'
import { AlertTriangle, Check, ChevronDown, FileQuestion, LoaderCircle, Search, X } from 'lucide-react'
import { FormEvent, ReactNode, useEffect, useRef } from 'react'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1>{description && <p>{description}</p>}</div><div className="header-actions">{actions}</div></header>
}

export function Card({ children, className = '', ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`} {...props}>{children}</section>
}

export function Kpi({ label, value, tone = 'default', hint, icon }: { label: string; value: string; tone?: string; hint?: string; icon?: ReactNode }) {
  return <Card className={`kpi kpi-${tone}`}><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div></Card>
}

export function Button({ children, variant = 'primary', icon, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'danger'|'ghost'; icon?: ReactNode }) {
  return <button className={`button button-${variant}`} {...props}>{icon}{children}</button>
}

export function Loading({ label = 'Carregando dados...' }: { label?: string }) { return <div className="state"><LoaderCircle className="spin"/><p>{label}</p></div> }
export function Empty({ title = 'Nenhum registro encontrado', description = 'Adicione o primeiro item para começar.', action }: { title?: string; description?: string; action?: ReactNode }) { return <div className="state"><FileQuestion/><strong>{title}</strong><p>{description}</p>{action}</div> }
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) { return <div className="state error-state"><AlertTriangle/><strong>Não foi possível carregar</strong><p>{error.message}</p>{retry && <Button onClick={retry}>Tentar novamente</Button>}<details><summary>Detalhes técnicos</summary>{(error as any).details || error.stack}</details></div> }

export function SearchInput({ value, onChange, placeholder = 'Buscar...' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search"><Search size={17}/><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/></label>
}

export function Field({ label, children, required = false, wide = false, hint }: { label: string; children: ReactNode; required?: boolean; wide?: boolean; hint?: string }) {
  return <label className={`field ${wide ? 'field-wide' : ''}`}><span>{label}{required && ' *'}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function Modal({ open, title, children, onClose, size = 'md' }: { open: boolean; title: string; children: ReactNode; onClose: () => void; size?: 'sm'|'md'|'lg'|'xl' }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open || !ref.current) return
    const dialog = ref.current
    const origin = document.activeElement as HTMLElement | null
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')).filter(el => !el.hidden && el.getAttribute('aria-hidden') !== 'true' && el.getClientRects().length > 0)
    const topmost = () => Array.from(document.querySelectorAll('[aria-modal="true"]')).at(-1) === dialog
    const keydown = (event: KeyboardEvent) => {
      if (!topmost()) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); return }
      if (event.key !== 'Tab') return
      const items = focusable(), first = items[0], last = items.at(-1)
      if (!first) { event.preventDefault(); dialog.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    const containFocus = (event: FocusEvent) => { if (topmost() && !dialog.contains(event.target as Node)) (focusable()[0] || dialog).focus() }
    const timer = window.setTimeout(() => (focusable()[0] || dialog).focus(), 0)
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', containFocus)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', keydown, true)
      document.removeEventListener('focusin', containFocus)
      if (origin?.isConnected) origin.focus()
    }
  }, [open])
  if (!open) return null
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div ref={ref} tabIndex={-1} className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19}/></button></div>
      {children}
    </div>
  </div>
}

export function FormActions({ onCancel, submitLabel = 'Salvar', loading = false }: { onCancel: () => void; submitLabel?: string; loading?: boolean }) {
  return <div className="form-actions"><Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={loading} icon={loading ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>}>{submitLabel}</Button></div>
}

export function Confirm({ open, title, description, onCancel, onConfirm, danger = false }: { open: boolean; title: string; description: string; onCancel: () => void; onConfirm: () => void; danger?: boolean }) {
  return <Modal open={open} title={title} onClose={onCancel} size="sm"><div className="modal-body"><p>{description}</p></div><div className="form-actions"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button variant={danger?'danger':'primary'} onClick={onConfirm}>Confirmar</Button></div></Modal>
}

export function Segmented({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  return <div className="segmented">{options.map((option) => <button key={option.value} className={value === option.value ? 'active' : ''} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>
}

export function Status({ value }: { value: string }) {
  const tone = statusTone(value)
  return <span className={`status status-${tone}`}>{String(value || '—').replaceAll('_',' ')}</span>
}

export function SelectChevron() { return <ChevronDown size={15}/> }
