import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateQuickDiagnosticPayload } from './public-diagnostic';
import { WHATSAPP_CTA_ROUTES, identifyWhatsappCta } from './whatsapp-attribution';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
describe('P0 — Diagnóstico com dois caminhos acessíveis',()=>{
  it('exibe WhatsApp e avaliação de 4 campos acima do formulário longo',()=>{
    const html=read('../public/links/diagnostico/index.html');
    expect(html).toContain('Sua empresa perde tempo com tarefas que poderiam ser automatizadas?');
    expect(html).toContain('Escolha como prefere começar');
    expect(html).toContain('Conversar pelo WhatsApp');
    expect(html).toContain('Solicitar avaliação rápida');
    expect(html).toContain('id="quick-diagnostic-form"');
    for(const n of ['name','company','contact','goal'])expect(html).toContain('name="'+n+'"');
    expect(html.indexOf('id="quick-diagnostic-form"')).toBeLessThan(html.indexOf('id="diagnostic-form"'));
    expect(html).toContain('id="full-diagnostic-open"');
  });
  it('salva lead rápido na mesma coleção sem inventar respostas do diagnóstico longo',()=>{
    const result=validateQuickDiagnosticPayload({kind:'quick',name:'Ana Souza',company:'Minha Loja',contact:'ana@example.com',goal:'Preciso automatizar o atendimento aos clientes.'});
    expect(result.ok).toBe(true);
    if(result.ok){expect(result.value.email).toBe('ana@example.com');expect(result.value.whatsapp).toBe('');}
    expect(validateQuickDiagnosticPayload({kind:'quick',name:'A',company:'Minha Loja',contact:'ana@example.com',goal:'Preciso de ajuda.'}).ok).toBe(false);
    expect(validateQuickDiagnosticPayload({kind:'quick',name:'Ana Souza',company:'Minha Loja',contact:'whatsapp-invalido',goal:'Preciso automatizar o atendimento aos clientes.'}).ok).toBe(false);
  });
});
describe('P1 — Funil anônimo por etapa, sem dados pessoais',()=>{
  it('instrumenta escolha, início, avanço, envio e erro sem coletar campos',()=>{
    const code=read('../public/links/diagnostico/diagnostico.js');
    const fast=read('../public/links/diagnostico/quick-diagnostic.js');
    expect(code).toContain('trackDiagnosticStep');
    expect(fast).toContain('quick_submitted');
    expect(fast).toContain('/api/public/diagnostico');
    expect(fast).not.toContain('localStorage');
  });
});
describe('P2 — WhatsApp com atribuição por página e botão',()=>{
  it('mapeia links existentes e impede CTA desconhecido ou páginas privadas',()=>{
    expect(WHATSAPP_CTA_ROUTES.home.length).toBeGreaterThanOrEqual(2);
    expect(WHATSAPP_CTA_ROUTES.wppprospector.length).toBeGreaterThanOrEqual(3);
    expect(identifyWhatsappCta('/api/owner','wa.me','a')).toBeNull();
    expect(identifyWhatsappCta('/','wa.me','contato-projeto')?.page).toBe('home');
  });
  it('preserva páginas individuais e inclui script de atribuição apenas via head',()=>{
    const code=read('../scripts/marketing-head.mjs');
    expect(code).toContain('whatsapp-attribution.js');
    expect(read('../public/sistemas/marketing-analytics.js')).toContain("if (['wa.me','api.whatsapp.com','web.whatsapp.com'].includes(href.hostname)) return;");
    const tracker=read('../public/sistemas/whatsapp-attribution.js');
    expect(tracker).toContain('whatsapp_click');
    expect(tracker).toContain('data-wa-cta');
    expect(tracker).not.toContain('document.cookie');
    expect(tracker).not.toContain('localStorage');
  });
});
