import { AlertTriangle, CheckCircle2, ChevronDown, Circle, LoaderCircle, RefreshCw, RotateCcw, Server, ShieldCheck, Unplug } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { Button, Card, Confirm, Field, Status } from './ui'

type Props={onMessage:(message:string)=>void}
type Mode='local'|'lan-host'|'lan-client'|'remote'
type Form={operationalMode:Mode;host:string;port:string}
type ModuleKey='core'|'operation'|'planning'|'finance'|'rh'
type SetupStage='idle'|'saving'|'checking'|'authorizing'|'migrating'|'waiting'|'ready'|'error'
type SetupProgress={stage:SetupStage;completed:number;total:number;current?:ModuleKey;message:string;error?:string}

const MODULE_ORDER:ModuleKey[]=['core','operation','planning','finance','rh']
const MODULE_LABELS:Record<ModuleKey,string>={core:'Cadastros-base',operation:'RDO / operação',planning:'Planejamento',finance:'Financeiro',rh:'RH'}
const STATE_LABELS:Record<string,string>={
  local:'Local',
  'migration-required':'Aguardando migração',
  'central-ready':'Preparando',
  'central-active':'No servidor'
}

export default function StorageServerSettings({onMessage}:Props){
  const storage=useAsync(()=>window.fluxoDre.storage.state(),[])
  const online=useAsync(()=>window.fluxoDre.online.state(),[])
  const storageApi=window.fluxoDre.storage
  const [modules,setModules]=useState<Record<ModuleKey,any>>({core:null,operation:null,planning:null,finance:null,rh:null})
  const [attempts,setAttempts]=useState<Record<ModuleKey,any>>({core:null,operation:null,planning:null,finance:null,rh:null})
  const [form,setForm]=useState<Form>({operationalMode:'local',host:'127.0.0.1',port:'4732'})
  const [lanStatus,setLanStatus]=useState<any>(null)
  const [hostState,setHostState]=useState<any>(null)
  const [adminStatus,setAdminStatus]=useState<any>(null)
  const [devices,setDevices]=useState<any[]>([])
  const [setupCode,setSetupCode]=useState('')
  const [pairCode,setPairCode]=useState('')
  const [pairTarget,setPairTarget]=useState('')
  const [pairInvite,setPairInvite]=useState<any>(null)
  const [startAtLogin,setStartAtLogin]=useState(false)
  const [busy,setBusy]=useState(false)
  const [rollbackTarget,setRollbackTarget]=useState<ModuleKey|null>(null)
  const [progress,setProgress]=useState<SetupProgress>({stage:'idle',completed:0,total:MODULE_ORDER.length,message:''})

  useEffect(()=>{if(storage.data)setForm({operationalMode:storage.data.operationalMode,host:storage.data.host,port:String(storage.data.port)})},[storage.data?.operationalMode,storage.data?.host,storage.data?.port])

  const refreshModuleState=async()=>{
    const keys=MODULE_ORDER
    let states:Record<ModuleKey,any>
    try{
      states=await storageApi.refreshModuleCapabilities() as Record<ModuleKey,any>
    }catch{
      const values=await Promise.all(keys.map(async key=>[key,await storageApi.moduleState(key)] as const))
      states=Object.fromEntries(values) as Record<ModuleKey,any>
    }
    setModules(current=>({...current,...states}))
    const statuses=await Promise.all(keys.map(async key=>{
      try{return [key,(await storageApi.migrationStatus(key)).attempt] as const}catch{return [key,null] as const}
    }))
    setAttempts(Object.fromEntries(statuses) as Record<ModuleKey,any>)
    return states
  }

  const readLanState=async(mode:Mode=form.operationalMode)=>{
    if(mode==='local'){
      setLanStatus(null);setHostState(null);setAdminStatus(null);setDevices([])
      await refreshModuleState()
      return null
    }
    if(mode==='lan-host'){
      const [host,login]=await Promise.all([window.fluxoDre.lan.hostState(),window.fluxoDre.lan.startAtLoginState()])
      setHostState(host);setStartAtLogin(login.enabled)
    }else setHostState(null)
    const status=await window.fluxoDre.lan.status()
    setLanStatus(status)
    if(status?.credential?.paired&&status?.credential?.member?.role==='admin'){
      const [admin,deviceList]=await Promise.all([window.fluxoDre.lan.adminStatus(),window.fluxoDre.lan.listDevices()])
      setAdminStatus(admin);setDevices(deviceList)
    }else{
      setAdminStatus(null);setDevices([])
    }
    await refreshModuleState()
    return status
  }

  useEffect(()=>{
    if(!storage.data)return
    void readLanState(storage.data.operationalMode as Mode).catch(error=>onMessage(error instanceof Error?error.message:String(error)))
  },[storage.data?.operationalMode,storage.data?.baseUrl])

  const effectiveHost=form.operationalMode==='lan-host'?'127.0.0.1':form.host
  const dirty=!!storage.data&&(form.operationalMode!==storage.data.operationalMode||effectiveHost!==storage.data.host||form.port!==String(storage.data.port))
  const isServerMode=form.operationalMode!=='local'
  const paired=!!lanStatus?.credential?.paired
  const isAdmin=lanStatus?.credential?.member?.role==='admin'
  const allCentral=useMemo(()=>MODULE_ORDER.every(module=>modules[module]?.state==='central-active'),[modules])
  const setupReady=isServerMode&&paired&&allCentral
  const progressValue=progress.stage==='ready'||setupReady?100:Math.round((progress.completed/Math.max(1,progress.total))*100)

  useEffect(()=>{
    if(setupReady&&progress.stage!=='migrating'&&progress.stage!=='saving'&&progress.stage!=='checking'&&progress.stage!=='authorizing'){
      setProgress({stage:'ready',completed:MODULE_ORDER.length,total:MODULE_ORDER.length,message:'Dados centralizados e servidor pronto para uso.'})
    }
  },[setupReady])

  const changeMode=(mode:Mode)=>{
    setForm(current=>({...current,operationalMode:mode,host:mode==='lan-host'||mode==='local'?'127.0.0.1':(current.host==='127.0.0.1'?'':current.host)}))
    setProgress({stage:'idle',completed:0,total:MODULE_ORDER.length,message:''})
  }

  const centralizeAll=async()=>{
    setProgress({stage:'migrating',completed:0,total:MODULE_ORDER.length,current:'core',message:'Preparando a migração segura dos dados...'})
    let states=await refreshModuleState()
    let completed=0

    for(const module of MODULE_ORDER){
      let state=states[module]
      if(state?.state==='central-active'){
        completed+=1
        setProgress({stage:'migrating',completed,total:MODULE_ORDER.length,current:module,message:`${MODULE_LABELS[module]} já está no servidor.`})
        continue
      }

      setProgress({stage:'migrating',completed,total:MODULE_ORDER.length,current:module,message:`Migrando ${MODULE_LABELS[module]}...`})

      if(state?.state==='migration-required'){
        const preflight=await storageApi.migrationPreflight(module)
        if(!preflight?.canMigrate){
          const blocked=preflight?.dependencies?.blockedBy as ModuleKey|undefined
          throw new Error(blocked?`${MODULE_LABELS[module]} aguarda ${MODULE_LABELS[blocked]}.`:`${MODULE_LABELS[module]} não passou na validação de migração.`)
        }
        await storageApi.migrateModule(module)
      }

      states=await refreshModuleState()
      state=states[module]
      if(state?.state!=='central-active'){
        if(state?.state==='central-ready')throw new Error(`${MODULE_LABELS[module]} ainda não foi disponibilizado pelo servidor.`)
        throw new Error(`${MODULE_LABELS[module]} não concluiu a transição para o servidor.`)
      }

      completed+=1
      setProgress({stage:'migrating',completed,total:MODULE_ORDER.length,current:module,message:`${MODULE_LABELS[module]} concluído.`})
    }

    setProgress({stage:'ready',completed:MODULE_ORDER.length,total:MODULE_ORDER.length,message:'Servidor configurado. Todos os dados centralizáveis estão ativos no servidor.'})
    onMessage('Servidor configurado e dados centralizados com sucesso.')
  }

  const configureAndFinish=async()=>{
    setBusy(true)
    setProgress({stage:'saving',completed:0,total:MODULE_ORDER.length,message:isServerMode?'Preparando a fonte de dados...':'Salvando configuração local...'})
    try{
      const saved=await window.fluxoDre.storage.configure({operationalMode:form.operationalMode,host:effectiveHost,port:Number(form.port)})
      storage.setData(saved)

      if(saved.operationalMode==='local'){
        await refreshModuleState()
        setProgress({stage:'idle',completed:0,total:MODULE_ORDER.length,message:''})
        onMessage('Dados configurados para permanecer somente neste computador.')
        return
      }

      setProgress({stage:'checking',completed:0,total:MODULE_ORDER.length,message:'Verificando o servidor...'})
      await window.fluxoDre.storage.testConnection()
      let status=await readLanState(saved.operationalMode as Mode)

      if(!status?.claimed){
        const onlineState=await window.fluxoDre.online.state()
        online.setData(onlineState)
        if(!onlineState?.linked){
          setProgress({stage:'waiting',completed:0,total:MODULE_ORDER.length,message:'Vincule este Desktop ao Obra na Mão online para autorizar o servidor.'})
          onMessage('Servidor preparado. Falta vincular este Desktop ao Obra na Mão online para concluir.')
          return
        }
        if(saved.operationalMode==='lan-client'&&!setupCode.trim()){
          setProgress({stage:'waiting',completed:0,total:MODULE_ORDER.length,message:'Informe o código de configuração exibido no servidor para continuar.'})
          return
        }
        setProgress({stage:'authorizing',completed:0,total:MODULE_ORDER.length,message:'Autorizando o servidor com sua conta Admin...'})
        await window.fluxoDre.lan.claimHost(saved.operationalMode==='lan-host'?undefined:setupCode.trim())
        setSetupCode('')
        status=await readLanState(saved.operationalMode as Mode)
      }

      if(!status?.credential?.paired){
        if(!pairCode.trim()){
          setProgress({stage:'waiting',completed:0,total:MODULE_ORDER.length,message:'Este servidor já está configurado. Informe um código de pareamento para autorizar este computador.'})
          return
        }
        setProgress({stage:'authorizing',completed:0,total:MODULE_ORDER.length,message:'Pareando este computador...'})
        await window.fluxoDre.lan.pair(pairCode.trim())
        setPairCode('')
        status=await readLanState(saved.operationalMode as Mode)
      }

      if(status?.credential?.member?.role!=='admin'){
        setProgress({stage:'waiting',completed:0,total:MODULE_ORDER.length,message:'Servidor conectado. Um usuário Admin precisa concluir a migração inicial dos dados.'})
        return
      }

      await centralizeAll()
      await readLanState(saved.operationalMode as Mode)
    }catch(error:any){
      const message=error instanceof Error?error.message:String(error)
      setProgress(current=>({...current,stage:'error',message:'A configuração não foi concluída.',error:message}))
      onMessage(`Configuração não concluída: ${message}`)
      await refreshModuleState().catch(()=>{})
    }finally{
      setBusy(false)
    }
  }

  const test=async()=>{
    setBusy(true);onMessage('Testando servidor Obra na Mão...')
    try{
      const result=await window.fluxoDre.storage.testConnection()
      onMessage(`Servidor encontrado — ${result.baseUrl} (${result.latencyMs} ms).`)
      await readLanState()
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const disconnect=async()=>{
    setBusy(true)
    try{
      await window.fluxoDre.lan.disconnect()
      onMessage('Pareamento removido deste computador. A conta Web/PWA não foi alterada.')
      await readLanState()
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const createPairing=async()=>{
    setBusy(true)
    try{
      const invite=await window.fluxoDre.lan.createPairing(pairTarget.trim())
      setPairInvite(invite);setPairTarget('')
      onMessage('Código temporário criado.')
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const toggleDevice=async(device:any)=>{
    setBusy(true)
    try{
      await window.fluxoDre.lan.setDeviceStatus(device.id,device.status==='active'?'revoked':'active')
      onMessage(device.status==='active'?'Computador revogado.':'Computador reativado.')
      await readLanState()
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const refreshIdentity=async()=>{
    setBusy(true)
    try{
      await window.fluxoDre.lan.refreshIdentity()
      onMessage('Usuários e permissões atualizados a partir do Obra na Mão Cloud.')
      await readLanState()
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const toggleStartAtLogin=async(enabled:boolean)=>{
    try{
      const state=await window.fluxoDre.lan.setStartAtLogin(enabled)
      setStartAtLogin(state.enabled)
      onMessage(state.enabled?'Obra na Mão configurado para iniciar com o Windows.':'Inicialização automática desativada.')
    }catch(error:any){onMessage(error.message)}
  }

  const confirmRollback=async()=>{
    const module=rollbackTarget
    if(!module)return
    setRollbackTarget(null);setBusy(true)
    try{
      const result=await storageApi.rollbackModuleMigration(module)
      onMessage(result.status==='rolled_back'?`Tentativa de ${MODULE_LABELS[module]} revertida. Os dados locais permanecem intactos.`:`Estado da tentativa: ${result.status}.`)
      await refreshModuleState()
    }catch(error:any){onMessage(`Rollback não concluído: ${error.message}`)}finally{setBusy(false)}
  }

  const statusIcon=progress.stage==='ready'||setupReady?<CheckCircle2 size={18}/>:progress.stage==='error'?<AlertTriangle size={18}/>:busy?<LoaderCircle size={18} className="spin"/>:<Circle size={16}/>
  const statusTitle=form.operationalMode==='local'
    ?'Dados neste computador'
    :setupReady
      ?'Servidor pronto'
      :progress.stage==='error'
        ?'Configuração interrompida'
        :busy
          ?'Configurando servidor'
          :progress.stage==='waiting'
            ?'Falta uma etapa'
            :'Servidor ainda não concluído'

  return <>
    <Card className="setting-card setting-card-feature storage-setup-card">
      <div className="storage-setup-head">
        <div className="storage-setup-title"><span className="storage-setup-icon"><Server size={20}/></span><div><h3>Dados e servidor</h3><p>Escolha a fonte dos dados. Ao configurar um servidor, o Obra na Mão faz backup, migra e valida tudo na ordem segura.</p></div></div>
        <span className={`storage-overall-status ${setupReady?'is-ready':progress.stage==='error'?'is-error':''}`}>{statusIcon}{statusTitle}</span>
      </div>

      <div className="storage-setup-body">
        <div className="storage-setup-controls">
          <Field label="Onde os dados operacionais ficarão?">
            <select value={form.operationalMode} disabled={storage.loading||busy} onChange={event=>changeMode(event.target.value as Mode)}>
              <option value="local">Somente neste computador</option>
              <option value="lan-host">Este computador é o principal / servidor local</option>
              <option value="lan-client">Conectar a um servidor da empresa</option>
              {form.operationalMode==='remote'&&<option value="remote" disabled>Servidor remoto próprio — etapa futura</option>}
            </select>
          </Field>

          {isServerMode&&<div className="storage-network-fields">
            {form.operationalMode==='lan-client'&&<Field label="Endereço do servidor"><input value={form.host} onChange={event=>setForm({...form,host:event.target.value})} placeholder="192.168.0.10"/></Field>}
            <Field label="Porta"><input type="number" min="1" max="65535" value={form.port} onChange={event=>setForm({...form,port:event.target.value})}/></Field>
          </div>}

          {isServerMode&&!dirty&&lanStatus&&!lanStatus.claimed&&form.operationalMode==='lan-client'&&
            <Field label="Código de configuração do servidor"><input value={setupCode} onChange={event=>setSetupCode(event.target.value.toUpperCase())} placeholder="XXXXX-XXXXX"/></Field>}

          {isServerMode&&!dirty&&lanStatus?.claimed&&!paired&&
            <Field label="Código de pareamento"><input value={pairCode} onChange={event=>setPairCode(event.target.value.toUpperCase())} placeholder="Código fornecido pelo Administrador"/></Field>}

          <div className="storage-primary-actions">
            <Button disabled={busy||storage.loading} onClick={configureAndFinish}>
              {form.operationalMode==='local'?'Salvar configuração':setupReady&&!dirty?'Verificar configuração':progress.stage==='error'?'Tentar novamente':'Configurar servidor e migrar dados'}
            </Button>
            {isServerMode&&!dirty&&<Button variant="secondary" icon={<RefreshCw size={15}/>} disabled={busy} onClick={test}>Testar servidor</Button>}
          </div>

          <p className="storage-cloud-note"><strong>Web/PWA continua incluído.</strong> A fonte operacional muda, mas login, PWA e sincronização online continuam independentes desta configuração.</p>
        </div>

        <div className={`storage-progress-panel ${setupReady?'is-ready':''} ${progress.stage==='error'?'is-error':''}`} aria-live="polite">
          <div className="storage-progress-copy">
            <span>{statusIcon}</span>
            <div><strong>{statusTitle}</strong><p>{progress.message||(
              form.operationalMode==='local'
                ?'O aplicativo usa o SQLite deste computador.'
                :'Salve a configuração para preparar o servidor e centralizar os dados.'
            )}</p></div>
          </div>

          {isServerMode&&<>
            <progress className="storage-progress-bar" value={progressValue} max="100" aria-label="Progresso da configuração do servidor">{progressValue}%</progress>
            <div className="storage-progress-meta"><span>{setupReady?'5 de 5 etapas concluídas':progress.stage==='migrating'?`${progress.completed} de ${progress.total} etapas concluídas`:'Aguardando conclusão'}</span><span>{progressValue}%</span></div>
          </>}

          {progress.stage==='error'&&<div className="storage-error-summary"><strong>Ação necessária</strong><p>{progress.error}</p><Button variant="secondary" onClick={configureAndFinish} disabled={busy}>Tentar novamente</Button></div>}

          {progress.stage==='waiting'&&!online.data?.linked&&<div className="storage-waiting-note"><strong>Conexão online necessária</strong><p>Vincule este Desktop em “Conexão Obra na Mão” e volte aqui para concluir.</p></div>}
          {setupReady&&<div className="storage-ready-note"><ShieldCheck size={17}/><span><strong>Dados centralizados.</strong> Os computadores autorizados usam a mesma fonte operacional.</span></div>}
        </div>
      </div>

      <details className="storage-tech-details">
        <summary><span>Detalhes técnicos</span><ChevronDown size={16}/></summary>
        <div className="storage-tech-content">
          <div className="storage-module-list">
            {MODULE_ORDER.map(module=>{
              const state=modules[module]
              const attempt=attempts[module]
              return <div className="storage-module-row" key={module}>
                <div><strong>{MODULE_LABELS[module]}</strong><small>{state?.localRecords!=null?`${state.localRecords} registro(s) local(is)`:'Estado ainda não carregado'}</small></div>
                <div className="storage-module-state"><Status value={STATE_LABELS[state?.state]||state?.state||'—'}/>{attempt&&<small>Tentativa {attempt.migrationId}</small>}</div>
                {attempt&&<Button variant="ghost" disabled={busy} icon={<RotateCcw size={14}/>} onClick={()=>setRollbackTarget(module)}>Reverter tentativa</Button>}
              </div>
            })}
          </div>

          {isServerMode&&!dirty&&<div className="storage-server-facts">
            <span>Servidor <strong>{lanStatus?.serverId||'—'}</strong></span>
            <span>Endereço <strong>{effectiveHost}:{form.port}</strong></span>
            {form.operationalMode==='lan-host'&&<span>Processo <strong>{hostState?.running?'ativo':'inativo'}</strong></span>}
            <span>Este PC <strong>{paired?'pareado':'não pareado'}</strong></span>
            {paired&&<span>Perfil <strong>{lanStatus?.credential?.member?.role||'—'}</strong></span>}
          </div>}

          {form.operationalMode==='lan-host'&&<label className="storage-inline-toggle"><input type="checkbox" checked={startAtLogin} onChange={event=>toggleStartAtLogin(event.target.checked)}/> Iniciar o Obra na Mão com o Windows para manter o servidor disponível</label>}

          {paired&&<div className="storage-tech-actions"><Button variant="secondary" icon={<Unplug size={14}/>} disabled={busy} onClick={disconnect}>Remover pareamento deste PC</Button><Button variant="secondary" icon={<RefreshCw size={14}/>} disabled={busy} onClick={()=>readLanState()}>Atualizar estado</Button></div>}
        </div>
      </details>

      {isAdmin&&<details className="storage-tech-details storage-admin-details">
        <summary><span>Administrar computadores</span><ChevronDown size={16}/></summary>
        <div className="storage-tech-content">
          <p className="storage-admin-copy">Permissões vêm da conta Obra na Mão. Estar fisicamente no PC-servidor não concede acesso administrativo.</p>
          {adminStatus&&<small>Permissões Cloud: {adminStatus.stale?'última cópia local — Cloud temporariamente desatualizada':'atualizadas'}{adminStatus.lastCloudRefreshAt?` · ${new Date(adminStatus.lastCloudRefreshAt).toLocaleString('pt-BR')}`:''} · {adminStatus.deviceCount??devices.length} computador(es).</small>}
          <div className="storage-admin-toolbar"><Button variant="secondary" disabled={busy} onClick={refreshIdentity}>Atualizar permissões Cloud</Button></div>
          <div className="storage-pairing-row"><Field label="E-mail de um usuário já autorizado"><input type="email" value={pairTarget} onChange={event=>setPairTarget(event.target.value)} placeholder="usuario@empresa.com"/></Field><Button disabled={busy||!pairTarget.trim()} onClick={createPairing}>Gerar código de pareamento</Button></div>
          {pairInvite&&<div className="storage-pair-code"><strong>{pairInvite.code}</strong><small>Uso único; expira em {new Date(pairInvite.expiresAt).toLocaleTimeString('pt-BR')}.</small></div>}
          {!!devices.length&&<div className="table-wrap storage-device-table"><table className="data-table"><thead><tr><th>Computador</th><th>Usuário</th><th>Status</th><th></th></tr></thead><tbody>{devices.map(device=><tr key={device.id}><td>{device.deviceName||device.installationId||device.id}</td><td>{device.memberId}</td><td><Status value={device.status==='active'?'ativo':'inativo'}/></td><td><Button variant="secondary" disabled={busy} onClick={()=>toggleDevice(device)}>{device.status==='active'?'Revogar':'Reativar'}</Button></td></tr>)}</tbody></table></div>}
        </div>
      </details>}
    </Card>

    <Confirm
      open={!!rollbackTarget}
      title="Reverter tentativa de migração"
      description={rollbackTarget?`A tentativa de ${MODULE_LABELS[rollbackTarget]} será removida do servidor. Os dados locais e o backup permanecem intactos.`:''}
      onCancel={()=>setRollbackTarget(null)}
      onConfirm={confirmRollback}
      danger
    />
  </>
}
