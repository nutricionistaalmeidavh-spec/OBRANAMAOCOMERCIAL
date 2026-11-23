import { FormEvent, useState } from 'react'
import { Button, Card, Field } from './ui'
import AccountSwitcher from './AccountSwitcher'

type AccessMode = 'login'|'company'|'member'

export function DesktopLogin({ onLinked, storageRequired }: { onLinked: () => void; storageRequired?: CompanyStorageRequirement|null }) {
  const [mode, setMode] = useState<AccessMode>('login')
  const [setup, setSetup] = useState(false)
  const [email, setEmail] = useState('')
  const [selectedAccountEmail, setSelectedAccountEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingGoogle, setPendingGoogle] = useState(false)
  const [message, setMessage] = useState('')
  const [storagePending, setStoragePending] = useState<CompanyStorageRequirement|null>(storageRequired || null)
  const [serverAddress, setServerAddress] = useState('')
  const [manualAddress, setManualAddress] = useState(false)
  const [transferPreview, setTransferPreview] = useState<{serverId:string;alreadyLocal:boolean;devices:Array<{id:string;name:string;email?:string}>}|null>(null)
  const [transferConfirmed, setTransferConfirmed] = useState(false)
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
        setManualAddress(false)
        setServerAddress('')
        setMessage(result.message || 'Acesso confirmado. Conecte este computador à mesma rede do computador principal.')
      }
      if (result.linked) onLinked()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível entrar.') }
    finally { setBusy(false) }
  }

  async function completeStorage(addressOverride?:string) {
    setBusy(true); setMessage('')
    try {
      const address=addressOverride!==undefined?addressOverride:serverAddress.trim()
      const result = await window.fluxoDre.online.completeStorage(address)
      if (result.linked) { setStoragePending(null); setManualAddress(false); onLinked(); return }
      setStoragePending(result.storageRequired || storagePending)
      if((result.storageRequired||storagePending)?.mode!=='remote')setManualAddress(true)
      setMessage(result.message || 'O computador principal ainda não foi encontrado.')
    } catch (error) {
      if(storagePending?.mode!=='remote')setManualAddress(true)
      setMessage(error instanceof Error ? error.message : 'Não foi possível conectar ao computador principal.')
    }
    finally { setBusy(false) }
  }

  async function reviewTransfer() {
    setBusy(true); setMessage('')
    try {
      const preview = await window.fluxoDre.online.localTransferPreview()
      setTransferPreview(preview)
      setTransferConfirmed(false)
    } catch (error) {
      setTransferPreview(null)
      setMessage(error instanceof Error ? error.message : 'Não foi possível verificar a transferência.')
    } finally { setBusy(false) }
  }

  async function transferToLocal() {
    if (!transferPreview || !transferConfirmed) return
    setBusy(true); setMessage('')
    try {
      const result = await window.fluxoDre.online.transferToLocal({
        confirmed: true,
        expectedServerId: transferPreview.serverId,
        otherDeviceIds: transferPreview.devices.map(device => device.id)
      })
      if (!result.linked) throw new Error('A alteração não foi confirmada. Verifique os computadores vinculados.')
      setStoragePending(null); setTransferPreview(null); setTransferConfirmed(false); onLinked()
    } catch (error) {
      setTransferPreview(null)
      setTransferConfirmed(false)
      setMessage(error instanceof Error ? error.message : 'Não foi possível transferir o acesso. Tente novamente.')
    } finally { setBusy(false) }
  }

  async function google() {
    setBusy(true); setMessage('')
    try {
      if (pendingGoogle) {
        const result = await window.fluxoDre.online.status()
        if (result.storageRequired) {
          setStoragePending(result.storageRequired)
          setManualAddress(false)
          setServerAddress('')
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
      <p>{remote?'Seu acesso já está autorizado. Informe o endereço HTTPS configurado pelo administrador.':'Seu acesso já está autorizado. Vamos procurar automaticamente o computador principal da empresa nesta rede.'}</p>
      <div style={{ display:'grid', gap:12 }}>
        <p><strong>Fonte da empresa:</strong> {remote?'servidor remoto autorizado':'computador principal da empresa'}</p>
        {remote ? <>
          <Field label="Endereço HTTPS do servidor">
            <input value={serverAddress} onChange={event=>setServerAddress(event.target.value)} placeholder="https://servidor.empresa.com" required/>
          </Field>
          {message && <p role="status" style={{ overflowWrap:'anywhere' }}>{message}</p>}
          <Button type="button" disabled={busy||!serverAddress.trim()} onClick={()=>void completeStorage()}>{busy ? 'Conectando...' : 'Conectar ao servidor'}</Button>
        </> : <>
          {message && <p role="status" style={{ overflowWrap:'anywhere' }}>{message}</p>}
          <Button type="button" disabled={busy} onClick={()=>void completeStorage('')}>{busy ? 'Procurando...' : 'Encontrar computador principal'}</Button>
          {!manualAddress && <Button type="button" variant="ghost" disabled={busy} onClick={()=>setManualAddress(true)}>Não encontrou o computador principal? Informar endereço manualmente</Button>}
          {manualAddress && <div style={{ display:'grid', gap:10 }}>
            <Field label="Endereço do computador principal">
              <input value={serverAddress} onChange={event=>setServerAddress(event.target.value)} placeholder="http://192.168.1.10:4732"/>
            </Field>
            <small>Use esta opção somente como recuperação. O endereço só será aceito se pertencer ao servidor já vinculado à empresa.</small>
            <Button type="button" variant="secondary" disabled={busy||!serverAddress.trim()} onClick={()=>void completeStorage()}>{busy ? 'Verificando...' : 'Verificar endereço'}</Button>
          </div>}
        </>}
        {!remote && <div style={{ display:'grid', gap:10, borderTop:'1px solid #d6dce4', paddingTop:16 }}>
          <strong>Este computador será usado sozinho?</strong>
          <p style={{ margin:0 }}>Se você não utiliza mais o computador principal antigo, o administrador pode transferir o uso da empresa para este PC, sem precisar conectar à rede anterior.</p>
          {!transferPreview
            ? <Button type="button" variant="secondary" disabled={busy} onClick={()=>void reviewTransfer()}>
                {busy ? 'Verificando...' : 'Transferir o uso para este computador'}
              </Button>
            : <div style={{ display:'grid', gap:10 }}>
                {transferPreview.alreadyLocal
                  ? <p>A empresa já foi alterada para uso individual. Conclua a configuração local deste computador.</p>
                  : <p>Ao confirmar, os seguintes computadores perderão o acesso Desktop desta empresa: <strong>{transferPreview.devices.length || 'nenhum outro computador'}</strong>.</p>}
                {transferPreview.devices.map(device => <div key={device.id} style={{ padding:10, background:'rgba(140,140,140,.08)', borderRadius:8 }}>
                  <strong>{device.name}</strong>{device.email ? <small style={{ display:'block' }}>{device.email}</small> : null}
                </div>)}
                <p style={{ margin:0 }}><strong>Importante:</strong> os dados do computador/servidor antigo não são transferidos automaticamente. Eles permanecem na origem. Faça um backup no computador anterior e restaure-o aqui se precisar continuar com aqueles registros. Não haverá cópia silenciosa nem mistura de bancos.</p>
                <label style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                  <input type="checkbox" checked={transferConfirmed} onChange={event=>setTransferConfirmed(event.target.checked)}/>
                  <span>Confirmo que autorizo a transferência e entendo que os dados antigos precisam de backup e restauração separados.</span>
                </label>
                <Button type="button" disabled={busy||!transferConfirmed} onClick={()=>void transferToLocal()}>
                  {busy ? 'Transferindo...' : 'Confirmar e usar somente este computador'}
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={()=>{setTransferPreview(null);setTransferConfirmed(false)}}>Cancelar transferência</Button>
              </div>}
        </div>}
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
    <AccountSwitcher onSelectedEmail={selected => { setSelectedAccountEmail(selected || ''); setEmail(selected || '') }}/>
    <p>{description}</p>
    <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
      {setup ? <>
        <Field label="Nome da empresa" required><input value={companyName} onChange={e => setCompanyName(e.target.value)} autoComplete="organization" required maxLength={160}/></Field>
        <Field label="Primeira obra" required><input value={projectName} onChange={e => setProjectName(e.target.value)} required maxLength={160}/></Field>
      </> : <>
        {!selectedAccountEmail && <Field label="E-mail" required><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required/></Field>}
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
