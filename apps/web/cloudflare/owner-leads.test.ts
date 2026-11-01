import { describe, expect, it, vi } from 'vitest';
import { handleOwnerLeadsRequest, scoreDiagnosticLead } from './owner-leads';

const url='https://artisys.dev/api/owner/leads';
const record={
  name:'Pessoa Ficticia',company:'Empresa QA',email:'qa@example.test',whatsapp:'16999998888',
  sector:'servicos',teamSize:'6-20',painPoints:['tarefas-manuais','financeiro'],
  integrations:['whatsapp'],softwareSpend:'501-1500',urgency:'agora',goal:'Automatizar financeiro',
  receivedAt:'2026-11-01T18:00:00.000Z',status:'novo',utmSource:'tiktok',utmCampaign:'video-17'
};
function envFake(){
  const db={prepare:vi.fn().mockReturnValue({
    bind:vi.fn().mockReturnThis(),
    all:vi.fn().mockResolvedValue({results:[{id:'lead-01',record_json:JSON.stringify(record),created_at:record.receivedAt,delivered_at:'2026-11-01T18:01:00.000Z'}]})
  })};
  return {DB:db};
}
const owner=async()=>new Response(JSON.stringify({role:'owner'}),{status:200});

describe('owner-only diagnostics in the existing Central ArtiSys',()=>{
  it('does not capture unrelated routes',async()=>{
    expect(await handleOwnerLeadsRequest(new Request('https://artisys.dev/api/other'),envFake(),owner)).toBeNull();
  });
  it('denies anonymous and Débora users before any database read',async()=>{
    for(const gate of [
      async()=>new Response(JSON.stringify({error:'unauthorized'}),{status:401}),
      async()=>new Response(JSON.stringify({role:'debora'}),{status:200})
    ]){
      const env=envFake();
      const response=await handleOwnerLeadsRequest(new Request(url),env,gate);
      expect(response?.status).toBe(403);
      expect(env.DB.prepare).not.toHaveBeenCalled();
    }
  });
  it('returns safe commercial lead summary from existing canonical D1 records',async()=>{
    const env=envFake();
    const response=await handleOwnerLeadsRequest(new Request(url),env,owner);
    expect(response?.status).toBe(200);
    expect(response?.headers.get('cache-control')).toContain('no-store');
    const data=await response!.json() as any;
    expect(data.leads).toHaveLength(1);
    expect(data.leads[0]).toMatchObject({
      id:'lead-01',nome:'Pessoa Ficticia',empresa:'Empresa QA',prioridade:'Alta',
      origem:'tiktok',campanha:'video-17',entregue:true
    });
    expect(data.leads[0]).not.toHaveProperty('sensitiveData');
    expect(data.leads[0]).not.toHaveProperty('monthlyRevenue');
    expect(data.summary).toMatchObject({total:1,alta:1,tiktok:1});
    expect(env.DB.prepare).toHaveBeenCalledOnce();
  });
  it('uses independent urgency, company size, pain and integration signals',()=>{
    const value=scoreDiagnosticLead(record);
    expect(value.score).toBe(93);
    expect(value.priority).toBe('Alta');
  });
});
