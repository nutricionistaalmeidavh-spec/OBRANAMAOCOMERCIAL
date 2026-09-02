import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const publicDir=resolve(root,'public');
const outDir=resolve(publicDir,'question-images');
const manifestPath=resolve(publicDir,'resources/question-visuals-manifest.json');
const mapPath=resolve(publicDir,'resources/question-visual-map.json');
const source='https://fluxodre-campo-b2u-clbfo5.v2.appdeploy.ai/resources/question-assets-549.zip';

const hash=(value)=>{
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
};
const questionId=(item)=>'q_'+hash(String(item.skill)+'-'+String(item.level)+'|'+String(item.prompt));

const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const response=await fetch(source,{redirect:'follow'});
if(!response.ok)throw new Error('Could not fetch legacy visual pack: HTTP '+response.status);
const archive=new Uint8Array(await response.arrayBuffer());
const files=unzipSync(archive);
const byBase=new Map();
for(const [name,data] of Object.entries(files))byBase.set(basename(name),data);

await rm(outDir,{recursive:true,force:true});
await mkdir(outDir,{recursive:true});

const visualMap={};
let written=0;
for(const item of manifest){
  const sourceName=basename(String(item.src||''));
  const bytes=byBase.get(sourceName);
  if(!bytes)throw new Error('Missing image in legacy pack: '+sourceName);
  const id=questionId(item);
  const fileName=id+'.webp';
  await writeFile(resolve(outDir,fileName),bytes);
  visualMap[id]={
    id,
    sourceId:String(item.id||''),
    prompt:String(item.prompt||''),
    alt:String(item.alt||'Apoio visual complementar'),
    src:'/question-images/'+fileName
  };
  written++;
}
await writeFile(mapPath,JSON.stringify(visualMap,null,2)+'\n','utf8');
console.log('Materialized '+written+' question images as direct static assets.');
