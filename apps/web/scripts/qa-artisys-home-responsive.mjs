import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const html=(await readFile(path.join(root,'index.html'),'utf8'))
  .replace(/<script[^>]*src="\/src\/landing-entry\.js"[^>]*><\/script>/g,'')
  .replace(/<link[^>]*href="https:\/\/fonts\.[^"]+"[^>]*>/g,'');
const cssFiles=[
  'artisys-landing.css',
  'artisys-refinement.css',
  'artisys-marketing-2026.css',
  'artisys-editorial-violet.css',
  'artisys-clarity-2026.css',
  'artisys-academy-feature.css',
  'artisys-home-section-polish.css',
];
const styles=(await Promise.all(cssFiles.map(name=>readFile(path.join(root,'src',name),'utf8')))).join('\n');
const artifacts=path.join(root,'qa-artifacts','academy-home');
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  for(const width of [320,375,390,768,1280]){
    const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page=await context.newPage();
    try {
      await page.setContent(html,{waitUntil:'domcontentloaded'});
      await page.addStyleTag({content:styles});
      const metrics=await page.locator('.academy-hero-pill').evaluate(link=>{
        const box=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,centerY:r.y+r.height/2};};
        const icon=link.querySelector('.academy-hero-pill-mark');
        const content=link.querySelector('.academy-hero-pill-content');
        const arrow=link.querySelector('.academy-hero-pill-arrow');
        return {
          link:box(link),icon:box(icon),content:box(content),arrow:box(arrow),
          cssDisplay:getComputedStyle(link).display,
          contentScrollWidth:content.scrollWidth,
          contentClientWidth:content.clientWidth,
          href:link.getAttribute('href')
        };
      });
      assert.equal(metrics.href,'/academy');
      assert.equal(metrics.cssDisplay,'grid',width+' Academy teaser must be a three-column grid');
      assert.ok(metrics.link.x>=0&&metrics.link.right<=width+1,width+' Academy teaser clipped horizontally');
      assert.ok(metrics.link.height<=92,width+' Academy teaser occupies too much height: '+metrics.link.height);
      assert.ok(Math.abs(metrics.icon.centerY-metrics.arrow.centerY)<=10,width+' Academy arrow fell out of its horizontal row');
      assert.ok(metrics.arrow.right<=metrics.link.right-5,width+' Academy arrow exceeds card bounds');
      assert.ok(metrics.contentScrollWidth<=metrics.contentClientWidth+2,width+' Academy label overflows');
      assert.ok(await page.locator('.academy-feature').count()===1,'Academy feature missing');
      const order=await page.evaluate(()=>{
        const feature=document.querySelector('.academy-feature');
        const devkit=document.querySelector('.devkit-feature');
        return feature.compareDocumentPosition(devkit)&Node.DOCUMENT_POSITION_FOLLOWING;
      });
      assert.ok(order,'Academy feature must precede DevKits');
      const visual=await page.evaluate(()=>{
        const element=(selector)=>document.querySelector(selector);
        const background=(selector)=>getComputedStyle(element(selector)).backgroundColor;
        const proof=element('.proof-journey').getBoundingClientRect();
        const word=element('.product-list-kind');
        const footer=element('.footer-links');
        const header=element('.header .nav').getBoundingClientRect();
        return {
          systemsBackground:background('.product-showcase'),
          proofBackground:background('.proof-journey'),
          proofHeight:proof.height,
          proofWidth:proof.width,
          proofItemCount:document.querySelectorAll('.proof-evidence-item').length,
          proofContainsLegacyCopy:element('.proof-journey').textContent.includes('CLIENTE ARTISYS'),
          proofOverflows:proof.scrollWidth>proof.clientWidth+1,
          proofItemsOverflow:[...document.querySelectorAll('.proof-evidence-item')].some(card=>card.scrollWidth>card.clientWidth+2),
          categoryWordBreak:getComputedStyle(word).wordBreak,
          categoryOverflowWrap:getComputedStyle(word).overflowWrap,
          firstCategoryHeight:word.getBoundingClientRect().height,
          firstCategoryLineHeight:parseFloat(getComputedStyle(word).lineHeight),
          devkitWhiteCopyCount:document.querySelectorAll('.devkit-feature .devkit-copy').length,
          devkitPanelCount:document.querySelectorAll('.devkit-feature .devkit-workbench').length,
          devkitPanelGradient:getComputedStyle(element('.devkit-feature .devkit-workbench')).backgroundImage,
          devkitCta:element('.devkit-workbench-cta')?.getAttribute('href'),
          devkitImageCount:document.querySelectorAll('.devkit-feature .devkit-feature-illustration img').length,
          devkitOverflow:(()=>{const d=element('.devkit-feature');return d.scrollWidth>d.clientWidth+2})(),
          footerMinimal:(()=>{const link=footer.querySelector('a[href*="tiktok.com"]');const style=getComputedStyle(link);return {background:style.backgroundColor,border:style.borderTopWidth}})(),
          footerCentral:footer.querySelector('.footer-link-central')?.getAttribute('href'),
          tiktok:footer.querySelector('a[href*="tiktok.com"]')?.getAttribute('href'),
          headerHeight:header.height
        };
      });
      assert.equal(visual.systemsBackground,'rgb(25, 35, 58)','system card should not be white');
      assert.equal(visual.proofBackground,'rgb(28, 38, 62)','social proof should use dark surface');
      assert.equal(visual.proofItemCount,3,'proof section should have exactly three facts');
      assert.equal(visual.proofContainsLegacyCopy,false,'old customer-case labels must be gone');
      assert.equal(visual.proofOverflows,false,'social proof container overflows viewport');
      assert.equal(visual.proofItemsOverflow,false,'social proof cards overflow');
      assert.equal(visual.devkitWhiteCopyCount,0,'DevKit white copy half should be removed');
      assert.equal(visual.devkitPanelCount,1,'DevKit must be a single image panel');
      assert.ok(visual.devkitPanelGradient.includes('linear-gradient'),'DevKit workbench should use dark gradient');
      assert.equal(visual.devkitCta,'/devkits/','DevKit CTA must reach catalog');
      assert.equal(visual.devkitImageCount,1,'DevKit should preserve one illustration');
      assert.equal(visual.devkitOverflow,false,'DevKit panel overflows its container');
      assert.equal(visual.footerMinimal.background,'rgba(0, 0, 0, 0)','footer links should not be filled cards');
      assert.equal(visual.footerMinimal.border,'0px','footer links should not have card borders');
      assert.equal(visual.footerCentral,'/links/','footer should link to the ArtiSys central');
      assert.equal(visual.tiktok,'https://www.tiktok.com/@artisysdev','TikTok must match canonical central');
      assert.ok(visual.headerHeight<=70,'mobile header exceeds compact target');
      if(width<=540){
        assert.ok(visual.firstCategoryHeight<=visual.firstCategoryLineHeight*1.3,width+' category wrapped mid-word');
        assert.ok(visual.proofHeight<520,width+' social proof section too tall: '+visual.proofHeight);
      }
      if(width===390 || width===1280){
        await page.screenshot({path:path.join(artifacts,'home-'+width+'.png'),animations:'disabled'});
        for(const name of ['devkit-feature','product-showcase','proof-journey','footer']){
          await page.locator('.'+name).screenshot({path:path.join(artifacts,name+'-'+width+'.png'),animations:'disabled'});
        }
      }
      console.log('PASS mobile marketing layout width='+width+' cardHeight='+Math.round(metrics.link.height));
    }finally{await context.close()}
  }
}finally{await browser.close()}
