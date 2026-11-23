import { useEffect, useState } from 'react'
import { Button, Field } from './ui'

type Account = { id: string; email: string | null }
export default function AccountSwitcher() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [current, setCurrent] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const api = (window.fluxoDre as any).accounts
  useEffect(() => { let active = true; api.list().then((value: {current:string;accounts:Account[]}) => { if (active) { setCurrent(value.current); setAccounts(value.accounts) } }).catch((error: Error) => { if (active) setMessage(error.message) }); return () => { active = false } }, [])
  async function add() {
    setBusy(true); setMessage('')
    try { const account:Account = await api.add(email); await api.switch(account.id) }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  async function change(id: string) {
    if (id === current) return
    setBusy(true); setMessage('')
    try { await api.switch(id) }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); setBusy(false) }
  }
  return <section aria-label="Contas deste computador" style={{ display:'grid', gap:10, padding:12, border:'1px solid #d6dce4', borderRadius:10, marginTop:16 }}>
    <strong>Contas neste computador</strong>
    <p style={{margin:0}}>Cada e-mail usa sua própria licença e seus próprios dados neste PC.</p>
    <Field label="Conta"><select value={current} disabled={busy} onChange={event => void change(event.target.value)}>{accounts.map(account => <option key={account.id} value={account.id}>{account.email || 'Conta principal existente'}</option>)}</select></Field>
    <Field label="Adicionar conta licenciada"><input type="email" value={email} disabled={busy} onChange={event => setEmail(event.target.value)} placeholder="email@empresa.com"/></Field>
    <Button type="button" disabled={busy || !email.trim()} onClick={() => void add()}>Adicionar e entrar</Button>
    {message && <p role="alert">{message}</p>}
  </section>
}
