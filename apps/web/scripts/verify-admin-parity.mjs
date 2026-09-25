import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const parity=JSON.parse(fs.readFileSync(path.join(root,'qa/admin-parity-capabilities.json'),'utf8'));
const ui=JSON.parse(fs.readFileSync(path.join(root,'qa/ui-capability-matrix.json'),'utf8'));

function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)])}
function ownerRoutes(){
  const routes=new Set();
  for(const file of files(path.join(root,'backend')).filter(file=>file.endsWith('.ts')&&!file.endsWith('.test.ts'))){
    const text=fs.readFileSync(file,'utf8');
    for(const match of text.matchAll(/['"](GET|POST|PUT|PATCH|DELETE) (\/api\/owner\/[^'"]+)['"]/g))routes.add(`${match[1]} ${match[2]}`);
  }
  return [...routes].sort();
}

const uiRoutes=new Set(ui.entries.flatMap(entry=>entry.backend||[]));
const registryRoutes=new Set(parity.capabilities.flatMap(entry=>entry.authorityRoutes||[]));
const routes=ownerRoutes();
const missing=routes.filter(route=>!uiRoutes.has(route)&&!registryRoutes.has(route));
const invalid=parity.capabilities.filter(entry=>(entry.generalPanelRequired===false&&!String(entry.reason||'').trim())||(entry.generalPanelRequired===true&&!String(entry.generalPanelCapability||'').trim()));

if(missing.length){
  console.error('ADMIN_PARITY_UNCLASSIFIED_ROUTES');
  for(const route of missing)console.error(`- ${route}`);
}
if(invalid.length){
  console.error('ADMIN_PARITY_INVALID_CAPABILITIES');
  for(const entry of invalid)console.error(`- ${entry.id}`);
}
if(missing.length||invalid.length)process.exit(1);
console.log(`ADMIN_PARITY_OK contractVersion=${parity.contractVersion} routes=${routes.length}`);
