import { Download, RefreshCw, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Card } from './ui'

type UpdaterState = {
  status: 'idle'|'checking'|'current'|'available'|'downloading'|'downloaded'|'error'|'unsupported'
  currentVersion: string
  availableVersion: string | null
  progress: number | null
  error: string | null
  supported: boolean
}

export default function UpdaterSettingsCard() {
  const [state, setState] = useState<UpdaterState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    window.fluxoDre.updater.state().then(value => { if (active) setState(value) }).catch(reason => { if (active) setError(reason.message) })
    const unsubscribe = window.fluxoDre.updater.onStateChanged(value => { if (active) setState(value) })
    return () => { active = false; unsubscribe() }
  }, [])

  const run = async (action: () => Promise<UpdaterState | boolean>) => {
    setBusy(true); setError('')
    try {
      const result = await action()
      if (result && typeof result === 'object') setState(result)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }

  const text = state?.status === 'checking' ? 'Verificando nova versão...'
    : state?.status === 'current' ? 'Você está usando a versão mais recente.'
    : state?.status === 'available' ? `Versão ${state.availableVersion} disponível para download.`
    : state?.status === 'downloading' ? `Baixando atualização${state.progress !== null ? ` — ${state.progress}%` : '...'}`
    : state?.status === 'downloaded' ? `Versão ${state.availableVersion} pronta para instalar.`
    : state?.status === 'error' ? 'Não foi possível verificar atualizações.'
    : state?.status === 'unsupported' ? 'A atualização automática é ativada no aplicativo Windows instalado.'
    : 'O aplicativo verifica novas versões automaticamente ao iniciar.'

  return <Card className="setting-card setting-card-feature" id="desktop-updater-settings">
    <RefreshCw size={21}/><h3>Atualizações do aplicativo</h3>
    <p>{text}</p>
    <small>Versão instalada: {state?.currentVersion || 'carregando...'}</small>
    {state?.status === 'downloading' && <progress max={100} value={state.progress || 0} style={{ width:'100%', marginTop:10 }}/>} 
    {(error || state?.error) && <p role="alert" className="error-box">{error || state?.error}</p>}
    <div className="setting-actions" style={{marginTop:10}}>
      <Button variant="secondary" icon={<RefreshCw size={15}/>} disabled={busy || !state?.supported || state?.status === 'checking' || state?.status === 'downloading'} onClick={() => run(() => window.fluxoDre.updater.check())}>Verificar atualização</Button>
      {state?.status === 'available' && <Button icon={<Download size={15}/>} disabled={busy} onClick={() => run(() => window.fluxoDre.updater.download())}>Baixar atualização</Button>}
      {state?.status === 'downloaded' && <Button icon={<RotateCcw size={15}/>} disabled={busy} onClick={() => run(() => window.fluxoDre.updater.install())}>Reiniciar e instalar</Button>}
    </div>
  </Card>
}
