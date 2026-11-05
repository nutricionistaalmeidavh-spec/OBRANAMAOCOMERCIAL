import { Link } from 'react-router-dom'
import { useAsync } from '../hooks/useAsync'

export function RhMigrationNotice() {
  const storage = useAsync(() => window.fluxoDre.storage.moduleState('rh'), [])
  if (storage.data?.state !== 'migration-required') return null
  return <div className="notice" role="status">O RH ainda aguarda migração. Os funcionários e cargos exibidos estão preservados neste computador e ainda não foram publicados pelo servidor. <Link to="/configuracoes/sistema">Concluir migração nas Configurações</Link>.</div>
}
