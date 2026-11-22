import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('P2 external-customer Google login browser QA contract',()=>{
  it('runs customer Google auth E2E as a critical release gate',async()=>{
    const script=await readFile(new URL('../scripts/qa-p2-release.mjs',import.meta.url),'utf8');
    expect(script).toContain("p2:google-customer-auth-e2e");
    expect(script).toContain("qa-google-customers-e2e.mjs");
    expect(script).toContain("googleCustomerAuth");
  });
  it('installs WebKit to emulate iOS Safari in the Web QA job',async()=>{
    const yaml=await readFile(new URL('../../../.github/workflows/commercial-cloudflare-ci.yml',import.meta.url),'utf8');
    expect(yaml).toContain('npx playwright install-deps webkit');
    expect(yaml).toContain('npx playwright install webkit');
  });
  it('distinguishes browser simulation from real OAuth production proof',async()=>{
    const script=await readFile(new URL('../scripts/qa-google-customers-e2e.mjs',import.meta.url),'utf8');
    expect(script).toContain('providerMocked:true');
    expect(script).toContain('realExternalGoogleAccountVerified:false');
    expect(script).toContain('iphone-webkit');
    expect(script).toContain('android-chromium');
    expect(script).toContain('desktop-chromium');
  });
});
