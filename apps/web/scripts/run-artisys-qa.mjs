import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const profile=String(process.argv[2]||'quick').toLowerCase();
if(!['quick','full','release'].includes(profile))throw new Error(`Unknown QA profile: ${profile}`);
const runtimeCli=path.join(root,'qa','runtime','artisys-qa.mjs');
if(!fs.existsSync(runtimeCli))throw new Error('ArtiSys QA runtime not prepared. Run npm run qa:prepare first.');
const environment=process.env.ARTISYS_QA_ENVIRONMENT||'production';
const args=[runtimeCli,profile,'--config',path.join(root,'qa','artisys-qa.config.json'),'--environment',environment,'--viewport',process.env.ARTISYS_QA_VIEWPORT||'desktop','--output',path.join(root,'qa-artifacts')];
const result=spawnSync(process.execPath,args,{cwd:root,env:process.env,stdio:'inherit',shell:false});
if(result.error)console.error(result.error);
process.exit(Number.isInteger(result.status)?result.status:1);
