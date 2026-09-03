import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const publicDir=resolve(root,'public');
let sha=String(process.env.GITHUB_SHA||process.env.CF_PAGES_COMMIT_SHA||process.env.CF_COMMIT_SHA||'').trim();
if(!sha){
  try{sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()}catch{sha='unknown'}
}
const payload={
  sha,
  shortSha:sha==='unknown'?'unknown':sha.slice(0,12),
  builtAt:new Date().toISOString(),
  service:'obra-na-mao-comercial'
};
await mkdir(publicDir,{recursive:true});
await writeFile(resolve(publicDir,'build-meta.json'),JSON.stringify(payload,null,2)+'\n','utf8');
console.log('Build metadata:',payload.shortSha);
