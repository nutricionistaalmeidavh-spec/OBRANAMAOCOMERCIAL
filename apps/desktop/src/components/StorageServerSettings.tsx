import { RefreshCw, Server, ShieldCheck, Unplug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import { Button, Card, Field, Status } from './ui'

type Props={onMessage:(message:string)=>void}
type Mode='local'|'lan-host'|'lan-client'|'remote'
type Form={operationalMode:Mode;host:string;port:string}

export default function StorageServerSettings({onMessage}:Props){
  const storage=useAsync(()=>window.fluxoDre.storage.state(),[])
  const online=useAsync(()=>window.fluxoDre.online.state(),[])
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

  useEffect(()=>{if(storage.data)setForm({operationalMode:storage.data.operationalMode,host:storage.data.host,port:String(storage.data.port)})},[storage.data?.operationalMode,storage.data?.host,storage.data?.port])

  const refreshLan=async(mode:Mode=form.operationalMode)=>{
    if(mode==='local'){setLanStatus(null);setHostState(null);setAdminStatus(null);setDevices([]);return}
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
    }catch(error:any){setLanStatus(null);setAdminStatus(null);setDevices([]);onMessage(error.message)}
  }

  useEffect(()=>{if(storage.data&&storage.data.operationalMode!=='local')void refreshLan(storage.data.operationalMode as Mode)},[storage.data?.operationalMode,storage.data?.baseUrl])

  const effectiveHost=form.operationalMode==='lan-host'?'127.0.0.1':form.host
  const dirty=!!storage.data&&(form.operationalMode!==storage.data.operationalMode||effectiveHost!==storage.data.host||form.port!==String(storage.data.port))
  const isServerMode=form.operationalMode!=='local'
  const isAdmin=lanStatus?.credential?.member?.role==='admin'

  const changeMode=(mode:Mode)=>setForm(current=>({
    ...current,
    operationalMode:mode,
    host:mode==='lan-host'||mode==='local'?'127.0.0.1':(current.host==='127.0.0.1'?'':current.host)
  }))

  const save=async()=>{
    setBusy(true);onMessage('Salvando configuração de dados...')
    try{
      const saved=await window.fluxoDre.storage.configure({operationalMode:form.operationalMode,host:effectiveHost||'127.0.0.1',port:Number(form.port)})
      storage.setData(saved)
      if(saved.operationalMode==='local')onMessage('Dados configurados para permanecer somente neste computador.')
      else if(saved.operationalMode==='lan-host')onMessage('Este computador foi configurado como principal. Agora conclua a autorização do servidor abaixo.')
      else onMessage('Servidor da empresa salvo. Teste a conexão e faça o pareamento deste computador.')
      await refreshLan(saved.operationalMode as Mode)
    }catch(error:any){onMessage(error.message)}finally{setBusy(false)}
  }

  const test=async()=>{setBusy(true);onMessage('Testando servidor Obra na Mão...');try{const result=await window.fluxoDre.storage.testConnection();onMessage(`Servidor encontrado — ${result.baseUrl} (${result.latencyMs} ms).`);await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}

  const claim=async()=>{setBusy(true);onMessage('Autorizando o servidor com a conta Administrador atual...');try{const result=await window.fluxoDre.lan.claimHost(form.operationalMode==='lan-host'?undefined:setupCode);setSetupCode('');onMessage(`Servidor vinculado${result.company?.name?` à ${result.company.name}`:''}. Este computador recebeu sua credencial LAN.`);await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}

  const pair=async()=>{setBusy(true);onMessage('Pareando este computador...');try{await window.fluxoDre.lan.pair(pairCode);setPairCode('');onMessage('Computador pareado e autorizado no servidor da empresa.');await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}

  const disconnect=async()=>{setBusy(true);try{await window.fluxoDre.lan.disconnect();onMessage('Credencial LAN removida somente deste computador. A conta Web/PWA não foi alterada.');await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}

  const createPairing=async()=>{setBusy(true);try{const invite=await window.fluxoDre.lan.createPairing(pairTarget.trim());setPairInvite(invite);setPairTarget('');onMessage('Código temporário criado. Envie-o somente ao usuário/computador que será pareado.')}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}

  const toggleDevice=async(device:any)=>{setBusy(true);try{await window.fluxoDre.lan.setDeviceStatus(device.id,device.status==='active'?'revoked':'active');onMessage(device.status==='active'?'Computador revogado. O token deixa de acessar o servidor imediatamente.':'Computador reativado.');await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}

  const refreshIdentity=async()=>{setBusy(true);try{await window.fluxoDre.lan.refreshIdentity();onMessage('Usuários e permissões atualizados a partir do Obra na Mão Cloud.');await refreshLan()}catch(error:any){onMessage(error.message)}finally{setBusy(false)}}

  const toggleStartAtLogin=async(enabled:boolean)=>{try{const state=await window.fluxoDre.lan.setStartAtLogin(enabled);setStartAtLogin(state.enabled);onMessage(state.enabled?'Obra na Mão configurado para iniciar com o sistema.':'Inicialização automática desativada.')}catch(error:any){onMessage(error.message)}}

  return <Card className="setting-card setting-card-feature">
    <Server size={21} color="#2f67d8"/>
    <h3>Dados e servidor</h3>
    <p>Escolha onde o Desktop opera os dados suportados nesta etapa.</p>
    <div className="success-box" style={{margin:'10px 0'}}><strong>Web/PWA continua incluído.</strong> Login, PWA e a sincronização online que já fazem parte do Obra na Mão não são substituídos nem passam a exigir assinatura por causa desta configuração.</div>
    <Field label="Onde os dados operacionais ficarão?">
      <select value={form.operationalMode} disabled={storage.loading||busy} onChange={event=>changeMode(event.target.value as Mode)}>
        <option value="local">Somente neste computador</option>
        <option value="lan-host">Este computador é o principal / servidor local</option>
        <option value="lan-client">Conectar a um servidor da empresa</option>
        {form.operationalMode==='remote'&&<option value="remote" disabled>Servidor remoto próprio — etapa futura</option>}
      </select>
    </Field>

    {isServerMode&&<div className="form-grid" style={{marginTop:10}}>
      {form.operationalMode==='lan-client'&&<Field label="Endereço do servidor"><input value={form.host} onChange={event=>setForm({...form,host:event.target.value})} placeholder="192.168.0.10"/></Field>}
      <Field label="Porta"><input type="number" min="1" max="65535" value={form.port} onChange={event=>setForm({...form,port:event.target.value})}/></Field>
    </div>}

    <div className="setting-actions" style={{marginTop:10}}>
      <Button disabled={busy} onClick={save}>Salvar configuração</Button>
      {isServerMode&&<Button variant="secondary" icon={<RefreshCw size={15}/>} disabled={dirty||busy} onClick={test}>Testar servidor</Button>}
    </div>
    <small>{form.operationalMode==='local'?'Modo padrão, totalmente local e offline.':form.operationalMode==='lan-host'?'O servidor usa um SQLite central neste PC e os outros computadores acessam pela API LAN; o arquivo SQLite nunca é compartilhado pela rede.':'Informe o IP/host da máquina que executa o Obra na Mão Server. O banco permanece somente no servidor.'}</small>

    {isServerMode&&!dirty&&<div style={{marginTop:16,borderTop:'1px solid var(--border-color, #dfe4ec)',paddingTop:14}}>
      <div className="setting-actions" style={{justifyContent:'space-between'}}><strong>Autorização da rede</strong><Button variant="secondary" icon={<RefreshCw size={14}/>} disabled={busy} onClick={()=>refreshLan()}>Atualizar estado</Button></div>
      {form.operationalMode==='lan-host'&&<p><Status value={hostState?.running?'ativo':'inativo'}/> Processo servidor {hostState?.running?'em execução':'parado'}{hostState?.lastError?` — ${hostState.lastError}`:''}.</p>}
      {lanStatus&&<p>Servidor: <strong>{lanStatus.serverId||'—'}</strong> · {lanStatus.claimed?'vinculado à empresa':'ainda não reivindicado'} · Este PC: <strong>{lanStatus.credential?.paired?'pareado':'não pareado'}</strong>.</p>}

      {lanStatus&&!lanStatus.claimed&&<>
        {form.operationalMode==='lan-client'&&<Field label="Código de configuração mostrado no servidor"><input value={setupCode} onChange={event=>setSetupCode(event.target.value.toUpperCase())} placeholder="XXXXX-XXXXX"/></Field>}
        <Button disabled={busy||!online.data?.linked||(form.operationalMode==='lan-host'&&!hostState?.setupCodeAvailable)||(form.operationalMode==='lan-client'&&!setupCode.trim())} onClick={claim}>Autorizar servidor com minha conta Admin</Button>
        {!online.data?.linked&&<small>Vincule este Desktop em “Conexão Obra na Mão” antes de reivindicar o servidor. A mesma identidade Web/PWA será reutilizada.</small>}
        {form.operationalMode==='lan-host'&&!hostState?.setupCodeAvailable&&<small>O processo servidor ainda está inicializando. Clique em “Atualizar estado” em alguns segundos.</small>}
      </>}

      {lanStatus?.claimed&&!lanStatus?.credential?.paired&&<>
        <Field label="Código de pareamento"><input value={pairCode} onChange={event=>setPairCode(event.target.value.toUpperCase())} placeholder="Código fornecido pelo Administrador"/></Field>
        <Button disabled={busy||!pairCode.trim()} onClick={pair}>Parear este computador</Button>
      </>}

      {lanStatus?.credential?.paired&&<div style={{marginTop:10}}>
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

    <div style={{marginTop:12}}><small><strong>Escopo atual:</strong> Empresas, Clientes e Obras já usam o servidor. RDO, Planejamento, Financeiro, RH e demais módulos permanecem no comportamento atual até suas migrações específicas.</small></div>
  </Card>
}
