import { AlertTriangle, CheckCircle2, ChevronDown, Circle, LoaderCircle, RefreshCw, RotateCcw, Search, Server, ShieldCheck, Unplug, Wifi } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { Button, Card, Confirm, Field, Status } from './ui'

type Props={onMessage:(message:string)=>void}
type Mode='local'|'lan-host'|'lan-client'|'remote'
type Form={operationalMode:Mode;host:string;port:string}
type ModuleKey='core'|'operation'|'planning'|'finance'|'rh'
type SetupStage='idle'|'saving'|'checking'|'authorizing'|'backup'|'migrating'|'validating'|'waiting'|'ready'|'error'
type SetupProgress={stage:SetupStage;completed:number;total:number;current?:ModuleKey;message:string;error?:string}

type SetupUiState={
  busy:boolean
  discovering:boolean
  rollbackTarget:ModuleKey|null
  restoreTarget:string|null
  progress:SetupProgress
}
type SetupUiAction=
  |{type:'busy';value:boolean}
  |{type:'discovering';value:boolean}
  |{type:'rollback-target';value:ModuleKey|null}
  |{type:'restore-target';value:string|null}
  |{type:'progress';value:SetupProgress|((current:SetupProgress)=>SetupProgress)}

const initialSetupUiState:SetupUiState={
  busy:false,
  discovering:false,
  rollbackTarget:null,
  restoreTarget:null,
  progress:{stage:'idle',completed:0,total:MODULE_ORDER.length,message:''},
}
function setupUiReducer(state:SetupUiState,action:SetupUiAction):SetupUiState{
  if(action.type==='busy')return{...state,busy:action.value}
  if(action.type==='discovering')return{...state,discovering:action.value}
  if(action.type==='rollback-target')return{...state,rollbackTarget:action.value}
  if(action.type==='restore-target')return{...state,restoreTarget:action.value}
  const progress=typeof action.value==='function'?action.value(state.progress):action.value
  return{...state,progress}
}

const MODULE_ORDER:ModuleKey[]=['core','operation','planning','finance','rh']
const MODULE_LABELS:Record<ModuleKey,string>={core:'Cadastros-base',operation:'RDO / operação',planning:'Planejamento',finance:'Financeiro',rh:'RH'}
const STATE_LABELS:Record<string,string>={local:'Local','migration-required':'Aguardando migração','central-ready':'Preparando','central-active':'No servidor'}
const SETUP_STEPS=['Identificação','Claim','Storage','Rede','Backup','Segurança','Validação'] as const

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
  const [operations,setOperations]=useState<any>(null)
  const [backups,setBackups]=useState<any[]>([])
  const [devices,setDevices]=useState<any[]>([])
  const [setupCode,setSetupCode]=useState('')
  const [pairCode,setPairCode]=useState('')
  const [pairTarget,setPairTarget]=useState('')
  const [pairInvite,setPairInvite]=useState<any>(null)
  const [startAtLogin,setStartAtLogin]=useState(false)
  const [manualAddress,setManualAddress]=useState('')
  const [manualProbe,setManualProbe]=useState<any>(null)
  const [discoveredServers,setDiscoveredServers]=useState<any[]>([])
  const [setupUi,dispatchSetupUi]=useReducer(setupUiReducer,initialSetupUiState)
  const {busy,discovering,rollbackTarget,restoreTarget,progress}=setupUi
  const setBusy=(value:boolean)=>dispatchSetupUi({type:'busy',value})
  const setDiscovering=(value:boolean)=>dispatchSetupUi({type:'discovering',value})
  const setRollbackTarget=(value:ModuleKey|null)=>dispatchSetupUi({type:'rollback-target',value})
  const setRestoreTarget=(value:string|null)=>dispatchSetupUi({type:'restore-target',value})
  const setProgress=(value:SetupProgress|((current:SetupProgress)=>SetupProgress))=>dispatchSetupUi({type:'progress',value})

  useEffect(()=>{
    if(!storage.data)return
    setForm({operationalMode:storage.data.operationalMode,host:storage.data.host,port:String(storage.data.port)})
    if(['lan-client','remote'].includes(storage.data.operationalMode))setManualAddress(storage.data.baseUrl)
  },[storage.data?.operationalMode,storage.data?.host,storage.data?.port,storage.data?.baseUrl])

  const refreshModuleState=async()=>{
    let states:Record<ModuleKey,any>
    try{states=await storageApi.refreshModuleCapabilities() as Record<ModuleKey,any>}
    catch{
      const values=await Promise.all(MODULE_ORDER.map(async key=>[key,await storageApi.moduleState(key)] as const))
      states=Object.fromEntries(values) as Record<ModuleKey,any>
    }
    setModules(current=>({...current,...states}))
    const statuses=await Promise.all(MODULE_ORDER.map(async key=>{
      try{return[key,(await storageApi.migrationStatus(key)).attempt] as const}catch{return[key,null] as const}
    }))
    setAttempts(Object.fromEntries(statuses) as Record<ModuleKey,any>)
    return states
  }

  const refreshOperations=async()=>{
    try{
      const [status,list]=await Promise.all([window.fluxoDre.lan.operationsStatus(),window.fluxoDre.lan.listBackups()])
      setOperations(status);setBackups(list)
      return status
    }catch{
      setOperations(null);setBackups([])
      return null
    }
  }

  const readLanState=async(mode:Mode=form.operationalMode)=>{
    if(mode==='local'){
      setLanStatus(null);setHostState(null);setAdminStatus(null);setOperations(null);setBackups([]);setDevices([])
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
      await refreshOperations()
    }else{
      setAdminStatus(null);setOperations(null);setBackups([]);setDevices([])
    }
    await refreshModuleState()
    return status
  }

  useEffect(()=>{
    if(!storage.data)return
    void readLanState(storage.data.operationalMode as Mode).catch(error=>onMessage(error instanceof Error?error.message:String(error)))
  },[storage.data?.operationalMode,storage.data?.baseUrl])

  const effectiveHost=form.operationalMode==='lan-host'?'127.0.0.1':form.host
  const dirty=!!storage.data&&(
    form.operationalMode!==storage.data.operationalMode||
    (['lan-client','remote'].includes(form.operationalMode)
      ?manualAddress.trim()!==storage.data.baseUrl
      :effectiveHost!==storage.data.host||form.port!==String(storage.data.port))
  )
  const isServerMode=form.operationalMode!=='local'
  const paired=!!lanStatus?.credential?.paired
  const isAdmin=lanStatus?.credential?.member?.role==='admin'
  const allCentral=useMemo(()=>MODULE_ORDER.every(module=>modules[module]?.state==='central-active'),[modules])
  const setupReady=isServerMode&&paired&&allCentral&&operations?.readiness?.ready!==false
  const progressValue=progress.stage==='ready'||setupReady?100:Math.round((progress.completed/Math.max(1,progress.total))*100)

  useEffect(()=>{
    if(setupReady&&!['migrating','saving','checking','authorizing','backup','validating'].includes(progress.stage)){
      setProgress({stage:'ready',completed:MODULE_ORDER.length,total:MODULE_ORDER.length,message:'Dados centralizados e servidor validado para uso.'})
    }
  },[setupReady])

  const changeMode=(mode:Mode)=>{
    setManualProbe(null)
    if(mode!=='lan-client')setDiscoveredServers([])
    setForm(current=>({...current,operationalMode:mode,host:mode==='lan-host'||mode==='local'?'127.0.0.1':(current.host==='127.0.0.1'?'':current.host)}))
    setProgress({stage:'idle',completed:0,total:MODULE_ORDER.length,message:''})
  }

  const centralizeAll=async()=>{
    setProgress({stage:'migrating',completed:0,total:MODULE_ORDER.length,current:'core',message:'Migrando dados na ordem segura...'})
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
  }

  const configureEndpoint=async()=>{
    if(form.operationalMode==='local'||form.operationalMode==='lan-host'){
      const saved=await window.fluxoDre.storage.configure({operationalMode:form.operationalMode,host:effectiveHost,port:Number(form.port)})
      storage.setData(saved)
      return saved
    }
    if(!manualAddress.trim())throw new Error('Informe o endereço do servidor.')
    const result=await window.fluxoDre.storage.connectAddress(manualAddress,form.operationalMode)
    storage.setData(result.state)
    setForm({operationalMode:result.state.operationalMode as Mode,host:result.state.host,port:String(result.state.port)})
    setManualAddress(result.state.baseUrl);setManualProbe(result.server)
    return result.state
  }

  const configureAndFinish=async()=>{
    setBusy(true)
    setProgress({stage:'saving',completed:0,total:MODULE_ORDER.length,message:isServerMode?'Preparando a fonte de dados...':'Salvando configuração local...'})
    try{
      const saved=await configureEndpoint()
      if(saved.operationalMode==='local'){
        await refreshModuleState()
        setProgress({stage:'idle',completed:0,total:MODULE_ORDER.length,message:''})
        onMessage('Dados configurados para permanecer somente neste computador.')
        return
      }

      setProgress({stage:'checking',completed:0,total:MODULE_ORDER.length,message:'Identificando e validando a rede do servidor...'})
      if(saved.operationalMode==='lan-host')await window.fluxoDre.storage.testConnection()
      let status=await readLanState(saved.operationalMode as Mode)

      if(!status?.claimed){
        const onlineState=await window.fluxoDre.online.state()
        online.setData(onlineState)
        if(!onlineState?.linked){
          setProgress({stage:'waiting',completed:0,total:MODULE_ORDER.length,message:'Vincule este Desktop ao Obra na Mão online para concluir o claim.'})
          onMessage('Servidor identificado. Falta vincular este Desktop ao Obra na Mão online.')
          return
        }
        if(['lan-client','remote'].includes(saved.operationalMode)&&!setupCode.trim()){
          setProgress({stage:'waiting',completed:0,total:MODULE_ORDER.length,message:'Informe o código de configuração exibido no servidor para concluir o claim.'})
          return
        }
        setProgress({stage:'authorizing',completed:0,total:MODULE_ORDER.length,message:'Vinculando a instância à empresa...'})
        await window.fluxoDre.lan.claimHost(saved.operationalMode==='lan-host'?undefined:setupCode.trim())
        setSetupCode('')
        status=await readLanState(saved.operationalMode as Mode)
      }

      if(!status?.credential?.paired){
        if(!pairCode.trim()){
          setProgress({stage:'waiting',completed:0,total:MODULE_ORDER.length,message:'Informe um código de pareamento para autorizar este computador.'})
          return
        }
        setProgress({stage:'authorizing',completed:0,total:MODULE_ORDER.length,message:'Validando segurança e pareando este computador...'})
        await window.fluxoDre.lan.pair(pairCode.trim())
        setPairCode('')
        status=await readLanState(saved.operationalMode as Mode)
      }

      if(status?.credential?.member?.role!=='admin'){
        setProgress({stage:'waiting',completed:0,total:MODULE_ORDER.length,message:'Um usuário Admin precisa concluir o backup e a migração inicial.'})
        return
      }

      setProgress({stage:'backup',completed:0,total:MODULE_ORDER.length,message:'Criando e verificando backup operacional antes da centralização...'})
      await window.fluxoDre.lan.createBackup('setup')

      await centralizeAll()

      setProgress({stage:'validating',completed:MODULE_ORDER.length,total:MODULE_ORDER.length,message:'Validando storage, backup, permissões e readiness...'})
      const ops=await window.fluxoDre.lan.operationsStatus()
      setOperations(ops)
      if(!ops?.readiness?.ready)throw new Error('O servidor concluiu a migração, mas não passou na validação final de readiness.')
      await readLanState(saved.operationalMode as Mode)
      setProgress({stage:'ready',completed:MODULE_ORDER.length,total:MODULE_ORDER.length,message:'Servidor configurado, backup verificado e dados centralizados.'})
      onMessage('Servidor configurado e dados centralizados com sucesso.')
    }catch(error:any){
      const message=error instanceof Error?error.message:String(error)
      setProgress(current=>({...current,stage:'error',message:'A configuração não foi concluída.',error:message}))
      onMessage(`Configuração não concluída: ${message}`)
      await refreshModuleState().catch(()=>{})
    }finally{setBusy(false)}
  }

  const test=async()=>{
    setBusy(true);onMessage('Testando servidor Obra na Mão...')
    try{
      const result=await window.fluxoDre.storage.testConnection()
      onMessage(`Servidor encontrado — ${result.baseUrl} (${result.latencyMs} ms).`)
      await readLanState()
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const reconnect=async()=>{
    setBusy(true);onMessage('Reconectando ao servidor selecionado...')
    try{
      const result=await window.fluxoDre.lan.reconnect()
      const current=await window.fluxoDre.storage.state()
      storage.setData(current)
      if(['lan-client','remote'].includes(current.operationalMode)){
        setManualAddress(current.baseUrl)
        setForm({operationalMode:current.operationalMode as Mode,host:current.host,port:String(current.port)})
      }
      if(result.status==='connected')onMessage(result.endpointChanged?'Servidor reencontrado na rede e reconectado sem novo pareamento.':'Servidor reconectado com a credencial já autorizada.')
      else if(result.status==='pairing-required')onMessage('A credencial deste computador não é mais válida. Faça um novo pareamento.')
      else if(result.status==='unreachable')onMessage('O servidor selecionado não está acessível. Nenhum outro servidor foi usado como substituto.')
      await readLanState(current.operationalMode as Mode)
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const applyServerConnection=async(address:string,mode:'lan-client'|'remote'=(form.operationalMode==='remote'?'remote':'lan-client'))=>{
    setBusy(true);onMessage('Validando e conectando ao servidor Obra na Mão...')
    try{
      const result=await window.fluxoDre.storage.connectAddress(address,mode)
      storage.setData(result.state)
      setForm({operationalMode:result.state.operationalMode as Mode,host:result.state.host,port:String(result.state.port)})
      setManualAddress(result.state.baseUrl);setManualProbe(result.server)
      onMessage(`Servidor conectado — ${result.state.baseUrl} (${result.server.latencyMs} ms).`)
      await readLanState(result.state.operationalMode as Mode)
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const discoverServers=async()=>{
    setDiscovering(true);setDiscoveredServers([]);onMessage('Procurando servidores Obra na Mão nesta rede...')
    try{
      const servers=await window.fluxoDre.storage.discoverServers();setDiscoveredServers(servers)
      onMessage(servers.length?`${servers.length} servidor(es) Obra na Mão encontrado(s) na rede.`:'Nenhum servidor Obra na Mão foi encontrado automaticamente nesta rede.')
    }catch(error:any){onMessage(error.message)}finally{setDiscovering(false)}
  }

  const testManualAddress=async()=>{
    setBusy(true);setManualProbe(null);onMessage('Testando o endereço informado...')
    try{
      const result=await window.fluxoDre.storage.probeAddress(manualAddress,form.operationalMode==='remote'?'remote':'lan-client')
      setManualProbe(result);onMessage(`Servidor compatível e pronto — ${result.baseUrl} (${result.latencyMs} ms).`)
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const disconnect=async()=>{setBusy(true);try{await window.fluxoDre.lan.disconnect();onMessage('Pareamento removido deste computador. A conta Web/PWA não foi alterada.');await readLanState()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}
  const createPairing=async()=>{setBusy(true);try{const invite=await window.fluxoDre.lan.createPairing(pairTarget.trim());setPairInvite(invite);setPairTarget('');onMessage('Código temporário criado.')}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}
  const toggleDevice=async(device:any)=>{setBusy(true);try{await window.fluxoDre.lan.setDeviceStatus(device.id,device.status==='active'?'revoked':'active');onMessage(device.status==='active'?'Computador revogado.':'Computador reativado.');await readLanState()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}
  const refreshIdentity=async()=>{setBusy(true);try{await window.fluxoDre.lan.refreshIdentity();onMessage('Usuários e permissões atualizados a partir do Obra na Mão Cloud.');await readLanState()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}
  const toggleStartAtLogin=async(enabled:boolean)=>{try{const state=await window.fluxoDre.lan.setStartAtLogin(enabled);setStartAtLogin(state.enabled);onMessage(state.enabled?'Obra na Mão configurado para iniciar com o Windows.':'Inicialização automática desativada.')}catch(error:any){onMessage(error.message)}}

  const createBackupNow=async()=>{
    setBusy(true)
    try{const backup=await window.fluxoDre.lan.createBackup('manual');onMessage(`Backup ${backup.backupId} criado e verificado.`);await refreshOperations()}
    catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }
  const testLatestBackup=async(backupId:string)=>{
    setBusy(true)
    try{const result=await window.fluxoDre.lan.testBackup(backupId);onMessage(result.restorable?`Backup ${backupId} passou no teste de restore.`:`Backup ${backupId} não passou no teste de restore.`)}
    catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }
  const createPreUpgradeBackup=async()=>{
    setBusy(true)
    try{const result=await window.fluxoDre.lan.preUpgradeBackup();onMessage(`Backup pré-upgrade ${result.backup?.backupId||''} criado e verificado.`);await refreshOperations()}
    catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }
  const confirmRestore=async()=>{
    const backupId=restoreTarget
    if(!backupId)return
    setRestoreTarget(null);setBusy(true)
    try{await window.fluxoDre.lan.restoreBackup(backupId);onMessage(`Backup ${backupId} restaurado com backup de segurança automático.`);await readLanState()}
    catch(error:any){onMessage(error.message)}finally{setBusy(false)}
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
  const statusTitle=form.operationalMode==='local'?'Dados neste computador':setupReady?'Servidor pronto':progress.stage==='error'?'Configuração interrompida':busy?'Configurando servidor':progress.stage==='waiting'?'Falta uma etapa':'Servidor ainda não concluído'

  return <>
    <Card className="setting-card setting-card-feature storage-setup-card">
      <div className="storage-setup-head">
        <div className="storage-setup-title"><span className="storage-setup-icon"><Server size={20}/></span><div><h3>Dados e servidor</h3><p>Escolha a fonte dos dados. O assistente conduz identificação, claim, storage, rede, backup, segurança e validação.</p></div></div>
        <span className={`storage-overall-status ${setupReady?'is-ready':progress.stage==='error'?'is-error':''}`}>{statusIcon}{statusTitle}</span>
      </div>

      <div className="storage-setup-body">
        <div className="storage-setup-controls">
          <Field label="Onde os dados operacionais ficarão?">
            <select value={form.operationalMode} disabled={storage.loading||busy} onChange={event=>changeMode(event.target.value as Mode)}>
              <option value="local">Somente neste computador</option>
              <option value="lan-host">Este computador é o principal / servidor local</option>
              <option value="lan-client">Conectar a um servidor da empresa</option>
              <option value="remote">Servidor remoto próprio / VPS</option>
            </select>
          </Field>

          {form.operationalMode==='lan-host'&&<Field label="Porta"><input type="number" min="1" max="65535" value={form.port} onChange={event=>setForm({...form,port:event.target.value})}/></Field>}

          {['lan-client','remote'].includes(form.operationalMode)&&<div className="storage-network-picker">
            {form.operationalMode==='lan-client'&&<>
              <div className="setting-actions" style={{justifyContent:'space-between'}}>
                <div><strong>Encontrar servidor automaticamente</strong><br/><small>Procura somente servidores Obra na Mão nesta rede local.</small></div>
                <Button variant="secondary" icon={<Search size={15}/>} disabled={busy||discovering} onClick={discoverServers}>{discovering?'Procurando...':'Procurar na rede'}</Button>
              </div>
              {!!discoveredServers.length&&<div style={{display:'grid',gap:8,marginTop:8}}>{discoveredServers.map(server=><div key={server.serverId} className="success-box" style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><strong><Wifi size={14}/> {server.name}</strong><br/><small>{server.host}:{server.port} · {server.latencyMs} ms</small></div><Button disabled={busy} onClick={()=>applyServerConnection(server.baseUrl,'lan-client')}>Usar servidor</Button></div>)}</div>}
            </>}

            {form.operationalMode==='remote'&&<div className="success-box"><strong>Conexão remota segura.</strong><br/><small>Use HTTPS para endereço público ou endereço privado da VPN/WireGuard. HTTP público é bloqueado.</small></div>}

            <strong>Conectar manualmente</strong>
            <Field label="Endereço do servidor"><input value={manualAddress} onChange={event=>{setManualAddress(event.target.value);setManualProbe(null)}} placeholder={form.operationalMode==='remote'?'https://servidor.seudominio.com':'192.168.1.50 ou obra-server.local'}/></Field>
            <small>{form.operationalMode==='remote'?<>Também pode usar um IP privado da VPN, como <strong>10.66.0.1:4732</strong>.</>:<>Pode ser IP, hostname ou HTTPS autorizado.</>} Se a conexão falhar, a configuração atual é preservada e não existe fallback local silencioso.</small>
            {manualProbe&&<div className="success-box">Servidor pronto: <strong>{manualProbe.baseUrl}</strong>{manualProbe.serverId?<> · ID {manualProbe.serverId}</>:null}.</div>}
            <div className="setting-actions"><Button variant="secondary" disabled={busy||!manualAddress.trim()} onClick={testManualAddress}>Testar conexão</Button><Button variant="secondary" disabled={busy||!manualAddress.trim()} onClick={()=>applyServerConnection(manualAddress)}>Conectar sem migrar</Button></div>
          </div>}

          {isServerMode&&!dirty&&lanStatus&&!lanStatus.claimed&&['lan-client','remote'].includes(form.operationalMode)&&<Field label="Código de configuração do servidor"><input value={setupCode} onChange={event=>setSetupCode(event.target.value.toUpperCase())} placeholder="XXXXX-XXXXX"/></Field>}
          {isServerMode&&!dirty&&lanStatus?.claimed&&!paired&&<Field label="Código de pareamento"><input value={pairCode} onChange={event=>setPairCode(event.target.value.toUpperCase())} placeholder="Código fornecido pelo Administrador"/></Field>}

          <div className="storage-primary-actions">
            <Button disabled={busy||storage.loading} onClick={configureAndFinish}>{form.operationalMode==='local'?'Salvar configuração':setupReady&&!dirty?'Verificar configuração':progress.stage==='error'?'Tentar novamente':'Configurar servidor e migrar dados'}</Button>
            {isServerMode&&!dirty&&<Button variant="secondary" icon={<RefreshCw size={15}/>} disabled={busy} onClick={test}>Testar servidor</Button>}
            {['lan-client','remote'].includes(form.operationalMode)&&!dirty&&<Button variant="secondary" icon={<Wifi size={14}/>} disabled={busy} onClick={reconnect}>Reconectar servidor</Button>}
          </div>

          <p className="storage-cloud-note"><strong>Web/PWA continua incluído.</strong> A fonte operacional muda, mas login, PWA e sincronização online continuam independentes desta configuração.</p>
          {isServerMode&&<p className="storage-cloud-note"><strong>Sem fallback silencioso.</strong> Se o servidor falhar, a configuração anterior é preservada e o Desktop não troca para SQLite local automaticamente.</p>}
        </div>

        <div className={`storage-progress-panel ${setupReady?'is-ready':''} ${progress.stage==='error'?'is-error':''}`} aria-live="polite">
          <div className="storage-progress-copy"><span>{statusIcon}</span><div><strong>{statusTitle}</strong><p>{progress.message||(form.operationalMode==='local'?'O aplicativo usa o SQLite deste computador.':'Salve a configuração para preparar o servidor e centralizar os dados.')}</p></div></div>
          {isServerMode&&<>
            <progress className="storage-progress-bar" value={progressValue} max="100" aria-label="Progresso da configuração do servidor">{progressValue}%</progress>
            <div className="storage-progress-meta"><span>{setupReady?'5 de 5 etapas concluídas':progress.stage==='migrating'?`${progress.completed} de ${progress.total} etapas concluídas`:'Aguardando conclusão'}</span><span>{progressValue}%</span></div>
            <div className="storage-setup-steps">{SETUP_STEPS.map(step=><small key={step}>{step}</small>)}</div>
          </>}
          {progress.stage==='error'&&<div className="storage-error-summary"><strong>Ação necessária</strong><p>{progress.error}</p><Button variant="secondary" onClick={configureAndFinish} disabled={busy}>Tentar novamente</Button></div>}
          {progress.stage==='waiting'&&!online.data?.linked&&<div className="storage-waiting-note"><strong>Conexão online necessária</strong><p>Vincule este Desktop em “Conexão Obra na Mão” e volte aqui para concluir.</p></div>}
          {setupReady&&<div className="storage-ready-note"><ShieldCheck size={17}/><span><strong>Dados centralizados.</strong> Os computadores autorizados usam a mesma fonte operacional.</span></div>}
        </div>
      </div>

      <details className="storage-tech-details">
        <summary><span>Detalhes técnicos</span><ChevronDown size={16}/></summary>
        <div className="storage-tech-content">
          <div className="storage-module-list">{MODULE_ORDER.map(module=>{
            const state=modules[module];const attempt=attempts[module]
            return <div className="storage-module-row" key={module}><div><strong>{MODULE_LABELS[module]}</strong><small>{state?.localRecords!=null?`${state.localRecords} registro(s) local(is)`:'Estado ainda não carregado'}</small></div><div className="storage-module-state"><Status value={STATE_LABELS[state?.state]||state?.state||'—'}/>{attempt&&<small>Tentativa {attempt.migrationId}</small>}</div>{attempt&&<Button variant="ghost" disabled={busy} icon={<RotateCcw size={14}/>} onClick={()=>setRollbackTarget(module)}>Reverter tentativa</Button>}</div>
          })}</div>

          {isServerMode&&!dirty&&<div className="storage-server-facts"><span>Servidor <strong>{lanStatus?.serverId||storage.data?.serverId||'—'}</strong></span><span>Endereço <strong>{storage.data?.baseUrl||`${effectiveHost}:${form.port}`}</strong></span>{form.operationalMode==='lan-host'&&<span>Processo <strong>{hostState?.running?'ativo':'inativo'}</strong></span>}<span>Este PC <strong>{paired?'pareado':'não pareado'}</strong></span>{paired&&<span>Perfil <strong>{lanStatus?.credential?.member?.role||'—'}</strong></span>}</div>}
          {form.operationalMode==='lan-host'&&<label className="storage-inline-toggle"><input type="checkbox" checked={startAtLogin} onChange={event=>toggleStartAtLogin(event.target.checked)}/> Iniciar o Obra na Mão com o Windows para manter o servidor disponível</label>}
          {paired&&<div className="storage-tech-actions"><Button variant="secondary" icon={<Unplug size={14}/>} disabled={busy} onClick={disconnect}>Remover pareamento deste PC</Button><Button variant="secondary" icon={<RefreshCw size={14}/>} disabled={busy} onClick={()=>readLanState()}>Atualizar estado</Button></div>}
        </div>
      </details>

      {isAdmin&&<details className="storage-tech-details storage-admin-details">
        <summary><span>Operação do servidor</span><ChevronDown size={16}/></summary>
        <div className="storage-tech-content">
          {operations&&<>
            <div className="storage-server-facts">
              <span>Versão <strong>{operations.server?.version||'—'}</strong></span>
              <span>Readiness <strong>{operations.readiness?.ready?'pronto':'atenção'}</strong></span>
              <span>Banco <strong>{operations.storage?.integrity||'—'}</strong></span>
              <span>Schema <strong>{operations.storage?.schemaVersion??'—'}</strong></span>
              <span>Transporte <strong>{operations.server?.runtime?.transport||'—'}</strong></span>
              <span>Dispositivos <strong>{operations.devices?.active??0}/{operations.devices?.total??0} ativos</strong></span>
            </div>
            <p><small>Backup automático: <strong>{operations.backup?.policy?.enabled?'ativo':'desativado'}</strong>{operations.backup?.policy?.enabled?<> · a cada {operations.backup.policy.intervalHours}h · retenção {operations.backup.policy.retentionCount}</>:null}{operations.backup?.policy?.nextRunAt?<> · próximo {new Date(operations.backup.policy.nextRunAt).toLocaleString('pt-BR')}</>:null}.</small></p>
          </>}
          <div className="setting-actions"><Button variant="secondary" disabled={busy} onClick={createBackupNow}>Criar backup agora</Button><Button variant="secondary" disabled={busy} onClick={createPreUpgradeBackup}>Criar backup pré-upgrade</Button><Button variant="secondary" disabled={busy} onClick={refreshOperations}>Atualizar operação</Button></div>
          {!!backups.length&&<div className="table-wrap"><table className="data-table"><thead><tr><th>Backup</th><th>Data</th><th>Motivo</th><th></th></tr></thead><tbody>{backups.map(backup=><tr key={backup.backupId}><td>{backup.backupId}</td><td>{backup.createdAt?new Date(backup.createdAt).toLocaleString('pt-BR'):'—'}</td><td>{backup.reason||'—'}</td><td><div className="setting-actions"><Button variant="secondary" disabled={busy} onClick={()=>testLatestBackup(backup.backupId)}>Testar restore</Button><Button variant="ghost" disabled={busy} onClick={()=>setRestoreTarget(backup.backupId)}>Restaurar</Button></div></td></tr>)}</tbody></table></div>}
        </div>
      </details>}

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

    <Confirm open={!!rollbackTarget} title="Reverter tentativa de migração" description={rollbackTarget?`A tentativa de ${MODULE_LABELS[rollbackTarget]} será removida do servidor. Os dados locais e o backup permanecem intactos.`:''} onCancel={()=>setRollbackTarget(null)} onConfirm={confirmRollback} danger/>
    <Confirm open={!!restoreTarget} title="Restaurar backup do servidor" description={restoreTarget?`O backup ${restoreTarget} será validado novamente. Antes da troca, o servidor cria automaticamente um backup de segurança do banco atual.`:''} onCancel={()=>setRestoreTarget(null)} onConfirm={confirmRestore} danger/>
  </>
}
