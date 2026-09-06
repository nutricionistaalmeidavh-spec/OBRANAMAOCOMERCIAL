import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot=resolve(import.meta.dirname,'..');
const read=(path:string)=>readFile(resolve(webRoot,path),'utf8');
const between=(source:string,start:string,end:string)=>source.slice(source.indexOf(start),source.indexOf(end));

describe('separated collaborator login',()=>{
  it('keeps phone authentication out of the corporate login surface',async()=>{
    const portal=await read('src/portal.ts');
    const corporate=between(portal,'function publicHome(){','function collaboratorHome(){');
    expect(corporate).toContain('#colaborador');
    expect(corporate).toContain('Acesso do colaborador');
    expect(corporate).not.toContain('id="phoneLogin"');
    expect(corporate).not.toContain('id="phoneIdentity"');
    expect(corporate).not.toContain('id="phoneFirst"');
  });

  it('provides a dedicated collaborator surface using the existing phone auth flow',async()=>{
    const portal=await read('src/portal.ts');
    const collaborator=between(portal,'function collaboratorHome(){','async function showFirstAccess(){');
    expect(collaborator).toContain('Acesso do colaborador');
    expect(collaborator).toContain('id="phoneLogin"');
    expect(collaborator).toContain('id="phoneIdentity"');
    expect(collaborator).toContain('id="phonePassword"');
    expect(collaborator).toContain('id="phoneFirst"');
    expect(collaborator).toContain('/api/edu/login');
    expect(collaborator).toContain('#portal');
    expect(collaborator).toContain('Acesso da empresa');
  });

  it('routes #colaborador explicitly and returns first-access users to that surface',async()=>{
    const portal=await read('src/portal.ts');
    expect(portal).toContain("location.hash==='#colaborador'");
    expect(portal).toContain("document.getElementById('backToLogin')?.addEventListener('click',collaboratorHome)");
  });

  it('styles the discreet login switch and documents the new entry route',async()=>{
    const [css,map]=await Promise.all([read('src/portal.css'),read('UI_ROUTE_MAP.md')]);
    expect(css).toContain('.cp-login-switch');
    expect(map).toContain('`#colaborador`');
    expect(map).toContain('Login exclusivo de colaborador');
  });
});
