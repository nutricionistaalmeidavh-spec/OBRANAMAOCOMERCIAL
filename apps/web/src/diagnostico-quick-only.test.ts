import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { handlePublicDiagnostic } from '../cloudflare/public-diagnostic';
import { DIAGNOSTIC_STEPS } from '../cloudflare/marketing-analytics';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const legacy={name:'Maria Souza',company:'Loja ABC',email:'maria@empresa.com',
  sector:'comercio',teamSize:'2-5',goal:'Quero reduzir tarefas manuais na minha empresa.'};
describe('Diagnóstico: só WhatsApp + avaliação rápida (sem wizard antigo)',()=>{
  it('renderiza apenas duas opções, quatro campos e nenhum CTA/painel da versão de cinco etapas',()=>{
    const html=read('../public/links/diagnostico/index.html');
    expect(html).toContain('id="whatsapp-start"');
    expect(html).toContain('id="quick-diagnostic-open"');
    expect(html).toContain('id="quick-diagnostic-form"');
    for(const name of ['name','company','contact','goal'])
      expect(html).toContain('name="'+name+'"');
    for(const removed of ['full-diagnostic-open','full-diagnostic-panel',
      'id="diagnostic-form"','wizard-step','ETAPA 1 DE 5','aria-valuemax="5"',
      'name="monthlyRevenue"','name="serverKind"','data-step="4"',
      '/links/diagnostico/diagnostico.js'])
      expect(html).not.toContain(removed);
    expect((html.match(/<form\b/g)||[])).toHaveLength(1);
    expect(html).toContain('src="/links/diagnostico/quick-diagnostic.js"');
  });
  it('não entrega o script antigo nem mantém CSS exclusivo das cinco etapas',()=>{
    const script=read('../public/links/diagnostico/quick-diagnostic.js');
    const css=read('../public/links/diagnostico/diagnostico.css');
    for(const removed of ['fullButton','fullPanel','artisys-open-full','full_open','full_step_'])
      expect(script).not.toContain(removed);
    for(const removed of ['.diagnostic-complete-toggle','.wizard-step','.progress-track','.system-name-field','.conditional-field'])
      expect(css).not.toContain(removed);
    expect(script).toContain('quick_submitted');
    expect(css).toContain('.diagnostic-choice');
  });
  it('bloqueia novos payloads do wizard no endpoint sem alterar tabelas ou apagar históricos',async()=>{
    const env={DB:{prepare:vi.fn()}};
    const req=new Request('https://artisys.dev/api/public/diagnostico',{
      method:'POST',headers:{origin:'https://artisys.dev','content-type':'application/json'},
      body:JSON.stringify(legacy)
    });
    const result=await handlePublicDiagnostic(req,env);
    expect(result?.status).toBe(422);
    expect(env.DB.prepare).not.toHaveBeenCalled();
    expect(read('../cloudflare/public-diagnostic.ts')).toContain("const COLLECTION = 'artisys_diagnostic_leads_v1'");
  });
  it('remove eventos novos do wizard e mantém o funil rápido mensurável',()=>{
    expect(DIAGNOSTIC_STEPS).toEqual(['page_open','quick_open','quick_started','quick_submitted','quick_error']);
    const owner=read('./owner-marketing.ts');
    expect(owner).toContain('Formulários rápidos enviados');
    expect(owner).not.toContain('Formulários completos enviados');
  });
});
