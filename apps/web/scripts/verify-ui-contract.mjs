import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const required=[
  'index.html','obra.html','gestao.html','universidade.html',
  'public/icon.svg','public/icon-mh.svg','public/icon-obra.svg','public/icon-gestao.svg','public/icon-universidade.svg','public/field.css'
];

const failures=[];
for(const relative of required){
  try{await access(resolve(root,relative))}catch{failures.push('Arquivo obrigatório ausente: '+relative)}
}

for(const page of ['index.html','obra.html','gestao.html','universidade.html']){
  const html=await readFile(resolve(root,page),'utf8');
  if(!/<meta\s+name=["']viewport["']/i.test(html))failures.push(page+': meta viewport ausente');
}

const portal=await readFile(resolve(root,'src/portal.ts'),'utf8');
const main=await readFile(resolve(root,'src/main.ts'),'utf8');
const shell=await readFile(resolve(root,'src/university-shell.ts'),'utf8');

if(/id=["']platformCode["'][^>]*maxlength=["']8["']/.test(portal))failures.push('Portal ainda limita credencial da plataforma a 8 caracteres');
if(/\.\/guide\//.test(shell))failures.push('University shell referencia frames de guia inexistentes');
if(!portal.includes('APP_VERSION'))failures.push('Portal não exibe versão da aplicação');
if(!main.includes('PROJECT_STATE_VERSION'))failures.push('PWA não usa a versão compartilhada do estado da obra');
if(!shell.includes('APP_VERSION'))failures.push('Universidade não exibe versão da aplicação');

if(failures.length){
  console.error('UI contract failed:\n- '+failures.join('\n- '));
  process.exit(1);
}
console.log('UI contract verified: mobile viewport, required assets, 12-char activation and shared version markers.');
