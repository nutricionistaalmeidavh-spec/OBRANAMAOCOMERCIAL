import { Copy, Monitor, Plus, RefreshCw, ShieldCheck, UserRoundCog, Users } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Button, Card, Empty, ErrorState, Field, FormActions, Loading, Modal, Status } from './ui'

type Role='admin'|'foreman'|'employee'
type PermissionDomain='core'|'operation'|'planning'|'finance'|'rh'
type PermissionAction='view'|'create'|'edit'|'delete'|'approve'
type PermissionMatrix=Record<PermissionDomain,PermissionAction[]>
type Member={
  id:string;email:string;name?:string;role:Role;employeeId?:string;userId?:string;joinCode?:string;status:'active'|'revoked';
  modules:string[];channels:string[];desktopStorage?:{mode:'lan-server'|'remote';serverId:string;autoEnroll?:boolean}|null;
  permissions?:PermissionMatrix|null;effectivePermissions?:PermissionMatrix;permissionsRevision?:string
}
type TeamData={
  members:Member[];
  companyAccess:{modules:string[];channels:string[]};
  storageTopology:{mode:'local-single'|'lan-server'|'remote';serverId?:string|null}
}
type Employee={id:string|number;nome?:string;name?:string}
type Device={id:string;name:string;platform?:string;email?:string;status:'active'|'revoked';lastSeenAt?:string}

const MODULE_LABELS:Record<string,string>={finance:'Financeiro',rh:'RH',contracts:'Contratos',rdo:'RDO',obra360:'Obra360',dre:'DRE',procurement:'Compras',measurements:'Medições',documents:'Documentos',universidade:'Universidade',ai:'IA'}
const CHANNEL_LABELS:Record<string,string>={mobile:'Web / celular',desktop:'Desktop'}
const DOMAIN_LABELS:Record<PermissionDomain,string>={core:'Cadastros',operation:'Operação / RDO',planning:'Planejamento',finance:'Financeiro',rh:'RH'}
const ACTION_LABELS:Record<PermissionAction,string>={view:'Ver',create:'Criar',edit:'Editar',delete:'Excluir',approve:'Aprovar'}
const ACTIONS:PermissionAction[]=['view','create','edit','delete','approve']
const EMPTY=():PermissionMatrix=>({core:[],operation:[],planning:[],finance:[],rh:[]})
const ROLE_MODULES:Record<Role,string[]>={admin:Object.keys(MODULE_LABELS),foreman:['obra360','rdo'],employee:['obra360']}
const ROLE_CHANNELS:Record<Role,string[]>={admin:['desktop','mobile'],foreman:['mobile'],employee:['mobile']}
const ROLE_PERMISSIONS:Record<Role,PermissionMatrix>={
  admin:{core:[...ACTIONS],operation:[...ACTIONS],planning:[...ACTIONS],finance:[...ACTIONS],rh:[...ACTIONS]},
  foreman:{core:['view','create','edit'],operation:['view','create','edit','approve'],planning:['view','edit'],finance:[],rh:[]},
  employee:{core:['view'],operation:['view','create'],planning:['view'],finance:[],rh:[]}
}

function roleLabel(role:Role){return role==='admin'?'Admin':role==='foreman'?'Encarregado':'Funcionário'}
function memberStatus(member:Member){return member.status==='revoked'?'Revogado':member.userId?'Ativo':'Aguardando primeiro acesso'}
function employeeLabel(employee:Employee){return employee.nome||employee.name||String(employee.id)}
function normalizePermissionMatrix(value?:Record<string,string[]>|PermissionMatrix|null):PermissionMatrix{
  const out=EMPTY()
  if(!value)return out
  for(const domain of Object.keys(out) as PermissionDomain[]){
    out[domain]=(value[domain]||[]).filter(action=>ACTIONS.includes(action as PermissionAction)) as PermissionAction[]
  }
  return out
}
function cleanPermissions(value:PermissionMatrix,modules:string[]):PermissionMatrix{
  const out=EMPTY(),enabled=(domain:PermissionDomain)=>domain==='core'||domain==='planning'?modules.includes('obra360'):domain==='operation'?modules.includes('obra360')||modules.includes('rdo'):domain==='finance'?modules.includes('finance')||modules.includes('dre'):modules.includes('rh')
  for(const domain of Object.keys(out) as PermissionDomain[]){
    if(!enabled(domain))continue
    out[domain]=value[domain].filter(action=>domain!=='finance'||modules.includes('finance')||action==='view')
  }
  return out
}

export default function TeamAccessSettings({onMessage}:{onMessage:(message:string)=>void}){
  const [team,setTeam]=useState<TeamData|null>(null)
  const [employees,setEmployees]=useState<Employee[]>([])
  const [devices,setDevices]=useState<Device[]>([])
  const [sessionRole,setSessionRole]=useState<string>('')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<Error|null>(null)
  const [editing,setEditing]=useState<Member|null|undefined>(undefined)
  const [busy,setBusy]=useState(false)
  const [email,setEmail]=useState('')
  const [role,setRole]=useState<Role>('employee')
  const [employeeId,setEmployeeId]=useState('')
  const [modules,setModules]=useState<string[]>([])
  const [channels,setChannels]=useState<string[]>([])
  const [permissions,setPermissions]=useState<PermissionMatrix>(ROLE_PERMISSIONS.employee)
  const [customPermissions,setCustomPermissions]=useState(false)

  const load=async()=>{
    setLoading(true);setError(null)
    try{
      const session=await window.fluxoDre.online.session()
      setSessionRole(String(session?.role||''))
      if(session?.role!=='admin'){setTeam(null);setDevices([]);return}
      const [teamData,localEmployees,deviceData]=await Promise.all([
        window.fluxoDre.online.membersList(),
        window.fluxoDre.funcionarios.list(),
        window.fluxoDre.online.companyDevices()
      ])
      setTeam({
        ...teamData,
        members:teamData.members.map(member=>({
          ...member,
          permissions:member.permissions?normalizePermissionMatrix(member.permissions):null,
          effectivePermissions:member.effectivePermissions?normalizePermissionMatrix(member.effectivePermissions):undefined
        }))
      })
      setEmployees((localEmployees||[]) as Employee[])
      setDevices(deviceData?.devices||[])
    }catch(cause){setError(cause as Error)}
    finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[])

  const desktopDisabled=team?.storageTopology.mode==='local-single'||!team?.companyAccess.channels.includes('desktop')
  const devicesByEmail=useMemo(()=>{
    const map=new Map<string,Device[]>()
    for(const device of devices){const key=String(device.email||'').trim().toLowerCase();if(!key)continue;map.set(key,[...(map.get(key)||[]),device])}
    return map
  },[devices])

  const openEditor=(member?:Member)=>{
    const nextRole=member?.role||'employee'
    const availableModules=team?.companyAccess.modules||[]
    const availableChannels=team?.companyAccess.channels||[]
    setEditing(member||null)
    setEmail(member?.email||'')
    setRole(nextRole)
    setEmployeeId(member?.employeeId||'')
    setModules((member?.modules?.length?member.modules:ROLE_MODULES[nextRole]).filter(value=>availableModules.includes(value)))
    setChannels((member?.channels?.length?member.channels:ROLE_CHANNELS[nextRole]).filter(value=>availableChannels.includes(value)&&!(value==='desktop'&&desktopDisabled)))
    const nextPermissions=member?.permissions?normalizePermissionMatrix(member.permissions):ROLE_PERMISSIONS[nextRole]
    setPermissions(nextPermissions)
    setCustomPermissions(Boolean(member?.permissions&&JSON.stringify(nextPermissions)!==JSON.stringify(ROLE_PERMISSIONS[nextRole])))
  }

  const closeEditor=()=>setEditing(undefined)
  const toggle=(value:string,current:string[],set:(next:string[])=>void)=>set(current.includes(value)?current.filter(item=>item!==value):[...current,value])
  const changeRole=(next:Role)=>{
    setRole(next)
    const availableModules=team?.companyAccess.modules||[],availableChannels=team?.companyAccess.channels||[]
    setModules(ROLE_MODULES[next].filter(value=>availableModules.includes(value)))
    setChannels(ROLE_CHANNELS[next].filter(value=>availableChannels.includes(value)&&!(value==='desktop'&&desktopDisabled)))
    setPermissions(ROLE_PERMISSIONS[next])
    setCustomPermissions(false)
    if(next!=='employee')setEmployeeId('')
  }
  const togglePermission=(domain:PermissionDomain,action:PermissionAction)=>{
    setCustomPermissions(true)
    setPermissions(current=>({...current,[domain]:current[domain].includes(action)?current[domain].filter(item=>item!==action):[...current[domain],action]}))
  }

  const save=async(event:FormEvent)=>{
    event.preventDefault()
    if(!email.trim())return onMessage('Informe o e-mail do colaborador.')
    if(role==='employee'&&!employeeId)return onMessage('Vincule o acesso a um funcionário cadastrado.')
    if(!modules.length)return onMessage('Selecione ao menos um módulo.')
    if(!channels.length)return onMessage('Selecione Web/celular e/ou Desktop.')
    setBusy(true)
    try{
      const result=await window.fluxoDre.online.memberSave({
        email:email.trim(),role,employeeId:employeeId||undefined,modules,channels,
        permissions:cleanPermissions(permissions,modules)
      })
      const code=result?.member?.joinCode
      onMessage(code?`Acesso salvo. Código de convite: ${code}`:'Acesso e permissões atualizados.')
      closeEditor();await load()
    }catch(cause){onMessage(cause instanceof Error?cause.message:'Não foi possível salvar o acesso.')}
    finally{setBusy(false)}
  }

  const copyInvite=async(member:Member)=>{
    if(!member.joinCode)return
    try{await navigator.clipboard.writeText(member.joinCode);onMessage('Código de convite copiado.')}
    catch{onMessage(`Código de convite: ${member.joinCode}`)}
  }

  const revokeDevice=async(device:Device)=>{
    setBusy(true)
    try{await window.fluxoDre.online.revokeCompanyDevice(device.id);onMessage(`${device.name||'Computador'} revogado.`);await load()}
    catch(cause){onMessage(cause instanceof Error?cause.message:'Não foi possível revogar o computador.')}
    finally{setBusy(false)}
  }

  const changeMemberStatus=async(member:Member)=>{
    const next=member.status==='revoked'?'active':'revoked'
    setBusy(true)
    try{
      await window.fluxoDre.online.memberStatus(member.id,next)
      onMessage(next==='revoked'?'Acesso do colaborador revogado. Os computadores dele também foram bloqueados.':'Acesso do colaborador reativado. Computadores revogados continuam bloqueados até nova autorização.')
      await load()
    }catch(cause){onMessage(cause instanceof Error?cause.message:'Não foi possível alterar o acesso do colaborador.')}
    finally{setBusy(false)}
  }

  if(loading)return <Card className="setting-card setting-card-wide"><Loading label="Carregando equipe e acessos..."/></Card>
  if(error)return <Card className="setting-card setting-card-wide"><ErrorState error={error} retry={()=>void load()}/></Card>
  if(sessionRole!=='admin')return <Card className="setting-card setting-card-wide"><ShieldCheck size={21}/><div className="setting-card-copy"><h3>Equipe e acessos</h3><p>Somente administradores podem criar colaboradores e alterar permissões.</p></div></Card>
  if(!team)return null

  return <>
    <Card className="setting-card setting-card-wide">
      <Users size={21}/>
      <div className="setting-card-copy">
        <h3>Equipe e acessos</h3>
        <p>Este é o mesmo cadastro de usuários usado pelo Web/PWA. Funções, módulos, canais e convites não são duplicados no Desktop.</p>
      </div>
      <div className="setting-actions"><Button icon={<Plus size={15}/>} onClick={()=>openEditor()}>Adicionar colaborador</Button><Button variant="secondary" icon={<RefreshCw size={15}/>} onClick={()=>void load()}>Atualizar</Button></div>
      {team.storageTopology.mode==='local-single'
        ?<div className="success-box"><strong>Desktop adicional indisponível.</strong> Esta empresa usa somente este computador. Para liberar Desktop a colaboradores, altere para “Vários computadores” na configuração de dados. O acesso Web / celular continua disponível.</div>
        :team.storageTopology.serverId
          ?<div className="success-box"><strong>Desktop vinculado ao servidor da empresa.</strong> Novos acessos Desktop herdam automaticamente o servidor <code>{team.storageTopology.serverId}</code>.</div>
          :null}
      {!team.members.length?<Empty title="Nenhum colaborador cadastrado" description="Adicione a primeira pessoa que poderá acessar esta obra."/>:
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Colaborador</th><th>Perfil</th><th>Acessos</th><th>Estado</th><th>Computadores</th><th></th></tr></thead><tbody>
          {team.members.map(member=>{
            const memberDevices=devicesByEmail.get(member.email.toLowerCase())||[]
            return <tr key={member.id}>
              <td><strong>{member.name||member.email}</strong>{member.name&&<small style={{display:'block'}}>{member.email}</small>}</td>
              <td>{roleLabel(member.role)}</td>
              <td>{member.channels.map(channel=>CHANNEL_LABELS[channel]||channel).join(' · ')||'—'}</td>
              <td><Status value={memberStatus(member)}/>{member.status!=='revoked'&&member.joinCode&&<div style={{marginTop:6}}><small>Código de convite: <strong>{member.joinCode}</strong></small> <Button type="button" variant="ghost" icon={<Copy size={13}/>} onClick={()=>void copyInvite(member)}>Copiar</Button></div>}</td>
              <td>{memberDevices.length?memberDevices.map(device=><div key={device.id} style={{display:'flex',gap:8,alignItems:'center',marginBottom:4}}><Monitor size={14}/><span>{device.name||'Computador'}</span><Status value={device.status}/>{device.status==='active'&&<Button type="button" variant="ghost" disabled={busy} onClick={()=>void revokeDevice(device)}>Revogar</Button>}</div>):<small>Nenhum</small>}</td>
              <td><div className="setting-actions"><Button type="button" variant="secondary" icon={<UserRoundCog size={14}/>} onClick={()=>openEditor(member)}>Gerenciar</Button><Button type="button" variant={member.status==='revoked'?'primary':'danger'} disabled={busy} onClick={()=>void changeMemberStatus(member)}>{member.status==='revoked'?'Reativar acesso':'Revogar acesso'}</Button></div></td>
            </tr>
          })}
        </tbody></table></div>}
    </Card>

    <Modal open={editing!==undefined} title={editing?'Gerenciar colaborador':'Adicionar colaborador'} onClose={closeEditor} size="xl">
      <form onSubmit={save}>
        <div className="modal-body" style={{display:'grid',gap:18}}>
          <div className="form-grid">
            <Field label="E-mail" required><input type="email" value={email} onChange={event=>setEmail(event.target.value)} readOnly={!!editing} placeholder="nome@empresa.com"/></Field>
            <Field label="Perfil" required><select value={role} onChange={event=>changeRole(event.target.value as Role)}><option value="employee">Funcionário</option><option value="foreman">Encarregado</option><option value="admin">Admin</option></select></Field>
            {role==='employee'&&<Field label="Vincular ao funcionário" required><select value={employeeId} onChange={event=>setEmployeeId(event.target.value)}><option value="">Selecione</option>{employees.map(employee=><option key={String(employee.id)} value={String(employee.id)}>{employeeLabel(employee)}</option>)}</select></Field>}
          </div>

          <div><strong>Módulos permitidos</strong><div className="checkbox-grid" style={{marginTop:8}}>{team.companyAccess.modules.map(module=><label key={module}><input type="checkbox" checked={modules.includes(module)} onChange={()=>toggle(module,modules,setModules)}/> {MODULE_LABELS[module]||module}</label>)}</div></div>

          <div><strong>Onde poderá acessar</strong><div className="checkbox-grid" style={{marginTop:8}}>{team.companyAccess.channels.map(channel=>{
            const disabled=channel==='desktop'&&desktopDisabled
            return <label key={channel} title={disabled?'Disponível quando a empresa usar Vários computadores':undefined}><input type="checkbox" data-team-channel={channel} checked={channels.includes(channel)} disabled={disabled} onChange={()=>toggle(channel,channels,setChannels)}/> {CHANNEL_LABELS[channel]||channel}</label>
          })}</div>{desktopDisabled&&<small>Desktop adicional indisponível neste modo. Web / celular pode ser liberado normalmente.</small>}</div>

          <div>
            <strong>Permissões recomendadas para {roleLabel(role)}</strong>
            <p className="path-text">O perfil escolhido já aplica o conjunto recomendado. Abra as opções abaixo somente se esta pessoa precisar de uma exceção.</p>
            <Button type="button" variant="ghost" onClick={()=>setCustomPermissions(value=>!value)}>{customPermissions?'Ocultar permissões avançadas':'Personalizar permissões'}</Button>
            {customPermissions&&<div className="table-wrap" style={{marginTop:10}}><table className="data-table"><thead><tr><th>Área</th>{ACTIONS.map(action=><th key={action}>{ACTION_LABELS[action]}</th>)}</tr></thead><tbody>{(Object.keys(DOMAIN_LABELS) as PermissionDomain[]).map(domain=><tr key={domain}><td>{DOMAIN_LABELS[domain]}</td>{ACTIONS.map(action=><td key={action}><input type="checkbox" aria-label={`${DOMAIN_LABELS[domain]} — ${ACTION_LABELS[action]}`} checked={permissions[domain].includes(action)} onChange={()=>togglePermission(domain,action)}/></td>)}</tr>)}</tbody></table><Button type="button" variant="secondary" onClick={()=>{setPermissions(ROLE_PERMISSIONS[role]);setCustomPermissions(false)}}>Usar permissões recomendadas para {roleLabel(role)}</Button></div>}
          </div>

          {channels.includes('desktop')&&team.storageTopology.serverId&&<div className="success-box"><strong>Desktop vinculado ao servidor da empresa.</strong> Ao usar o convite no Desktop, este usuário será direcionado automaticamente ao servidor <code>{team.storageTopology.serverId}</code>.</div>}
          {!editing&&<div className="success-box"><strong>Convite único.</strong> Ao salvar, o sistema gera um código de convite para este colaborador. Esse código entra em uma empresa existente e não ativa uma nova licença.</div>}
        </div>
        <FormActions onCancel={closeEditor} submitLabel={editing?'Salvar alterações':'Salvar e gerar convite'} loading={busy}/>
      </form>
    </Modal>
  </>
}