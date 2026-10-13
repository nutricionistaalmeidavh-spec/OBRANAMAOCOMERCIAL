import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const base=(process.env.GUIDE_QA_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
mkdirSync('qa-evidence-guia',{recursive:true});
const browser=await chromium.launch({headless:true});
const contexts=[];
async function newPage(name,viewport){
 const ctx=await browser.newContext({viewport,deviceScaleFactor:1,locale:'pt-BR'});
 contexts.push(ctx);
 const page=await ctx.newPage();
 const res=await page.goto(base+'/guia/',{waitUntil:'networkidle'});
 assert.equal(res.status(),200,name+' loads /guia/');
 await page.locator('.group-card').first().waitFor();
 return page;
}
async function screenshot(page,name){
 await page.screenshot({path:'qa-evidence-guia/'+name+'.png',fullPage:true,animations:'disabled'});
}
try{
 const desktop=await newPage('Desktop',{width:1440,height:900});
 assert.match(await desktop.title(),/Do Prompt ao Software/);
 await screenshot(desktop,'01-desktop-indice-real');
 const start=desktop.getByRole('link',{name:/Começar pela primeira lição/});
 await start.click();
 await desktop.locator('#reader-body .lesson-step').first().waitFor();
 assert.equal(await desktop.locator('#reader-body .lesson-step').count(),5);
 assert.equal(await desktop.locator('#reader').getAttribute('data-theme'),'dark');
 assert.ok((await desktop.locator('#reader-body').innerText()).includes('Abra uma pasta vazia'));
 assert.ok(!(await desktop.locator('#reader-body').innerText()).includes('pipeline / app-preview'));
 await screenshot(desktop,'02-desktop-aula01-real');
 await desktop.goto(base+'/guia/#pagina-02',{waitUntil:'networkidle'});
 await desktop.locator('#reader-body .lesson-step').first().waitFor();
 assert.equal(await desktop.locator('#reader').getAttribute('data-theme'),'light');
 await screenshot(desktop,'03-desktop-aula02-clara-real');
 await desktop.goto(base+'/guia/#pagina-16',{waitUntil:'networkidle'});
 await desktop.locator('#reader-body .lesson-step').first().waitFor();
 assert.equal(await desktop.locator('#reader-body .lesson-step').count(),6);
 assert.ok((await desktop.locator('#reader-body').innerText()).includes('git remote'));
 assert.ok(await desktop.locator('.lesson-code').count()>=2);
 await screenshot(desktop,'04-desktop-aula16-git-real');
 await desktop.goto(base+'/guia/#pagina-20',{waitUntil:'networkidle'});
 await desktop.locator('#reader-body .lesson-code').first().waitFor();
 assert.ok((await desktop.locator('#reader-body').innerText()).includes('runs-on: ubuntu-latest'));
 const book=await desktop.request.get(base+'/guia/aulas/01-10.json');
 assert.equal(book.status(),200,'structured JSON is served as an asset');
 const content=await book.json();assert.equal(content.length,10);
 const mobile=await newPage('iPhone',{width:390,height:844});
 await screenshot(mobile,'05-mobile-indice-real');
 await mobile.locator('#menu-button').click();
 assert.equal(await mobile.locator('#sidebar').evaluate(el=>el.classList.contains('open')),true);
 await mobile.locator('.nav-page[href="#pagina-16"]').click();
 await mobile.locator('#reader-body .lesson-step').first().waitFor();
 assert.equal(await mobile.locator('#sidebar').evaluate(el=>el.classList.contains('open')),false);
 const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
 assert.equal(overflow,false,'no horizontal page overflow on mobile');
 await screenshot(mobile,'06-mobile-aula16-real');
 console.log('Guia Playwright QA passed: 40-page asset, deep lesson, alternating theme, mobile navigation and screenshots');
}finally{await Promise.all(contexts.map(c=>c.close()));await browser.close()}
