import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { createRemoteSyncOwnerService } from './remote-sync-owner'

class TestD1 {
  private db = new DatabaseSync(':memory:')
  constructor() {
    this.db.exec('CREATE TABLE kv_records(collection TEXT NOT NULL,id TEXT NOT NULL,record_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(collection,id))')
  }
  prepare(sql:string) {
    const db = this.db
    let params:unknown[] = []
    return {
      bind(...items:unknown[]){params=items;return this},
      async run(){const r=db.prepare(sql).run(...params as any[]);return {meta:{changes:Number(r.changes)}}},
      async first<T>(){return (db.prepare(sql).get(...params as any[])||null) as T|null}
    }
  }
  close(){this.db.close()}
}

describe('remote server one canonical PWA sync coordinator', () => {
  it('pins first authorized admin Desktop for company, project, and server', async () => {
    const db = new TestD1()
    try {
      const sync = createRemoteSyncOwnerService({db:db as any,nowMs:()=>Date.parse('2026-11-15T22:00:00Z')})
      const scope={companyId:'company-a',projectId:'project-01',serverId:'server-a12345'}
      expect(await sync.acquire({...scope,deviceId:'device-a'})).toMatchObject({owner:true,deviceId:'device-a'})
      expect(await sync.acquire({...scope,deviceId:'device-a'})).toMatchObject({owner:true,deviceId:'device-a'})
      expect(await sync.acquire({...scope,deviceId:'device-b'})).toMatchObject({owner:false,deviceId:'device-a'})
      expect(await sync.verify({...scope,deviceId:'device-a'})).toBe(true)
      expect(await sync.verify({...scope,deviceId:'device-b'})).toBe(false)
    } finally {db.close()}
  })
  it('does not silently hand the bridge to a different server or project', async () => {
    const db = new TestD1()
    try {
      const sync = createRemoteSyncOwnerService({db:db as any})
      const scope={companyId:'company-a',projectId:'project-01',serverId:'server-a12345'}
      await sync.acquire({...scope,deviceId:'device-a'})
      expect(await sync.acquire({...scope,serverId:'server-b12345',deviceId:'device-a'})).toMatchObject({owner:false})
      expect(await sync.verify({...scope,serverId:'server-b12345',deviceId:'device-a'})).toBe(false)
      expect(await sync.acquire({...scope,projectId:'project-02',deviceId:'device-b'})).toMatchObject({owner:true,deviceId:'device-b'})
      expect(await sync.acquire({...scope,companyId:'company-b',deviceId:'device-b'})).toMatchObject({owner:true,deviceId:'device-b'})
    } finally {db.close()}
  })
  it('rejects missing scope instead of granting a global coordinator', async () => {
    const db = new TestD1()
    try {
      const sync = createRemoteSyncOwnerService({db:db as any})
      await expect(sync.acquire({companyId:'',projectId:'p',serverId:'s',deviceId:'d'})).rejects.toThrow(/escopo/i)
      expect(await sync.verify({companyId:'',projectId:'p',serverId:'s',deviceId:'d'})).toBe(false)
    } finally {db.close()}
  })
})
