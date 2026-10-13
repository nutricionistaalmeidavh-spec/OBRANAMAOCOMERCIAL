import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root=new URL('../public/guia/', import.meta.url);
const content=JSON.parse(readFileSync(new URL('conteudo.json',root),'utf8'));
const html=readFileSync(new URL('index.html',root),'utf8');
const js=readFileSync(new URL('guia.js',root),'utf8');
const css=readFileSync(new URL('guia.css',root),'utf8');
assert.equal(content.pages.length,40,'Guia precisa ter 40 lições');
for(let i=0;i<40;i++){
 const p=content.pages[i];
 assert.equal(p.number,i+1,'Índice contínuo da lição '+(i+1));
 assert.ok(p.title && p.blocks?.length>1,'Conteúdo suficiente na lição '+(i+1));
}
assert.equal(new Set(content.pages.map(p=>p.title)).size,40,'Títulos de lições devem ser únicos');
for(const part of ['reader','reader-body','reader-theme-toggle','lesson-goal','lesson-task','read-button','nav-backdrop','resume-button','search-results']){
 assert.match(html,new RegExp('id="'+part+'"'),'Elemento obrigatório: '+part);
}
assert.match(html,/href="#pagina-01" class="action-primary"/,'Começar deve abrir a primeira lição');
assert.match(html,/id="resume-button"[^>]+ hidden/,'Retomar só deve aparecer quando há histórico');
assert.match(js,/n%2===0\?'light':'dark'/,'Lições pares devem ter fundo claro');
assert.match(js,/reader\.dataset\.density/,'Páginas densas devem ajustar a composição');
assert.match(js,/reader-theme-toggle/,'Aluno deve poder mudar contraste durante a leitura');
assert.match(js,/state\.read\.delete/,'Conclusão deve ser reversível');
assert.match(css,/\.reader\[data-theme="light"\]/,'Tema claro ausente');
assert.match(css,/\.reader\[data-theme="dark"\]/,'Tema roxo escuro ausente');
assert.match(css,/@media\(max-width:760px\)/,'Estilo móvel ausente');
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/,'Respeito a movimento reduzido ausente');
console.log('Guia Artisys OK: 40 lições, alternância clara/roxa, jornada e acessibilidade estática.');
