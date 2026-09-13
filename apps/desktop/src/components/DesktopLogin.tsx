import { FormEvent, useState } from 'react'
import { Button, Card, Field } from './ui'

export function DesktopLogin({ onLinked }: { onLinked: () => void }) {
  const [firstAccess, setFirstAccess] = useState(false)
  const [setup, setSetup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingGoogle, setPendingGoogle] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const result = setup
        ? await window.fluxoDre.online.passwordSetup({ companyName, projectName })
        : await window.fluxoDre.online.passwordAuth({ email, password, code, firstAccess })
      setPassword(''); setCode('')
      if (result.needsSetup) { setSetup(true); setMessage('Seu acesso foi confirmado. Configure sua empresa e primeira obra para continuar.') }
      if (result.linked) onLinked()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível entrar.') }
    finally { setBusy(false) }
  }
  async function google() {
    setBusy(true); setMessage('')
    try {
      if (pendingGoogle) {
        const result = await window.fluxoDre.online.status()
        if (result.linked) onLinked()
        else setMessage('Autorize no navegador e depois verifique novamente.')
      } else {
        await window.fluxoDre.online.start()
        setPendingGoogle(true)
        setMessage('Continue com Google no navegador e volte para verificar a autorização.')
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível autorizar.') }
    finally { setBusy(false) }
  }
  return <Card style={{ width: '100%', maxWidth: 480, margin: '32px auto', padding: 28 }}>
    <small>OBRA NA MÃO · DESKTOP COMERCIAL</small>
    <h1>{setup ? 'Sua empresa' : firstAccess ? 'Primeiro acesso' : 'Entre na sua empresa'}</h1>
    <p>{setup ? 'Os dados ficam vinculados exclusivamente à sua empresa.' : 'Use o mesmo acesso do portal. Você pode ativar sua conta aqui, sem abrir o site.'}</p>
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      {setup ? <>
        <Field label="Nome da empresa" required><input value={companyName} onChange={e => setCompanyName(e.target.value)} autoComplete="organization" required maxLength={160}/></Field>
        <Field label="Primeira obra" required><input value={projectName} onChange={e => setProjectName(e.target.value)} required maxLength={160}/></Field>
      </> : <>
        <Field label="E-mail" required><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required/></Field>
        {firstAccess && <Field label="Código de liberação" required><input value={code} onChange={e => setCode(e.target.value)} autoComplete="off" required/></Field>}
        <Field label={firstAccess ? 'Crie sua senha (mínimo 8 caracteres)' : 'Senha'} required><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={firstAccess ? 'new-password' : 'current-password'} minLength={firstAccess ? 8 : undefined} required/></Field>
      </>}
      {message && <p role="status" style={{ overflowWrap: 'anywhere' }}>{message}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Aguarde...' : setup ? 'Concluir configuração' : firstAccess ? 'Ativar meu acesso' : 'Entrar'}</Button>
      {!setup && <Button type="button" variant="secondary" disabled={busy} onClick={() => { setFirstAccess(!firstAccess); setPassword(''); setCode(''); setMessage('') }}>{firstAccess ? 'Já tenho senha' : 'Tenho um código de liberação'}</Button>}
    </form>
    <Button type="button" variant="ghost" disabled={busy} onClick={google} style={{ marginTop: 16 }}>{pendingGoogle ? 'Verificar autorização Google' : 'Continuar com Google'}</Button>
    {setup && <Button type="button" variant="ghost" disabled={busy} onClick={() => { setSetup(false); setFirstAccess(false); setMessage('') }}>Voltar ao login</Button>}
  </Card>
}
