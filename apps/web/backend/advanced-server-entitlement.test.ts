import { describe, expect, it } from 'vitest'
import { assertAdvancedServerEntitlement } from './advanced-server-entitlement'

describe('Servidor próprio como adicional comercial',()=>{
  const currentLocal={mode:'local-single' as const,serverId:null}
  const existingRemote={mode:'remote' as const,serverId:'server-legacy-001'}

  it('permite uso individual e LAN sem adicional',()=>{
    expect(()=>assertAdvancedServerEntitlement({mode:'local-single'},false,currentLocal)).not.toThrow()
    expect(()=>assertAdvancedServerEntitlement({mode:'lan-server',serverId:'server-local-001'},false,currentLocal)).not.toThrow()
  })
  it('bloqueia ativação remota mesmo em modo validateOnly, inclusive troca de servidor',()=>{
    expect(()=>assertAdvancedServerEntitlement({mode:'remote',serverId:'server-new-001'},false,currentLocal)).toThrow(/adicional|servidor próprio/i)
    expect(()=>assertAdvancedServerEntitlement({mode:'remote',serverId:'server-new-001'},false,existingRemote)).toThrow(/adicional|servidor próprio/i)
  })
  it('preserva topologia remota preexistente sem autorizar nova instalação',()=>{
    expect(()=>assertAdvancedServerEntitlement({mode:'remote',serverId:'server-legacy-001'},false,existingRemote)).not.toThrow()
  })
  it('permite novo servidor remoto quando a licença tem o adicional',()=>{
    expect(()=>assertAdvancedServerEntitlement({mode:'remote',serverId:'server-new-001'},true,currentLocal)).not.toThrow()
  })
})
