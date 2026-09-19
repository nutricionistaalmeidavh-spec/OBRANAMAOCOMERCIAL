import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const readJson=async(path:string)=>JSON.parse(await readFile(path,'utf8'));

const expectedFlows=['owner-shell','owner-overview','loja-online','clientes','licencas','auditoria','obra-regression','debora-regression'];

describe('Central Artisys shared QA P0 contract',()=>{
  it('declares quick/full/release scripts and keeps native gates in release',async()=>{
    const pkg=await readJson(resolve(root,'package.json'));
    for(const name of ['qa:prepare','qa:quick','qa:full','qa:p2','qa:release','qa:cross-system']){
      expect(typeof pkg.scripts?.[name]).toBe('string');
    }
    expect(pkg.scripts['qa:release']).toContain('qa:p2');
    const p2=await readFile(resolve(root,'scripts/qa-p2-release.mjs'),'utf8');
    expect(p2).toContain("npmCommand,['test']");
    expect(p2).toContain("['run','build']");
    expect(p2).toContain("['run','ux:verify']");
  });

  it('declares the owner-focused ArtiSys QA manifest and P0 flows',async()=>{
    const manifest=await readJson(resolve(root,'qa/artisys-qa.config.json'));
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.systemId).toBe('artisys-central-owner');
    expect(manifest.mode).toBe('web');
    expect(manifest.defaultEnvironment).toBe('local');
    expect(Object.keys(manifest.flows)).toEqual(expectedFlows);
    for(const profile of ['quick','full','release']){
      expect(Array.isArray(manifest.qaProfiles?.[profile]?.flows)).toBe(true);
      expect(manifest.qaProfiles[profile].flows.length).toBeGreaterThan(0);
    }
  });

  it('does not commit owner credentials or Loja Online licensing secret into QA JSON',async()=>{
    const files=[resolve(root,'qa/artisys-qa.config.json')];
    const flowDir=resolve(root,'qa/flows');
    for(const name of await readdir(flowDir)) if(name.endsWith('.json')) files.push(resolve(flowDir,name));
    for(const file of files){
      const text=await readFile(file,'utf8');
      expect(text).not.toContain('LOJAONLINE_LICENSE_SERVICE_SECRET=');
      expect(text).not.toMatch(/nutricionistaalmeidavh@gmail\.com/i);
    }
  });
});
