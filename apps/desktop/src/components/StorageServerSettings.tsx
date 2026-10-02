import { RefreshCw, Search, Server, ShieldCheck, Unplug, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { Button, Card, Field, Status } from './ui'

type Props={onMessage:(message:string)=>void}
type Mode='local'|'lan-host'|'lan-client'|'remote'
type Form={operationalMode:Mode;host:string;port:string}
type ModuleKey='core'|'operation'|'planning'|'finance'|'rh'

const MODULE_LABELS:Record<ModuleKey,string>={core:'Cadastros-base',operation:'RDO / operação',planning:'Planejamento',finance:'Financeiro',rh:'RH'}
const MODULE_COPY:Record<ModuleKey,string>={
  core:'Empresas, clientes e obras',
  operation:'Frentes, tarefas, RDOs e seus registros',
  planning:'Etapas, cronograma e orçamento',
  finance:'Fornecedores, categorias, contas e pagamentos',
  rh:'Funcionários, folha, ponto, benefícios e EPIs'
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
  const [manualAddress,setManualAddress]=useState('')
  const [manualProbe,setManualProbe]=useState<any>(null)
  const [discoveredServers,setDiscoveredServers]=useState<any[]>([])
  const [discovering,setDiscovering]=useState(false)
  const [busy,setBusy]=useState(false)

  useEffect(()=>{
    if(!storage.data)return
    setForm({operationalMode:storage.data.operationalMode,host:storage.data.host,port:String(storage.data.port)})
    if(['lan-client','remote'].includes(storage.data.operationalMode))setManualAddress(storage.data.baseUrl)
  },[storage.data?.operationalMode,storage.data?.host,storage.data?.port,storage.data?.baseUrl])

  const refreshModuleState=async()=>{
    const keys:ModuleKey[]=['core','operation','planning','finance','rh']
    try{
      const states=await storageApi.refreshModuleCapabilities()
      setModules(current=>({...current,...states}))
    }catch{
      const states=await Promise.all(keys.map(async key=>[key,await storageApi.moduleState(key)] as const))
      setModules(Object.fromEntries(states) as Record<ModuleKey,any>)
    }
    const statuses=await Promise.all(keys.map(async key=>{
      try{return [key,(await storageApi.migrationStatus(key)).attempt] as const}catch{return [key,null] as const}
    }))
    setAttempts(Object.fromEntries(statuses) as Record<ModuleKey,any>)
  }

  const refreshLan=async(mode:Mode=form.operationalMode)=>{
    if(mode==='local'){
      setLanStatus(null);setHostState(null);setAdminStatus(null);setDevices([])
      await refreshModuleState()
      return
    }
    try{
      if(mode==='lan-host'){
        const [host,login]=await Promise.all([window.fluxoDre.lan.hostState(),window.fluxoDre.lan.startAtLoginState()])
        setHostState(host);setStartAtLogin(login.enabled)
      }else setHostState(null)
      const status=await window.fluxoDre.lan.status();setLanStatus(status)
      if(status?.credential?.paired&&status?.credential?.member?.role==='admin'){
        const [admin,deviceList]=await Promise.all([window.fluxoDre.lan.adminStatus(),window.fluxoDre.lan.listDevices()])
        setAdminStatus(admin);setDevices(deviceList)
      }else{setAdminStatus(null);setDevices([])}
      await refreshModuleState()
    }catch(error:any){setLanStatus(null);setAdminStatus(null);setDevices([]);await refreshModuleState();onMessage(error.message)}
  }

  useEffect(()=>{if(storage.data)void refreshLan(storage.data.operationalMode as Mode)},[storage.data?.operationalMode,storage.data?.baseUrl])

  const effectiveHost=form.operationalMode==='lan-host'?'127.0.0.1':form.host
  const dirty=!!storage.data&&(
    form.operationalMode!==storage.data.operationalMode||
    (['lan-client','remote'].includes(form.operationalMode)
      ?manualAddress.trim()!==storage.data.baseUrl
      :effectiveHost!==storage.data.host||form.port!==String(storage.data.port))
  )
  const isServerMode=form.operationalMode!=='local'
  const isAdmin=lanStatus?.credential?.member?.role==='admin'
  const paired=!!lanStatus?.credential?.paired

  const changeMode=(mode:Mode)=>{
    setManualProbe(null)
    if(mode!=='lan-client')setDiscoveredServers([])
    setForm(current=>({...current,operationalMode:mode,host:mode==='lan-host'||mode==='local'?'127.0.0.1':(current.host==='127.0.0.1'?'':current.host)}))
  }

  const save=async()=>{
    setBusy(true);onMessage('Salvando configuração de dados...')
    try{
      const saved=await window.fluxoDre.storage.configure({operationalMode:form.operationalMode,host:effectiveHost,port:Number(form.port)})
      storage.setData(saved)
      if(saved.operationalMode==='local')onMessage('Dados configurados para permanecer somente neste computador.')
      else if(saved.operationalMode==='lan-host')onMessage('Este computador foi configurado como principal. Agora conclua a autorização do servidor abaixo.')
      else onMessage('Servidor da empresa salvo. Teste a conexão e faça o pareamento deste computador.')
      await refreshLan(saved.operationalMode as Mode)
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const test=async()=>{setBusy(true);onMessage('Testando servidor Obra na Mão...');try{const result=await window.fluxoDre.storage.testConnection();onMessage(`Servidor encontrado — ${result.baseUrl} (${result.latencyMs} ms).`);await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}

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
      if(result.status==='connected'){
        onMessage(result.endpointChanged?'Servidor reencontrado na rede e reconectado sem novo pareamento.':'Servidor reconectado com a credencial já autorizada.')
      }else if(result.status==='pairing-required'){
        onMessage('A credencial deste computador não é mais válida. Faça um novo pareamento para continuar.')
      }else if(result.status==='unreachable'){
        onMessage('O servidor selecionado não está acessível. Nenhum outro servidor foi usado como substituto.')
      }
      await refreshLan(current.operationalMode as Mode)
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const applyServerConnection=async(address:string,mode:'lan-client'|'remote'=(form.operationalMode==='remote'?'remote':'lan-client'))=>{
    setBusy(true)
    onMessage('Validando e conectando ao servidor Obra na Mão...')
    try{
      const result=await window.fluxoDre.storage.connectAddress(address,mode)
      storage.setData(result.state)
      setForm({operationalMode:result.state.operationalMode as Mode,host:result.state.host,port:String(result.state.port)})
      setManualAddress(result.state.baseUrl)
      setManualProbe(result.server)
      onMessage(`Servidor conectado — ${result.state.baseUrl} (${result.server.latencyMs} ms). Agora conclua a autorização/pareamento.`)
      await refreshLan(result.state.operationalMode as Mode)
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const discoverServers=async()=>{
    setDiscovering(true);setDiscoveredServers([]);onMessage('Procurando servidores Obra na Mão nesta rede...')
    try{
      const servers=await window.fluxoDre.storage.discoverServers()
      setDiscoveredServers(servers)
      onMessage(servers.length?`${servers.length} servidor(es) Obra na Mão encontrado(s) na rede.`:'Nenhum servidor Obra na Mão foi encontrado automaticamente nesta rede.')
    }catch(error:any){onMessage(error.message)}finally{setDiscovering(false)}
  }

  const testManualAddress=async()=>{
    setBusy(true);setManualProbe(null);onMessage('Testando o endereço informado...')
    try{
      const result=await window.fluxoDre.storage.probeAddress(manualAddress,form.operationalMode==='remote'?'remote':'lan-client')
      setManualProbe(result)
      onMessage(`Servidor compatível e pronto — ${result.baseUrl} (${result.latencyMs} ms).`)
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }
  const claim=async()=>{setBusy(true);onMessage('Autorizando o servidor com a conta Administrador atual...');try{const result=await window.fluxoDre.lan.claimHost(form.operationalMode==='lan-host'?undefined:setupCode);setSetupCode('');onMessage(`Servidor vinculado${result.company?.name?` à ${result.company.name}`:''}. Este computador recebeu sua credencial LAN.`);await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}
  const pair=async()=>{setBusy(true);onMessage('Pareando este computador...');try{await window.fluxoDre.lan.pair(pairCode);setPairCode('');onMessage('Computador pareado e autorizado no servidor da empresa.');await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}
  const disconnect=async()=>{setBusy(true);try{await window.fluxoDre.lan.disconnect();onMessage('Credencial LAN removida somente deste computador. A conta Web/PWA não foi alterada.');await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}
  const createPairing=async()=>{setBusy(true);try{const invite=await window.fluxoDre.lan.createPairing(pairTarget.trim());setPairInvite(invite);setPairTarget('');onMessage('Código temporário criado. Envie-o somente ao usuário/computador que será pareado.')}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}
  const toggleDevice=async(device:any)=>{setBusy(true);try{await window.fluxoDre.lan.setDeviceStatus(device.id,device.status==='active'?'revoked':'active');onMessage(device.status==='active'?'Computador revogado. O token deixa de acessar o servidor imediatamente.':'Computador reativado.');await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}
  const refreshIdentity=async()=>{setBusy(true);try{await window.fluxoDre.lan.refreshIdentity();onMessage('Usuários e permissões atualizados a partir do Obra na Mão Cloud.');await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}
  const toggleStartAtLogin=async(enabled:boolean)=>{try{const state=await window.fluxoDre.lan.setStartAtLogin(enabled);setStartAtLogin(state.enabled);onMessage(state.enabled?'Obra na Mão configurado para iniciar com o sistema.':'Inicialização automática desativada.')}catch(error:any){onMessage(error.message)}}

  const migrate=async(module:ModuleKey)=>{
    const state=modules[module]
    if(state?.state!=='migration-required')return
    const confirmed=window.confirm(`${MODULE_LABELS[module]} possui dados locais. Será criado um backup antes da cópia. A base local não será apagada durante a migração. Deseja continuar?`)
    if(!confirmed)return
    setBusy(true);onMessage(`${attempts[module]?'Retomando':'Iniciando'} migração de ${MODULE_LABELS[module]} para o servidor...`)
    try{
      const preflight=await storageApi.migrationPreflight(module)
      if(!preflight.canMigrate)throw new Error(`Migração bloqueada${preflight.dependencies?.blockedBy?` por ${MODULE_LABELS[preflight.dependencies.blockedBy as ModuleKey]}`:''}.`)
      const result=await storageApi.migrateModule(module)
      onMessage(`${MODULE_LABELS[module]} migrado e validado no servidor. A base local e o backup foram preservados.`)
      await refreshLan()
      return result
    }catch(error:any){onMessage(`Migração não concluída: ${error.message}`);await refreshModuleState()}finally{setBusy(false)}
  }

  const rollbackMigration=async(module:ModuleKey)=>{
    const attempt=attempts[module]
    if(!attempt?.migrationId)return
    if(!window.confirm(`Reverter a tentativa pendente de ${MODULE_LABELS[module]} no servidor? Os dados locais e o backup permanecerão intactos.`))return
    setBusy(true);onMessage(`Revertendo tentativa de migração de ${MODULE_LABELS[module]}...`)
    try{
      const result=await storageApi.rollbackModuleMigration(module)
      onMessage(result.status==='rolled_back'?`Tentativa de ${MODULE_LABELS[module]} revertida no servidor. Os dados locais permanecem intactos.`:`Estado da tentativa: ${result.status}.`)
      await refreshModuleState()
    }catch(error:any){onMessage(`Rollback não concluído: ${error.message}`);await refreshModuleState()}finally{setBusy(false)}
  }

  const renderModule=(module:ModuleKey)=>{
    const state=modules[module]
    const attempt=attempts[module]
    const blockedBy=state?.dependencyBlockedBy as ModuleKey|undefined
    const dependencyLabel=blockedBy?MODULE_LABELS[blockedBy]:null
    return <div key={module} style={{marginTop:14,paddingTop:12,borderTop:'1px solid var(--border-color, #dfe4ec)'}}>
      <strong>{MODULE_LABELS[module]}</strong>
      <p style={{marginBottom:6}}>{MODULE_COPY[module]}.</p>
      {state?.state&&<small>Estado: <strong>{state.state}</strong>{state.localRecords!=null?` · ${state.localRecords} registro(s) local(is) a considerar`:''}.</small>}
      {state?.state==='local'&&<p>Este bloco continua usando somente o banco local.</p>}
      {state?.state==='central-ready'&&!blockedBy&&<p>Servidor disponível, mas este bloco ainda aguarda capability/ativação central. Não haverá fallback local silencioso.</p>}
      {state?.state==='central-ready'&&blockedBy&&<div className="error-box"><strong>Aguardando {dependencyLabel}.</strong> Conclua a migração/ativação desse bloco antes de {MODULE_LABELS[module]}.</div>}
      {state?.state==='central-active'&&<p className="success-box"><strong>Banco central ativo.</strong> Os computadores autorizados usam a mesma fonte para este bloco.</p>}
      {state?.state==='migration-required'&&<div className="error-box">
        <strong>Migração necessária.</strong> Os dados locais permanecem neste computador e não serão apagados durante a cópia. Um backup é criado antes da primeira escrita no servidor.
        {blockedBy&&<p><strong>Dependência:</strong> conclua {dependencyLabel} primeiro.</p>}
        {attempt&&<p><strong>Tentativa pendente:</strong> {attempt.migrationId} · estado {attempt.status}{attempt.lastError?` · ${attempt.lastError}`:''}. O retry reutiliza a mesma tentativa para evitar duplicação.</p>}
        <div className="setting-actions" style={{marginTop:10}}>
          <Button disabled={busy||!paired||!isAdmin||!!blockedBy} onClick={()=>migrate(module)}>{attempt?'Tentar novamente':'Migrar para servidor'}</Button>
          {attempt&&<Button variant="secondary" disabled={busy||!paired||!isAdmin} onClick={()=>rollbackMigration(module)}>Reverter tentativa</Button>}
        </div>
        {!isAdmin&&paired&&<small>Somente um usuário Admin pode executar ou reverter a migração.</small>}
      </div>}
    </div>
  }

  return <Card className="setting-card setting-card-feature">
    <Server size={21} color="#2f67d8"/>
    <h3>Dados e servidor</h3>
    <p>Escolha onde o Desktop opera os dados centralizáveis.</p>
    <div className="success-box" style={{margin:'10px 0'}}><strong>Web/PWA continua incluído.</strong> Login, PWA e a sincronização online que já fazem parte do Obra na Mão não são substituídos nem passam a exigir assinatura por causa desta configuração.</div>
    <Field label="Onde os dados operacionais ficarão?">
      <select value={form.operationalMode} disabled={storage.loading||busy} onChange={event=>changeMode(event.target.value as Mode)}>
        <option value="local">Somente neste computador</option>
        <option value="lan-host">Este computador é o principal / servidor local</option>
        <option value="lan-client">Conectar a um servidor da empresa</option>
        <option value="remote">Servidor remoto próprio / VPS</option>
      </select>
    </Field>

    {form.operationalMode==='lan-host'&&<div className="form-grid" style={{marginTop:10}}>
      <Field label="Porta"><input type="number" min="1" max="65535" value={form.port} onChange={event=>setForm({...form,port:event.target.value})}/></Field>
    </div>}

    {['lan-client','remote'].includes(form.operationalMode)&&<div style={{marginTop:12}}>
      {form.operationalMode==='lan-client'&&<>
        <div className="setting-actions" style={{justifyContent:'space-between'}}>
          <div><strong>Encontrar servidor automaticamente</strong><br/><small>Procura somente servidores Obra na Mão disponíveis nesta rede local.</small></div>
          <Button variant="secondary" icon={<Search size={15}/>} disabled={busy||discovering} onClick={discoverServers}>{discovering?'Procurando...':'Procurar na rede'}</Button>
        </div>

        {!!discoveredServers.length&&<div style={{marginTop:10,display:'grid',gap:8}}>
          {discoveredServers.map(server=><div key={server.serverId} className="success-box" style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
            <div><strong><Wifi size={14} style={{verticalAlign:'-2px'}}/> {server.name}</strong><br/><small>{server.host}:{server.port} · {server.latencyMs} ms · pronto</small></div>
            <Button disabled={busy} onClick={()=>applyServerConnection(server.baseUrl,'lan-client')}>Conectar</Button>
          </div>)}
        </div>}
      </>}

      {form.operationalMode==='remote'&&<div className="success-box" style={{marginBottom:12}}>
        <strong>Conexão remota segura.</strong><br/>
        <small>Use <strong>HTTPS</strong> para endereço público ou um endereço privado da VPN/WireGuard. HTTP público é bloqueado.</small>
      </div>}

      <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid var(--border-color, #dfe4ec)'}}>
        <strong>Conectar manualmente</strong>
        <Field label="Endereço do servidor">
          <input value={manualAddress} onChange={event=>{setManualAddress(event.target.value);setManualProbe(null)}} placeholder="192.168.1.50 ou obra-server.local"/>
        </Field>
        <small>{form.operationalMode==='remote'?<>Use <strong>https://servidor.seudominio.com</strong> ou um IP privado da VPN, como <strong>10.66.0.1:4732</strong>.</>:<>Pode ser <strong>192.168.1.50</strong>, <strong>obra-server.local</strong>, <strong>192.168.1.50:4810</strong> ou um endereço HTTPS autorizado.</>}</small>
        {manualProbe&&<div className="success-box" style={{marginTop:8}}>Servidor pronto: <strong>{manualProbe.baseUrl}</strong>{manualProbe.serverId?<> · ID {manualProbe.serverId}</>:null}.</div>}
        <div className="setting-actions" style={{marginTop:10}}>
          <Button variant="secondary" icon={<RefreshCw size={15}/>} disabled={busy||!manualAddress.trim()} onClick={testManualAddress}>Testar conexão</Button>
          <Button disabled={busy||!manualAddress.trim()} onClick={()=>applyServerConnection(manualAddress)}>Conectar</Button>
        </div>
      </div>
    </div>}

    <div className="setting-actions" style={{marginTop:10}}>
      {!['lan-client','remote'].includes(form.operationalMode)&&<Button disabled={busy} onClick={save}>Salvar configuração</Button>}
      {form.operationalMode==='lan-host'&&<Button variant="secondary" icon={<RefreshCw size={15}/>} disabled={dirty||busy} onClick={test}>Testar servidor</Button>}
    </div>
    <small>{form.operationalMode==='local'?'Modo padrão, totalmente local e offline.':form.operationalMode==='lan-host'?'O servidor usa um SQLite central neste PC e os outros computadores acessam pela API LAN; o arquivo SQLite nunca é compartilhado pela rede.':form.operationalMode==='remote'?'O servidor remoto usa a mesma API, autenticação, permissões e dados centrais. Endereço público exige HTTPS; HTTP é aceito somente em rede privada/VPN. Não existe fallback local silencioso.':'O Desktop só troca para o servidor depois que o endereço é validado. Se a conexão falhar, a configuração atual é preservada e não existe fallback local silencioso.'}</small>

    {(['core','operation','planning','finance','rh'] as ModuleKey[]).map(renderModule)}

    {isServerMode&&!dirty&&<div style={{marginTop:16,borderTop:'1px solid var(--border-color, #dfe4ec)',paddingTop:14}}>
      <div className="setting-actions" style={{justifyContent:'space-between'}}>
        <strong>Autorização da rede</strong>
        <div className="setting-actions">
          {['lan-client','remote'].includes(form.operationalMode)&&<Button variant="secondary" icon={<Wifi size={14}/>} disabled={busy} onClick={reconnect}>Reconectar servidor</Button>}
          <Button variant="secondary" icon={<RefreshCw size={14}/>} disabled={busy} onClick={()=>refreshLan()}>Atualizar estado</Button>
        </div>
      </div>
      {form.operationalMode==='lan-host'&&<p><Status value={hostState?.running?'ativo':'inativo'}/> Processo servidor {hostState?.running?'em execução':'parado'}{hostState?.lastError?` — ${hostState.lastError}`:''}.</p>}
      {lanStatus&&<p>Servidor: <strong>{lanStatus.serverId||storage.data?.serverId||'—'}</strong> · {lanStatus.claimed?'vinculado à empresa':'ainda não reivindicado'} · Este PC: <strong>{paired?'pareado':'não pareado'}</strong>.</p>}

      {lanStatus&&!lanStatus.claimed&&<>
        {['lan-client','remote'].includes(form.operationalMode)&&<Field label="Código de configuração mostrado no servidor"><input value={setupCode} onChange={event=>setSetupCode(event.target.value.toUpperCase())} placeholder="XXXXX-XXXXX"/></Field>}
        <Button disabled={busy||!online.data?.linked||(form.operationalMode==='lan-host'&&!hostState?.setupCodeAvailable)||(['lan-client','remote'].includes(form.operationalMode)&&!setupCode.trim())} onClick={claim}>Autorizar servidor com minha conta Admin</Button>
        {!online.data?.linked&&<small>Vincule este Desktop em “Conexão Obra na Mão” antes de reivindicar o servidor. A mesma identidade Web/PWA será reutilizada.</small>}
        {form.operationalMode==='lan-host'&&!hostState?.setupCodeAvailable&&<small>O processo servidor ainda está inicializando. Clique em “Atualizar estado” em alguns segundos.</small>}
      </>}

      {lanStatus?.claimed&&!paired&&<>
        <Field label="Código de pareamento"><input value={pairCode} onChange={event=>setPairCode(event.target.value.toUpperCase())} placeholder="Código fornecido pelo Administrador"/></Field>
        <Button disabled={busy||!pairCode.trim()} onClick={pair}>Parear este computador</Button>
      </>}

      {paired&&<div style={{marginTop:10}}>
        <span className="status status-success"><ShieldCheck size={13}/> Computador autorizado</span>
        <p>Usuário: <strong>{lanStatus.credential.member?.name||lanStatus.credential.member?.email||lanStatus.credential.member?.memberId||'Usuário autorizado'}</strong> · Perfil: <strong>{lanStatus.credential.member?.role||'—'}</strong>.</p>
        <Button variant="secondary" icon={<Unplug size={14}/>} disabled={busy} onClick={disconnect}>Remover pareamento deste PC</Button>
      </div>}

      {form.operationalMode==='lan-host'&&<label style={{display:'flex',gap:8,alignItems:'center',marginTop:12}}><input type="checkbox" checked={startAtLogin} onChange={event=>toggleStartAtLogin(event.target.checked)}/> Iniciar o Obra na Mão com o Windows para manter o servidor disponível</label>}

      {isAdmin&&<div style={{marginTop:16,borderTop:'1px solid var(--border-color, #dfe4ec)',paddingTop:14}}>
        <strong>Administração do servidor</strong>
        <p>As funções e permissões vêm da conta Obra na Mão. Estar fisicamente no PC-servidor não concede acesso administrativo.</p>
        {adminStatus&&<small>Permissões Cloud: {adminStatus.stale?'última cópia local — Cloud temporariamente desatualizada':'atualizadas'}{adminStatus.lastCloudRefreshAt?` · ${new Date(adminStatus.lastCloudRefreshAt).toLocaleString('pt-BR')}`:''} · {adminStatus.deviceCount??devices.length} computador(es).</small>}
        <div className="setting-actions" style={{marginTop:10}}><Button variant="secondary" disabled={busy} onClick={refreshIdentity}>Atualizar permissões Cloud</Button></div>
        <div className="form-grid" style={{marginTop:12}}><Field label="E-mail de um usuário já autorizado"><input type="email" value={pairTarget} onChange={event=>setPairTarget(event.target.value)} placeholder="usuario@empresa.com"/></Field><div style={{alignSelf:'end'}}><Button disabled={busy||!pairTarget.trim()} onClick={createPairing}>Gerar código de pareamento</Button></div></div>
        {pairInvite&&<div className="success-box" style={{marginTop:10}}><strong>Código: {pairInvite.code}</strong><br/><small>Uso único; expira em {new Date(pairInvite.expiresAt).toLocaleTimeString('pt-BR')}.</small></div>}
        {!!devices.length&&<div className="table-wrap" style={{marginTop:12}}><table className="data-table"><thead><tr><th>Computador</th><th>Usuário</th><th>Status</th><th></th></tr></thead><tbody>{devices.map(device=><tr key={device.id}><td>{device.deviceName||device.installationId||device.id}</td><td>{device.memberId}</td><td><Status value={device.status==='active'?'ativo':'inativo'}/></td><td><Button variant="secondary" disabled={busy} onClick={()=>toggleDevice(device)}>{device.status==='active'?'Revogar':'Reativar'}</Button></td></tr>)}</tbody></table></div>}
      </div>}
    </div>}

    <div style={{marginTop:12}}><small><strong>Ordem segura:</strong> Cadastros-base → RDO/operação → Planejamento → Financeiro → RH. Cada bloco só muda para a fonte central depois de backup, cópia e validação explícitos.</small></div>
  </Card>
}