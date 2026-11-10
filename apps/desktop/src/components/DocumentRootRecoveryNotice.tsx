import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'
import { ROUTES } from '../routes/registry'

/** Global, non-destructive recovery for disconnected network document roots. */
export default function DocumentRootRecoveryNotice(){
  const health=useAsync(()=>window.fluxoDre.documentos.rootStatus(),[])
  const [checking,setChecking]=useState(false)
  if(!health.data||health.data.ready)return null
  const central=health.data.source==='server'
  const title=central?'Documentos centrais indisponíveis':'Pasta de documentos indisponível'

  const retry=async()=>{
    setChecking(true)
    try{await window.fluxoDre.documentos.retryRoot();await health.reload()}
    finally{setChecking(false)}
  }
  return <aside role="alert" aria-label={title} style={{margin:'12px 20px',padding:'14px 16px',borderRadius:12,border:'1px solid #d7a73c',background:'#fff7df',color:'#674500'}}>
    <strong>{title}</strong>
    <p style={{margin:'6px 0'}}>{central?health.data.message:'O Obra na Mão continua funcionando, mas os documentos armazenados nessa pasta só poderão ser acessados quando a conexão for restabelecida. Nenhum caminho ou arquivo foi substituído.'}</p>
    <p style={{margin:'6px 0',overflowWrap:'anywhere'}}><small>{central?'Servidor da empresa':'Local configurado'}: {health.data.root}</small></p>
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      <button type="button" onClick={()=>void retry()} disabled={checking}>{checking?'Verificando...':central?'Verificar conexão':'Tentar reconectar pasta'}</button>
      <Link to={ROUTES.systemSettings}>{central?'Ver configurações da conexão':'Configurar pasta em Dados e proteção'}</Link>
      {health.error&&<small>Não foi possível verificar novamente. Tente mais tarde.</small>}
    </div>
  </aside>
}
