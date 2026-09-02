import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const target = new URL('../public/resources/question-assets-549.zip', import.meta.url);
const source = 'https://fluxodre-campo-b2u-clbfo5.v2.appdeploy.ai/resources/question-assets-549.zip';

async function existsLargeEnough(url) {
  try { return (await stat(url)).size > 1024 * 1024; } catch { return false; }
}

if (!(await existsLargeEnough(target))) {
  console.log('Restoring Universidade question image pack...');
  const response = await fetch(source, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Could not restore question assets: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1024 * 1024) throw new Error('Question asset package response is unexpectedly small.');
  await mkdir(dirname(target.pathname), { recursive: true });
  await writeFile(target, bytes);
  console.log(`Question image pack restored (${bytes.byteLength} bytes).`);
}
