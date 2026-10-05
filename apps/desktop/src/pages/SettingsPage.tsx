import { Cloud, DatabaseBackup, FolderCog, FolderOpen, HardHat, ListTree, PanelsTopLeft, RefreshCw, RotateCcw, ShieldCheck, Unplug, Wrench } from 'lucide-react'
import { ReactNode, useEffect, useState } from 'react'
import { useAsync } from '../hooks/useAsync'
import SyncSettings from '../components/SyncSettings'
import StorageServerSettings from '../components/StorageServerSettings'
import UpdaterSettingsCard from '../components/UpdaterSettingsCard'
import { Button, Card, PageHeader } from '../components/ui'

function SettingsGroup({title,description,children}:{title:string;description:string;children:ReactNode}){
  return <section className="settings-group">
    <div className="settings-group-heading"><div><h2>{title}</h2><p>{description}</p></div></div>
    <div className="settings-group-grid">{children}</div>
  </section>
}

export default function SettingsPage(){
  const boot=useAsync(()=>window.fluxoDre.app.bootstrap(),[])
  const online=useAsync(()=>window.fluxoDre.online.state(),[])
  const [message,setMessage]=useState('')
  const [onlineUrl,setOnlineUrl]=useState('')
  useEffect(()=>{if(online.data?.baseUrl)setOnlineUrl(online.data.baseUrl)},[online.data?.baseUrl])

  const saveOnlineUrl=async()=>{setMessage('Salvando endpoint online...');try{await window.fluxoDre.online.setBaseUrl(onlineUrl);await online.reload();setMessage('Endpoint online salvo. Se o endereço mudou, o vínculo anterior foi removido por segurança.')}catch(error:any){setMessage(error.message)}}
  const connectOnline=async()=>{setMessage('Abrindo autorização do Desktop no navegador...');try{await window.fluxoDre.online.start();await online.reload();setMessage('Autorize este computador no navegador e depois clique em Verificar autorização.')}catch(error:any){setMessage(error.message)}}
  const checkOnline=async()=>{setMessage('Verificando autorização...');try{const status=await window.fluxoDre.online.status();await online.reload();setMessage(status.linked?'Desktop vinculado com sucesso. Agora você pode testar a conexão online.':'A autorização ainda está pendente.')}catch(error:any){setMessage(error.message)}}
  const testOnline=async()=>{setMessage('Testando conexão online...');try{const session=await window.fluxoDre.online.session();setMessage(`Conexão online ativa${session?.company?.name?` — ${session.company.name}`:''}.`);await online.reload()}catch(error:any){setMessage(error.message)}}
  const disconnectOnline=async()=>{try{await window.fluxoDre.online.disconnect();await online.reload();window.location.reload()}catch(error:any){setMessage(error.message)}}
  const changeLayout=async(layout:'command-center'|'classic')=>{if(layout===boot.data?.layout)return;setMessage('Aplicando layout...');try{await window.fluxoDre.app.setLayout(layout);window.location.reload()}catch(error:any){setMessage(error.message)}}
  const action=async(fn:()=>Promise<any>,success:string)=>{setMessage('Processando...');try{const result=await fn();setMessage(result?success:'Operação cancelada.');await boot.reload()}catch(error:any){setMessage(error.message)}}

  return <>
    <PageHeader title="Configurações" description="Conectividade, armazenamento, proteção, preferências e manutenção do aplicativo."/>

    <SettingsGroup title="Dados e conectividade" description="Defina onde os dados operacionais vivem e como este Desktop se conecta aos demais canais.">
      <SyncSettings/>
      <StorageServerSettings onMessage={setMessage}/>
      <Card className="setting-card setting-card-wide">
        <Cloud size={21}/>
        <div className="setting-card-copy">
          <h3>Conexão Obra na Mão</h3>
          <p>{online.data?.linked?'Este Desktop está vinculado ao ambiente online configurado.':online.data?.pending?'Aguardando autorização pelo navegador.':'Vincule este computador ao ambiente online da empresa.'}</p>
        </div>
        <span className={`status ${online.data?.linked?'status-success':''}`}>{online.data?.linked?'Online vinculado':online.data?.pending?'Autorização pendente':'Não vinculado'}</span>
        <div className="setting-inline-form">
          <input value={onlineUrl} onChange={e=>setOnlineUrl(e.target.value)} placeholder="https://seu-projeto.workers.dev" aria-label="Endpoint online"/>
          <Button variant="secondary" onClick={saveOnlineUrl}>Salvar endpoint</Button>
        </div>
        <div className="setting-actions">
          {!online.data?.linked&&!online.data?.pending&&<Button onClick={connectOnline}>Vincular computador</Button>}
          {online.data?.pending&&<Button icon={<RefreshCw size={15}/>} onClick={checkOnline}>Verificar autorização</Button>}
          {online.data?.linked&&<><Button onClick={testOnline}>Testar conexão</Button><Button variant="secondary" icon={<Unplug size={15}/>} onClick={disconnectOnline}>Desconectar</Button></>}
        </div>
        <small className="path-text">{online.data?.baseUrl||'Carregando endpoint...'}</small>
      </Card>
    </SettingsGroup>

    <SettingsGroup title="Arquivos e proteção" description="Pasta documental, backup e proteções locais do Desktop.">
      <Card className="setting-card setting-card-wide">
        <FolderCog size={21}/>
        <div className="setting-card-copy"><h3>Pasta da documentação</h3><p className="path-text">{boot.data?.documentsPath||'Carregando localização...'}</p></div>
        <div className="setting-actions"><Button onClick={()=>action(()=>window.fluxoDre.documentos.chooseRoot(),'Pasta definida e estrutura espelhada.')}>Escolher pasta</Button><Button variant="secondary" icon={<FolderOpen size={15}/>} onClick={()=>window.fluxoDre.documentos.openFolder()}>Abrir</Button></div>
        <small>Todas as empresas, colaboradores e subpastas são criados neste local.</small>
      </Card>
      <Card className="setting-card setting-card-compact"><DatabaseBackup size={21}/><div className="setting-card-copy"><h3>Backup manual</h3><p>Cria uma cópia consistente do SQLite em uma pasta escolhida.</p></div><Button onClick={()=>action(()=>window.fluxoDre.backup.create(),'Backup criado com sucesso.')}>Criar backup</Button></Card>
      <Card className="setting-card setting-card-compact"><RotateCcw size={21}/><div className="setting-card-copy"><h3>Restaurar banco</h3><p>Cria uma cópia de segurança antes de substituir o banco atual.</p></div><Button variant="secondary" onClick={()=>action(()=>window.fluxoDre.backup.restore(),'Banco restaurado. Reinicie o aplicativo.')}>Restaurar</Button></Card>
      <Card className="setting-card setting-card-compact"><ShieldCheck size={21}/><div className="setting-card-copy"><h3>Segurança local</h3><p>Context isolation ativo, renderer sem Node e banco restrito ao processo principal.</p></div><span className="status status-success">Proteções ativas</span></Card>
    </SettingsGroup>

    <SettingsGroup title="Preferências" description="Ajustes que mudam a experiência de uso sem alterar os dados da empresa.">
      <Card className="setting-card setting-card-compact"><HardHat size={21}/><div className="setting-card-copy"><h3>Edição do produto</h3><p>{boot.data?.product?.edition==='empreiteira'?'Empreiteira: medições como receita e margem por frente.':'Construtora: foco em custo, contratado, pago e saldo por frente.'}</p></div><div className="setting-actions"><Button variant={boot.data?.product?.edition==='construtora'?'primary':'secondary'} onClick={()=>action(()=>window.fluxoDre.product.setEdition('construtora'),'Edição Construtora aplicada.')}>Construtora</Button><Button variant={boot.data?.product?.edition==='empreiteira'?'primary':'secondary'} onClick={()=>action(()=>window.fluxoDre.product.setEdition('empreiteira'),'Edição Empreiteira aplicada.')}>Empreiteira</Button></div></Card>
      <Card className="setting-card setting-card-compact"><PanelsTopLeft size={21}/><div className="setting-card-copy"><h3>Layout da interface</h3><p>{boot.data?.layout==='classic'?'Visual clássico com a navegação original.':'Command Center com navegação compacta e foco operacional.'}</p></div><div className="setting-actions"><Button variant={boot.data?.layout!=='classic'?'primary':'secondary'} onClick={()=>changeLayout('command-center')}>Command Center</Button><Button variant={boot.data?.layout==='classic'?'primary':'secondary'} onClick={()=>changeLayout('classic')}>Clássico</Button></div></Card>
    </SettingsGroup>

    <SettingsGroup title="Aplicativo" description="Atualização, versão instalada e ferramentas administrativas de suporte.">
      <UpdaterSettingsCard/>
      <details className="settings-support-tools">
        <summary><span><Wrench size={17}/><strong>Ferramentas de suporte</strong></span><small>Dados de demonstração e informações técnicas</small></summary>
        <div className="settings-support-content">
          <div className="support-tool-row">
            <div><strong>Dados de demonstração</strong><p>Cria uma obra fictícia para treinamento e validação. Use somente quando você quiser adicionar dados de teste ao ambiente atual.</p></div>
            <Button variant="secondary" onClick={()=>action(()=>window.fluxoDre.demo.seed(),'Dados fictícios carregados. Abra Obras, Frentes ou Medições para visualizar.')}>Carregar demo</Button>
          </div>
          <div className="support-facts">
            <div><small>Versão</small><strong>{boot.data?.version||'1.0.0'}</strong></div>
            <div><small>Banco de dados</small><strong className="path-text">{boot.data?.databasePath}</strong></div>
          </div>
        </div>
      </details>
    </SettingsGroup>

    {message&&<div className="success-box settings-feedback" role="status">{message}</div>}
  </>
}
