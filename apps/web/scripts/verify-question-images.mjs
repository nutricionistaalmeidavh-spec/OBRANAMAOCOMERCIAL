import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const publicDir=resolve(root,'public');
const outDir=resolve(publicDir,'question-images');
const manifestPath=resolve(publicDir,'resources/question-visuals-manifest.json');
const mapPath=resolve(publicDir,'resources/question-visual-map.json');
const EXPECTED=549;

const hash=(value)=>{
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
};
const questionId=(item)=>'q_'+hash(String(item.skill)+'-'+String(item.level)+'|'+String(item.prompt));

const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const visualMap=JSON.parse(await readFile(mapPath,'utf8'));
if(!Array.isArray(manifest))throw new Error('Question visual manifest must be an array');
if(manifest.length!==EXPECTED)throw new Error('Expected '+EXPECTED+' manifest records, found '+manifest.length);

const ids=new Set();
const sourceIds=new Set();
for(const item of manifest){
  const id=questionId(item);
  if(ids.has(id))throw new Error('Duplicate canonical question id: '+id);
  ids.add(id);

  const sourceId=String(item.id||'');
  if(!sourceId)throw new Error('Source question id missing for '+id);
  if(sourceIds.has(sourceId))throw new Error('Duplicate source question id: '+sourceId);
  sourceIds.add(sourceId);

  const expectedSrc='/question-images/'+id+'.webp';
  if(item.questionId!==id)throw new Error('Manifest questionId mismatch for '+sourceId);
  if(item.src!==expectedSrc)throw new Error('Manifest src mismatch for '+sourceId);

  const mapped=visualMap[id];
  if(!mapped)throw new Error('Visual map entry missing for '+id);
  if(mapped.src!==expectedSrc)throw new Error('Visual map src mismatch for '+id);
  if(String(mapped.sourceId||'')!==sourceId)throw new Error('Visual map sourceId mismatch for '+id);

  const info=await stat(resolve(outDir,id+'.webp'));
  if(!info.isFile() || info.size<32)throw new Error('Canonical image missing or empty for '+id);
}

const files=(await readdir(outDir)).filter(name=>name.endsWith('.webp'));
if(files.length!==EXPECTED)throw new Error('Expected '+EXPECTED+' canonical image files, found '+files.length);
if(Object.keys(visualMap).length!==EXPECTED)throw new Error('Expected '+EXPECTED+' visual-map entries, found '+Object.keys(visualMap).length);
for(const file of files){
  const id=file.slice(0,-5);
  if(!ids.has(id))throw new Error('Orphan canonical image: '+file);
}

console.log('Verified '+EXPECTED+' question IDs, '+EXPECTED+' map entries and '+EXPECTED+' canonical image files.');
