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
const source=process.env.QUESTION_IMAGES_LEGACY_ZIP_URL || 'https://fluxodre-campo-b2u-clbfo5.v2.appdeploy.ai/resources/question-assets-549.zip';
const EXPECTED=549;

const hash=(value)=>{
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
};
const questionId=(item)=>'q_'+hash(String(item.skill)+'-'+String(item.level)+'|'+String(item.prompt));

const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
if(!Array.isArray(manifest) || manifest.length!==EXPECTED){
  throw new Error('Expected '+EXPECTED+' visual records before migration, found '+(Array.isArray(manifest)?manifest.length:'invalid manifest'));
}

const response=await fetch(source,{redirect:'follow'});
if(!response.ok)throw new Error('Could not fetch one-time legacy visual pack: HTTP '+response.status);
const archive=new Uint8Array(await response.arrayBuffer());
const files=unzipSync(archive);
const byBase=new Map();
for(const [name,data] of Object.entries(files))byBase.set(basename(name),data);

await rm(outDir,{recursive:true,force:true});
await mkdir(outDir,{recursive:true});

const visualMap={};
const nextManifest=[];
const seenIds=new Set();
const seenFiles=new Set();

for(const item of manifest){
  const id=questionId(item);
  if(seenIds.has(id))throw new Error('Duplicate canonical question id: '+id);
  seenIds.add(id);

  const legacySrc=String(item.legacySrc||item.src||'');
  const sourceName=basename(legacySrc);
  if(!sourceName)throw new Error('Legacy source missing for '+String(item.id||id));
  if(seenFiles.has(sourceName))throw new Error('Duplicate legacy image source: '+sourceName);
  seenFiles.add(sourceName);

  const bytes=byBase.get(sourceName);
  if(!bytes)throw new Error('Missing image in one-time legacy pack: '+sourceName);

  const fileName=id+'.webp';
  const canonicalSrc='/question-images/'+fileName;
  await writeFile(resolve(outDir,fileName),bytes);

  const alt=String(item.alt||'Apoio visual complementar');
  nextManifest.push({
    ...item,
    questionId:id,
    legacySrc,
    src:canonicalSrc
  });
  visualMap[id]={
    id,
    sourceId:String(item.id||''),
    prompt:String(item.prompt||''),
    alt,
    src:canonicalSrc
  };
}

await writeFile(manifestPath,JSON.stringify(nextManifest,null,2)+'\n','utf8');
await writeFile(mapPath,JSON.stringify(visualMap,null,2)+'\n','utf8');
console.log('Migrated '+EXPECTED+' visuals to canonical ID-linked static assets.');
