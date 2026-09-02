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
  const match=text.match(/export default ['"]([A-Za-z0-9+/=]+)['"];?\s*$/);
  if(!match)throw new Error(`Invalid learning-games data chunk: data-${name}.ts`);
  encoded+=match[1];
}
const source=gunzipSync(Buffer.from(encoded,'base64')).toString('utf8');
if(!source.includes('ALL_LEARNING_GAME_ACTIVITIES'))throw new Error('Generated learning-games runtime is incomplete.');
const generated=`/* AUTO-GENERATED at build time. Do not edit. */
export default function createLearningGamesRuntime(){
  return (function(){
${source}
  })();
}
`;
await writeFile(resolve(srcDir,'learning-games-runtime.generated.ts'),generated,'utf8');
console.log(`Learning games runtime generated (${generated.length} chars).`);
