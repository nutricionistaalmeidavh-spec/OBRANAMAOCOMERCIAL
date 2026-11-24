import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
describe('Central ArtiSys /links e Diagnóstico Gratuito atual',()=>{
 const links=read('../public/links/index.html');
 const html=read('../public/links/diagnostico/index.html');
 const js=read('../public/links/diagnostico/quick-diagnostic.js');
 const css=read('../public/links/diagnostico/diagnostico.css');
 const attribution=read('../public/links/diagnostic-attribution.js');
 it('mantém diagnóstico, vitrine de sistemas e Mercado Livre na Central',()=>{
   expect(links).toContain('href="/links/diagnostico/"');
   expect(links).toContain('data-link-id="diagnostico"');
   const nav=links.split('<nav class="destinations"')[1]?.split('</nav>')[0]||'';
   const ids=[...nav.matchAll(/class="link-card[^"]*"[^>]+data-link-id="([^"]+)"/g)].map(x=>x[1]);
   expect(ids).toEqual(['sistemas','mercado-livre']);
   expect((links.match(/data-link-id="diagnostico"/g)||[])).toHaveLength(1);
 });
 it('exibe diagnóstico compacto após os demais cards e antes dos canais sociais',()=>{
   const diagnosticIndex=links.indexOf('class="diagnostic-callout"');
   const systemsIndex=links.indexOf('data-link-id="sistemas"');
   const socialIndex=links.indexOf('class="social-nav"');
   expect(diagnosticIndex).toBeGreaterThan(0);
   const marketIndex=links.indexOf('data-link-id="mercado-livre"');
   expect(marketIndex).toBeGreaterThan(systemsIndex);
   expect(diagnosticIndex).toBeGreaterThan(marketIndex);
   expect(socialIndex).toBeGreaterThan(diagnosticIndex);
   const callout=links.split('class="diagnostic-callout"')[1]?.split('</section>')[0]||'';
   expect(callout).not.toContain('<p>');
   expect(callout).toContain('Iniciar diagnóstico gratuito');
   const motion=read('../public/links/links-motion.js');
   expect(motion).toContain('reveal(".diagnostic-callout"');
   expect(motion).toContain('destinationCards.forEach');
   expect(motion.indexOf('reveal(".diagnostic-callout"')).toBeGreaterThan(motion.indexOf('destinationCards.forEach'));
   expect(motion).toContain('prefers-reduced-motion: reduce');
 });
 it('transfere a origem do TikTok e UTM para o único formulário rápido',()=>{
   expect(links).toContain('src="/links/diagnostic-attribution.js" defer');
   expect(attribution).toContain('data-link-id="diagnostico"');
   expect(attribution).toContain('destination.searchParams.set(key, value.slice(0,120))');
   for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','video_tiktok'])
     expect(js).toContain(key);
 });
 it('exibe os dois caminhos e somente quatro campos sem ressuscitar perguntas antigas',()=>{
   expect(html).toContain('Sua empresa perde tempo com tarefas que poderiam ser automatizadas?');
   expect(html).toContain('Conversar pelo WhatsApp');
   expect(html).toContain('Solicitar avaliação rápida');
   expect(html).toContain('id="quick-diagnostic-form"');
   for(const name of ['name','company','contact','goal'])
     expect(html).toContain('name="'+name+'"');
   for(const removed of ['id="diagnostic-form"','id="full-diagnostic-panel"',
     'id="full-diagnostic-open"','class="wizard-step"','aria-valuemax="5"',
     'name="serverKind"','name="monthlyRevenue"','name="teamSize"','name="sector"'])
     expect(html).not.toContain(removed);
   expect((html.match(/<form\b/g)||[])).toHaveLength(1);
   expect(html).toContain('id="quick-diagnostic-success"');
   expect(html).toContain('aria-live="polite"');
   expect(html).toContain('name="viewport"');
   expect(html).not.toContain('GEMINI_API_KEY');
 });
 it('envia avaliação rápida para D1 e mantém feedback sem assinaturas externas',()=>{
   expect(js).toContain('/api/public/diagnostico');
   expect(js).toContain("type:'funnel_step'");
   expect(js).toContain('quick_submitted');
   expect(js).toContain('response.ok');
   expect(js).not.toContain('full_step_');
   expect(css).toContain('@media (max-width: 640px)');
   expect(css).toContain('prefers-reduced-motion:reduce');
   expect(css).not.toContain('.wizard-step');
   expect(css).not.toContain('.diagnostic-complete-toggle');
 });
});
