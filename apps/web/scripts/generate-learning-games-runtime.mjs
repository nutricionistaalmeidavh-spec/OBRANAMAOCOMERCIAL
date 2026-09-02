import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const srcDir=resolve(here,'../src');
let encoded='';
for(let i=1;i<=10;i++){
  const name=String(i).padStart(2,'0');
  const text=await readFile(resolve(srcDir,`learning-games-data/data-${name}.ts`),'utf8');
  const match=text.match(/^export default ['"]([\s\S]*?)['"];?\s*$/);
  if(!match)throw new Error(`Invalid learning-games data chunk wrapper: data-${name}.ts`);
  encoded+=match[1];
}

function tryDecode(candidate){
  try{
    const source=gunzipSync(Buffer.from(candidate,'base64')).toString('utf8');
    return source.length>1000?source:null;
  }catch{return null}
}

let source=tryDecode(encoded);
if(!source&&encoded.includes('�')){
  const positions=[];
  for(let i=0;i<encoded.length;i++)if(encoded[i]==='�')positions.push(i);
  if(positions.length!==1)throw new Error(`Cannot safely repair learning-games payload: ${positions.length} replacement characters found.`);
  const pos=positions[0],alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for(const ch of alphabet){
    const candidate=encoded.slice(0,pos)+ch+encoded.slice(pos+1);
    const decoded=tryDecode(candidate);
    if(decoded){
      source=decoded;
      console.log(`Repaired one corrupted base64 character at payload offset ${pos} with '${ch}'. Runtime size: ${decoded.length}.`);
      break;
    }
  }
}
if(!source)throw new Error('Could not decode learning-games runtime payload.');

const generated=`/* AUTO-GENERATED at build time. Do not edit. */
export default function createLearningGamesRuntime(){
  return (function(){
${source}
  })();
}
`;
await writeFile(resolve(srcDir,'learning-games-runtime.generated.ts'),generated,'utf8');
console.log(`Learning games runtime generated (${generated.length} chars).`);
