import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const { buildQaMatrix, runQaMatrix }=await import(pathToFileURL(path.join(root,'qa','runtime','src','matrix.js')).href);
const cases=buildQaMatrix({
  profiles:['quick'],
  environments:['local'],
  viewports:['desktop','tablet','mobile'],
});

const report=await runQaMatrix({
  cases,
  failFast:true,
  onCase:event=>{if(event.type==='start')console.log(`[P1 Central] ${event.case.id}`);},
  runner:async item=>{
    const result=spawnSync(process.execPath,[path.join(root,'scripts','run-artisys-qa.mjs'),item.profile],{
      cwd:root,
      env:{...process.env,ARTISYS_QA_ENVIRONMENT:item.environment,ARTISYS_QA_VIEWPORT:item.viewport},
      stdio:'inherit',
      shell:false,
    });
    if(result.error)throw result.error;
    if(result.status!==0)throw new Error(`${item.id} exited with code ${result.status}`);
    return {exitCode:result.status};
  },
});

const outDir=path.join(root,'qa-artifacts','p1-matrix');
await fs.mkdir(outDir,{recursive:true});
const outFile=path.join(outDir,'report.json');
await fs.writeFile(outFile,`${JSON.stringify(report,null,2)}\n`,'utf8');
console.log(`ARTISYS_QA_P1_MATRIX=${outFile}`);
if(report.status!=='passed')process.exitCode=1;
