// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('web session verification',()=>{
  beforeEach(()=>{vi.resetModules();vi.unstubAllGlobals()});
  afterEach(()=>vi.unstubAllGlobals());

  it('shares an in-flight validation instead of sending duplicate auth/me requests',async()=>{
    let release!:(response:unknown)=>void;
    const request=vi.fn(()=>new Promise(resolve=>{release=resolve}));
    vi.stubGlobal('fetch',request);
    const {auth}=await import('./cloudflare-client');
    const first=auth.getUser();
    const second=auth.getUser();
    expect(request).toHaveBeenCalledTimes(1);
    release({ok:true,json:async()=>({user:{userId:'u1',email:'a@example.test'}})});
    const [a,b]=await Promise.all([first,second]);
    expect(a).toEqual({userId:'u1',email:'a@example.test'});
    expect(b).toEqual(a);
    expect(auth.isSignedIn()).toBe(true);
  });

  it('checks the server again on a subsequent entry rather than caching authorization',async()=>{
    const request=vi.fn().mockResolvedValue({ok:true,json:async()=>({user:{userId:'u1'}})});
    vi.stubGlobal('fetch',request);
    const {auth}=await import('./cloudflare-client');
    await auth.getUser();
    await auth.getUser();
    expect(request).toHaveBeenCalledTimes(2);
  });
});
