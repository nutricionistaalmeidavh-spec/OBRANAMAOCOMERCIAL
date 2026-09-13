import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root=resolve(import.meta.dirname,'..');
const read=(path:string)=>readFile(resolve(root,path),'utf8');

describe('corporate e-mail/password access contract',()=>{
  it('exposes password login, first access and password change through worker and pages',async()=>{
    const [auth,worker,pages]=await Promise.all([read('backend/corporate-password-auth.ts'),read('cloudflare/worker.ts'),read('functions/[[path]].ts')]);
    for(const route of ['/api/auth/password/login','/api/auth/password/first-access','/api/auth/password/change'])expect(auth).toContain(route);
    expect(worker).toContain('handleCorporatePasswordAuth');
    expect(pages).toContain('handleCorporatePasswordAuth');
  });

  it('keeps the first access code non-expiring but one-time and never stores plaintext passwords',async()=>{
    const auth=await read('backend/corporate-password-auth.ts');
    expect(auth).toContain('password_credentials');
    expect(auth).toContain('password_hash');
    expect(auth).not.toContain('password_expires');
    expect(auth).not.toContain('mustChangePassword');
    expect(auth).toContain('claimedBy');
    expect(auth).not.toContain('R7MV05HZROFX');
    expect(auth).not.toContain('lzM8bAHcqdJ#gHPkhX');
  });

  it('offers email/password and recoverable tenant onboarding while keeping Google available',async()=>{
    const [html,ui]=await Promise.all([read('sistema.html'),read('public/corporate-password-ui.js')]);
    expect(html).toContain('/corporate-password-ui.js');
    expect(html).toContain('/corporate-password.css');
    expect(ui).toContain('corporatePasswordLogin');
    expect(ui).toContain('corporateFirstAccessForm');
    expect(ui).toContain("post('/api/bootstrap/claim'");
    expect(ui).toContain("get('/api/bootstrap'");
  });
});
