import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const parity=JSON.parse(fs.readFileSync(path.join(root,'qa/admin-parity-capabilities.json'),'utf8'));
const ui=JSON.parse(fs.readFileSync(path.join(root,'qa/ui-capability-matrix.json'),'utf8'));

function files(dir:string):string[]{return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)])}
function ownerRoutes(){
  const routes=new Set<string>();
  for(const file of files(path.join(root,'backend')).filter(file=>file.endsWith('.ts')&&!file.endsWith('.test.ts'))){
    const text=fs.readFileSync(file,'utf8');
    for(const match of text.matchAll(/['"](GET|POST|PUT|PATCH|DELETE) (\/api\/owner\/[^'"]+)['"]/g))routes.add(`${match[1]} ${match[2]}`);
  }
  return [...routes].sort();
}

describe('admin parity capability registry',()=>{
  it('classifies every owner admin route and requires explicit general-panel parity',()=>{
    const uiRoutes=new Set(ui.entries.flatMap((entry:any)=>entry.backend||[]));
    const registryRoutes=new Set(parity.capabilities.flatMap((entry:any)=>entry.authorityRoutes||[]));
    const missing=ownerRoutes().filter(route=>!uiRoutes.has(route)&&!registryRoutes.has(route));
    expect(missing,'unclassified owner routes').toEqual([]);
    for(const entry of parity.capabilities){
      if(entry.generalPanelRequired===false)expect(String(entry.reason||'').trim().length,entry.id).toBeGreaterThan(0);
      if(entry.generalPanelRequired===true)expect(String(entry.generalPanelCapability||'').trim().length,entry.id).toBeGreaterThan(0);
    }
  });
});
