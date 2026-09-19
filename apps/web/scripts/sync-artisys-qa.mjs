import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtimeDir=path.join(repoRoot,'qa','runtime');
const lockFile=path.join(repoRoot,'qa','artisys-qa.lock.json');
const sourceRepository='https://github.com/nutricionistaalmeidavh-spec/utilidades.git';
const defaultRef = '4a138a9d77775f5be1e43244b9d45ca8586742c5';

function arg(name){const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:null}
function git(cwd,...args){return execFileSync('git',['-C',cwd,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).trim()}
function localSource(){
  const explicit=arg('--source')||process.env.ARTISYS_QA_SOURCE;
  const utilidadesPath=process.env.ARTISYS_UTILIDADES_PATH;
  if(explicit){
    if(!fs.existsSync(path.join(explicit,'package.json')))throw new Error(`ARTISYS_QA_SOURCE does not contain package.json: ${explicit}`);
    return explicit;
  }
  const candidates=[
    utilidadesPath?path.join(utilidadesPath,'modules','artisys-qa'):null,
    path.resolve(repoRoot,'..','..','..','utilidades','modules','artisys-qa'),
    path.resolve(repoRoot,'..','..','utilidades','modules','artisys-qa'),
    path.join(os.homedir(),'utilidades','modules','artisys-qa'),
  ].filter(Boolean);
  return candidates.find(candidate=>fs.existsSync(path.join(candidate,'package.json')))||null;
}
function cachedSource(ref){
  const cacheRoot=path.join(os.homedir(),'.artisys','cache','utilidades');
  if(!fs.existsSync(path.join(cacheRoot,'.git'))){
    fs.mkdirSync(path.dirname(cacheRoot),{recursive:true});
    execFileSync('git',['clone','--filter=blob:none','--no-checkout',sourceRepository,cacheRoot],{stdio:'inherit',windowsHide:true});
    git(cacheRoot,'sparse-checkout','init','--cone');
    git(cacheRoot,'sparse-checkout','set','modules/artisys-qa');
  }
  git(cacheRoot,'fetch','--depth','1','origin',ref);
  git(cacheRoot,'checkout','--detach','--force','FETCH_HEAD');
  const source=path.join(cacheRoot,'modules','artisys-qa');
  if(!fs.existsSync(path.join(source,'package.json')))throw new Error('Cached ArtiSys QA module was not found after checkout.');
  return source;
}
function shouldSkip(relative){
  const normalized=relative.split(path.sep).join('/');
  if(!normalized)return false;
  if(normalized==='node_modules'||normalized.startsWith('node_modules/'))return true;
  if(normalized==='test-results'||normalized.startsWith('test-results/'))return true;
  if(normalized==='playwright-report'||normalized.startsWith('playwright-report/'))return true;
  if(normalized==='bridge/projects.json')return true;
  if(/^bridge\/jobs\/pending\/.*\.json$/i.test(normalized))return true;
  return false;
}
function copyTree(source,destination,relative=''){
  fs.mkdirSync(destination,{recursive:true});
  for(const entry of fs.readdirSync(source,{withFileTypes:true})){
    const nextRelative=relative?path.join(relative,entry.name):entry.name;
    if(shouldSkip(nextRelative))continue;
    const from=path.join(source,entry.name);const to=path.join(destination,entry.name);
    if(entry.isDirectory())copyTree(from,to,nextRelative);else if(entry.isFile())fs.copyFileSync(from,to);
  }
}

const requestedRef=arg('--ref')||process.env.ARTISYS_QA_REF||defaultRef;
const source=localSource()||cachedSource(requestedRef);
const pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
if(pkg.name!=='@artisys/qa')throw new Error(`Unexpected QA package: ${pkg.name||'unknown'}`);
const sourceCommit=git(source,'rev-parse','HEAD');
const sourcePath=git(source,'rev-parse','--show-prefix').replace(/\\/g,'/').replace(/\/$/,'');
if(!sourcePath)throw new Error('Could not resolve ArtiSys QA path inside utilidades repository.');
const sourceTree=git(source,'rev-parse',`HEAD:${sourcePath}`);
let previous={};if(fs.existsSync(lockFile)){try{previous=JSON.parse(fs.readFileSync(lockFile,'utf8'))}catch{}}
if(previous.sourceTree===sourceTree&&fs.existsSync(path.join(runtimeDir,'src','cli.mjs'))){console.log(`@artisys/qa ${pkg.version} already synced (${sourceCommit.slice(0,12)}).`);process.exit(0)}
fs.rmSync(runtimeDir,{recursive:true,force:true});copyTree(source,runtimeDir);
fs.writeFileSync(path.join(runtimeDir,'artisys-qa.mjs'),"#!/usr/bin/env node\nimport './src/cli.mjs';\n",'utf8');
const lock={schemaVersion:2,module:'@artisys/qa',version:pkg.version,sourceRepository:'nutricionistaalmeidavh-spec/utilidades',requestedRef,sourcePath,sourceCommit,sourceTree,consumption:'full-vendored-runtime',policy:{consumerConfig:'qa/artisys-qa.config.json',runtimeSelection:'qaProfiles',ciNeedsSourceRepositoryAccess:false,excludedTransientState:['bridge/projects.json','bridge/jobs/pending/*.json']}};
fs.writeFileSync(lockFile,`${JSON.stringify(lock,null,2)}\n`,'utf8');
console.log(`Synced @artisys/qa ${pkg.version} from ${sourceCommit.slice(0,12)} (${sourceTree.slice(0,12)}).`);
