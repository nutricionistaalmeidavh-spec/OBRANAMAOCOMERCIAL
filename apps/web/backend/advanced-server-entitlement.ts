import type {CompanyStorageTopology} from './company-storage-topology'

/** Existing remote installations keep their original server identity after the commercial gate is introduced. */
export function assertAdvancedServerEntitlement(
  requested:{mode:string;serverId?:string|null},
  enabled:boolean,
  current:Pick<CompanyStorageTopology,'mode'|'serverId'>
):void{
  if(requested.mode!=='remote'||enabled===true)return
  const existing=current.mode==='remote'&&Boolean(current.serverId)&&
    String(current.serverId)===String(requested.serverId||'')
  if(!existing)throw new Error('Servidor próprio exige o adicional de licença Advanced Server. Contate a ArtiSys para habilitar.')
}
