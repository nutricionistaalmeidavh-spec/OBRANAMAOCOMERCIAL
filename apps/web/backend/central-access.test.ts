import { describe, expect, it } from 'vitest';
import { centralRoleForEmail } from './central-access';

const env={OWNER_EMAIL:'owner@example.test',DEBORA_CENTRAL_EMAIL:'debora@example.test'};

describe('Central ArtiSys: least-privilege product access',()=>{
  it('identifies primary owner separately from lactation administrator',()=>{
    expect(centralRoleForEmail(' OWNER@example.test ',env)).toBe('owner');
    expect(centralRoleForEmail('Debora@Example.Test',env)).toBe('debora');
  });
  it('denies unrelated, empty and unconfigured identities',()=>{
    expect(centralRoleForEmail('another@example.test',env)).toBeNull();
    expect(centralRoleForEmail('',env)).toBeNull();
    expect(centralRoleForEmail('debora@example.test',{OWNER_EMAIL:'owner@example.test'})).toBeNull();
  });
  it('cannot grant owner privileges by configuring the same email for both roles',()=>{
    expect(centralRoleForEmail('owner@example.test',{OWNER_EMAIL:'owner@example.test',DEBORA_CENTRAL_EMAIL:'owner@example.test'})).toBe('owner');
  });
});
