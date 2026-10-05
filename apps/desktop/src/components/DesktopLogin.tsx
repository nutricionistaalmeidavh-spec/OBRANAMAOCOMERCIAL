import { FormEvent, useState } from 'react'
import { Button, Card, Field } from './ui'

type AccessMode = 'login'|'company'|'member'

export function DesktopLogin({ onLinked, storageRequired }: { onLinked: () => void; storageRequired?: CompanyStorageRequirement|null }) {
  const [mode, setMode] = useState<AccessMode>('login')
  const [setup, setSetup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingGoogle, setPendingGoogle] = useState(false)
  const [message, setMessage] = useState('')
  const [storagePending, setStoragePending] = useState<CompanyStorageRequirement|null>(storageRequired || null)
  const [serverAddress, setServerAddress] = useState('')
  const firstAccess = mode !== 'login'

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const result = setup
        ? await window.fluxoDre.online.passwordSetup({ companyName, projectName })
        : await window.fluxoDre.online.passwordAuth({
            email, password, code, firstAccess,
            accessPurpose: mode === 'company' ? 'company-activation' : mode === 'member' ? 'member-invitation' : undefined
          })
      setPassword(''); setCode('')
      if (result.needsSetup) {
        setSetup(true)
        setMessage('Sua ativação foi confirmada. Configure sua empresa e a primeira obra para continuar.')
      }
      if (result.storageRequired) {
        setStoragePending(result.storageRequired)
        setMessage(result.message || 'Acesso confirmado. Conecte este computador à mesma rede do computador principal.')
      }
      if (result.linked) onLinked()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível entrar.') }
    finally { setBusy(false) }
  }

  async function completeStorage() {
    setBusy(true); setMessage('')
    try {
      const result = await window.fluxoDre.online.completeStorage(serverAddress.trim())
      if (result.linked) { setStoragePending(null); onLinked(); return }
      setStoragePending(result.storageRequired || storagePending)
      setMessage(result.message || 'O computador principal ainda não foi encontrado.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível conectar ao computador principal.') }
    finally { setBusy(false) }
  }

  async function google() {
    setBusy(true); setMessage('')
    try {
      if (pendingGoogle) {
        const result = await window.fluxoDre.online.status()
        if (result.storageRequired) {
          setStoragePending(result.storageRequired)
          setMessage(result.message || 'Conta autorizada. Agora conecte este computador à rede da empresa.')
        } else if (result.linked) onLinked()
        else setMessage('Autorize no navegador e depois verifique novamente.')
      } else {
        await window.fluxoDre.online.start()
        setPendingGoogle(true)
        setMessage('Continue com Google no navegador e volte para verificar a autorização.')
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível autorizar.') }
    finally { setBusy(false) }
  }

  if (storagePending) {
    const remote=storagePending.mode==='remote'
    return <Card style={{ width: '100%', maxWidth: 480, margin: '32px auto', padding: 28 }}>
      <small>OBRA NA MÃO · DESKTOP COMERCIAL</small>
      <h1>{remote?'Conectar ao servidor da empresa':'Conectar ao computador principal'}</h1>
      <p>{remote?'Seu acesso já está autorizado. Informe o endereço HTTPS configurado pelo administrador.':'Seu acesso já está autorizado. Este computador deve usar a mesma fonte de dados do computador principal.'}</p>
      <div style={{ display:'grid', gap:12 }}>
        <p><strong>Fonte da empresa:</strong> {remote?'servidor remoto autorizado':'servidor local'}</p>
        <Field label={remote?'Endereço HTTPS do servidor':'Endereço do servidor (opcional)'}>
          <input value={serverAddress} onChange={event=>setServerAddress(event.target.value)} placeholder={remote?'https://servidor.empresa.com':'http://192.168.1.10:4732'} required={remote}/>
        </Field>
        {!remote && <small>Deixe em branco para localizar automaticamente na rede. Se informar um endereço, ele só será aceito se pertencer ao servidor já vinculado à empresa.</small>}
        {message && <p role="status" style={{ overflowWrap:'anywhere' }}>{message}</p>}
        <Button type="button" disabled={busy||remote&&!serverAddress.trim()} onClick={completeStorage}>{busy ? 'Conectando...' : serverAddress.trim()?'Conectar a este servidor':'Encontrar e conectar automaticamente'}</Button>
      </div>
    </Card>
  }

  const title = setup ? 'Sua empresa' : mode === 'company' ? 'Ativar uma nova empresa' : mode === 'member' ? 'Entrar em uma empresa existente' : 'Entre na sua empresa'
  const description = setup
    ? 'Os dados ficam vinculados exclusivamente à sua empresa.'
    : mode === 'company'
      ? 'Use o código de ativação recebido na compra. Este código é exclusivo para ativar a empresa.'
      : mode === 'member'
        ? 'Use o convite gerado pelo administrador da empresa. Ele não ativa uma nova licença.'
        : 'Entre com seu acesso existente ou escolha abaixo como será seu primeiro acesso.'

  return <Card style={{ width: '100%', maxWidth: 480, margin: '32px auto', padding: 28 }}>
    <small>OBRA NA MÃO · DESKTOP COMERCIAL</small>
    <h1>{title}</h1>
    <p>{description}</p>
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      {setup ? <>
        <Field label="Nome da empresa" required><input value={companyName} onChange={e => setCompanyName(e.target.value)} autoComplete="organization" required maxLength={160}/></Field>
        <Field label="Primeira obra" required><input value={projectName} onChange={e => setProjectName(e.target.value)} required maxLength={160}/></Field>
      </> : <>
        <Field label="E-mail" required><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required/></Field>
        {firstAccess && <Field label={mode === 'company' ? 'Código de ativação da empresa' : 'Código de convite'} required><input value={code} onChange={e => setCode(e.target.value)} autoComplete="off" required/></Field>}
        <Field label={firstAccess ? 'Crie sua senha (mínimo 8 caracteres)' : 'Senha'} required><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={firstAccess ? 'new-password' : 'current-password'} minLength={firstAccess ? 8 : undefined} required/></Field>
      </>}
      {message && <p role="status" style={{ overflowWrap: 'anywhere' }}>{message}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Aguarde...' : setup ? 'Concluir configuração' : mode === 'company' ? 'Ativar minha empresa' : mode === 'member' ? 'Ativar meu acesso' : 'Entrar'}</Button>
      {!setup && mode === 'login' && <>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => { setMode('company'); setPassword(''); setCode(''); setMessage('') }}>Ativar uma nova empresa</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => { setMode('member'); setPassword(''); setCode(''); setMessage('') }}>Recebi um convite de uma empresa</Button>
      </>}
      {!setup && mode !== 'login' && <Button type="button" variant="secondary" disabled={busy} onClick={() => { setMode('login'); setPassword(''); setCode(''); setMessage('') }}>Já tenho acesso</Button>}
    </form>
    {!setup && mode === 'login' && <Button type="button" variant="ghost" disabled={busy} onClick={google} style={{ marginTop: 16 }}>{pendingGoogle ? 'Verificar autorização Google' : 'Continuar com Google'}</Button>}
    {setup && <Button type="button" variant="ghost" disabled={busy} onClick={() => { setSetup(false); setMode('login'); setMessage('') }}>Voltar ao login</Button>}
  </Card>
}
