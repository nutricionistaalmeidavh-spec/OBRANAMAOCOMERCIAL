import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const credentialsFor=(baseUrl:string)=>({ token:(serverKey:string)=>serverKey===baseUrl?'lan-device-token':'' })

describe('LanDataClient migration protocol',()=>{
  it('usa endpoints autenticados de start record status validate commit e rollback',async()=>{
    const { LanDataClient }=require('./lan-data-client.cjs')
    const baseUrl='http://servidor:4732'
    const fetchImpl=vi.fn(async(_url:string,options:any)=>({ok:true,status:200,json:async()=>options?.body?JSON.parse(options.body):{status:'started'}}))
    const client=new LanDataClient({storage:{state:()=>({mode:'server',operationalMode:'lan-client',baseUrl})},credentials:credentialsFor(baseUrl),fetchImpl})

    await client.migrationStart({migrationId:'mig-1',module:'core',sourceFingerprint:'source-1',expectedCounts:{empresas:1}})
    await client.migrationRecord('mig-1',{sourceTable:'empresas',sourceId:1,data:{id:1,razao_social:'A'}})
    await client.migrationStatus('mig-1')
    await client.migrationValidate('mig-1')
    await client.migrationCommit('mig-1')
    await client.migrationRollback('mig-1')

    expect(fetchImpl.mock.calls.map(call=>[call[0],call[1].method])).toEqual([
      [`${baseUrl}/api/v1/migrations/start`,'POST'],
      [`${baseUrl}/api/v1/migrations/mig-1/record`,'POST'],
      [`${baseUrl}/api/v1/migrations/mig-1/status`,'GET'],
      [`${baseUrl}/api/v1/migrations/mig-1/validate`,'POST'],
      [`${baseUrl}/api/v1/migrations/mig-1/commit`,'POST'],
      [`${baseUrl}/api/v1/migrations/mig-1/rollback`,'POST']
    ])
    for(const [,options] of fetchImpl.mock.calls) expect(options.headers.Authorization).toBe('Bearer lan-device-token')
  })
})
