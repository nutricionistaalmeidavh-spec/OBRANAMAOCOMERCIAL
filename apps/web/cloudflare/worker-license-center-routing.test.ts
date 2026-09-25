import { describe, expect, it } from 'vitest';
import { licenseCenterAdminWithRuntime } from './worker';

describe('license center worker routing',()=>{
  it('leaves GET bridge routes for the read-only handler instead of the write gateway',async()=>{
    const request=new Request('https://obra.test/api/internal/license-center/debora/observability/summary',{method:'GET'});
    expect(await licenseCenterAdminWithRuntime(request,{} as any)).toBeNull();
  });
});
