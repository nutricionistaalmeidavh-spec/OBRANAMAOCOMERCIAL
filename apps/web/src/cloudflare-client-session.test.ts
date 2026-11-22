// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from './cloudflare-client';

describe('Authenticated web session', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shares a single server verification for concurrent consumers', async () => {
    const fetchSpy=vi.spyOn(globalThis,'fetch').mockResolvedValue(
      new Response(JSON.stringify({user:{userId:'u1',email:'a@example.test'}}),{
        status:200,headers:{'content-type':'application/json'}
      })
    );
    const [first,second,third]=await Promise.all([auth.getUser(),auth.getUser(),auth.hasSession()]);
    expect(first?.userId).toBe('u1');
    expect(second?.userId).toBe('u1');
    expect(third).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
