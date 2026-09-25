import { describe, expect, it } from 'vitest';
import { compareGlobalSaleKey, decodeGlobalSalesCursor, encodeGlobalSalesCursor, fetchDeboraObservability } from './debora-observability-admin';

describe('Debora observability server-to-server contract',()=>{
  it('sends the dedicated secret only through the service binding',async()=>{
    let captured:Request|null=null;
    const env:any={
      DB:{},DEBORA_OBSERVABILITY_SECRET:'test-secret',
      DEBORA_OBSERVABILITY:{fetch:async(input:RequestInfo|URL)=>{captured=input instanceof Request?input:new Request(input);return new Response(JSON.stringify({items:[]}),{headers:{'content-type':'application/json'}})}},
    };
    const data=await fetchDeboraObservability('/api/internal/observability/users?cursor=abc',env);
    expect(data).toEqual({items:[]});
    expect(captured).not.toBeNull();
    expect(captured!.headers.get('x-debora-observability-secret')).toBe('test-secret');
    expect(new URL(captured!.url).pathname).toBe('/api/internal/observability/users');
    expect(new URL(captured!.url).searchParams.get('cursor')).toBe('abc');
  });

  it('fails closed when binding or secret is unavailable',async()=>{
    await expect(fetchDeboraObservability('/api/internal/observability/summary',{DB:{}} as any)).rejects.toThrow(/debora_observability_unavailable/);
  });

  it('uses deterministic global sale order and round-trips its cursor',()=>{
    const items=[
      {id:'M1',createdAt:'2026-09-25T12:00:00Z',sourceRank:0},
      {id:'A1',createdAt:'2026-09-25T12:00:00Z',sourceRank:1},
      {id:'A0',createdAt:'2026-09-25T11:00:00Z',sourceRank:1},
      {id:'M2',createdAt:'2026-09-25T12:00:00Z',sourceRank:0},
      {id:'A2',createdAt:'2026-09-25T12:00:00Z',sourceRank:1},
    ];
    expect(items.sort(compareGlobalSaleKey).map(item=>item.id)).toEqual(['A2','A1','M2','M1','A0']);
    const cursor={createdAt:'2026-09-25T12:00:00Z',sourceRank:0,id:'M1'};
    expect(decodeGlobalSalesCursor(encodeGlobalSalesCursor(cursor))).toEqual(cursor);
    expect(()=>decodeGlobalSalesCursor('%%%')).toThrow(/invalid_cursor/);
  });
});
