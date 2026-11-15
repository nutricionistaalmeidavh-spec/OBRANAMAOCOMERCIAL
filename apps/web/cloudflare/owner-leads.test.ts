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

describe('P2: registro de oportunidades WhatsApp sem formulário',()=>{
  const url='https://artisys.dev/api/owner/leads';
  const input={name:'Cliente QA',company:'Construtora Exemplo',contact:'(16) 99999-1234',
    goal:'Preciso de um sistema sob medida para gestão da equipe de operações.'};
  function mock() {
    const prepare=vi.fn((sql:string)=>({
      bind:vi.fn().mockReturnThis(),
      run:vi.fn().mockResolvedValue({meta:{changes:1}}),
      first:vi.fn().mockResolvedValue({id:'manual'})
    }));
    return {DB:{prepare}};
  }
  const auth=async()=>new Response(JSON.stringify({role:'owner'}),{status:200});
  const post=(payload:unknown,origin='https://artisys.dev')=>new Request(url,{
    method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(payload)
  });
  it('salva novo contato com origem manual, sem afirmar venda, envio ou consentimento',async()=>{
    const env=mock();
    const result=await handleOwnerLeadsRequest(post(input),env as never,auth);
    expect(result?.status).toBe(201);
    const json=await result!.json() as any;
    expect(json).toMatchObject({ok:true,status:'novo',mode:'manual'});
    expect(json.note).toContain('sem envio de mensagem');
    expect(env.DB.prepare.mock.calls[0][0]).toContain('INSERT INTO kv_records');
    const args=env.DB.prepare.mock.results[0].value.bind.mock.calls[0];
    expect(args[0]).toBe('artisys_diagnostic_leads_v1');
    const record=JSON.parse(String(args[2]));
    expect(record).toMatchObject({company:'Construtora Exemplo',whatsapp:'5516999991234',email:'',
      mode:'manual',source:'whatsapp_manual',consent:false});
    expect(record).not.toHaveProperty('confirmedSale');
  });
  it('bloqueia outros papéis, origem cruzada, metadados extras e contato inválido',async()=>{
    const other=mock();
    const no=async()=>new Response(JSON.stringify({role:'debora'}),{status:200});
    expect((await handleOwnerLeadsRequest(post(input),other as never,no))?.status).toBe(403);
    for(const payload of [{...input,paymentValue:500},{...input,contact:'x'},{...input,goal:'curto'}]){
      const env=mock();
      expect((await handleOwnerLeadsRequest(post(payload),env as never,auth))?.status).toBe(400);
      expect(env.DB.prepare).not.toHaveBeenCalled();
    }
    expect((await handleOwnerLeadsRequest(post(input,'https://evil.example'),mock() as never,auth))?.status).toBe(403);
  });
  it('lê manual e status na mesma fonte canônica com a quantidade correta de parâmetros SQL',async()=>{
    const env=envFake();
    const response=await handleOwnerLeadsRequest(new Request(url),env,auth);
    expect(response?.status).toBe(200);
    const statement=env.DB.prepare.mock.calls[0][0] as string;
    expect(statement).toContain('progression.record_json AS progression_json');
    expect((statement.match(/\?/g)||[])).toHaveLength(3);
  });
});
describe('P2: progresso comercial canônico registrado manualmente pelo proprietário',()=>{
  const leadId='aaaa1111-2222-4333-8444-555566667777';
  const make=(role='owner')=>{
    const db={
      prepare:vi.fn((sql:string)=>({
        bind:vi.fn().mockReturnThis(),
        first:vi.fn().mockResolvedValue({id:leadId}),
        run:vi.fn().mockResolvedValue({meta:{changes:1}})
      }))
    };
    const auth=async()=>new Response(JSON.stringify({role}),{status:200});
    return {db,auth};
  };
  const change=(body:unknown,origin='https://artisys.dev')=>new Request(url+'/status',{
    method:'PUT',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)
  });
  it('rejeita perfis que não são owner, payloads extras e origem cruzada',async()=>{
    const {db,auth}=make('debora');
    expect((await handleOwnerLeadsRequest(change({id:leadId,status:'pago',expectedVersion:0}),{DB:db} as never,auth))?.status).toBe(403);
    expect(db.prepare).not.toHaveBeenCalled();
    const yes=make();
    expect((await handleOwnerLeadsRequest(change({id:leadId,status:'pago',expectedVersion:0,paidAmount:100}),{DB:yes.db} as never,yes.auth))?.status).toBe(400);
    expect((await handleOwnerLeadsRequest(change({id:leadId,status:'pago',expectedVersion:0},'https://evil.example'),{DB:yes.db} as never,yes.auth))?.status).toBe(403);
    expect(yes.db.prepare).not.toHaveBeenCalled();
  });
  it('registra status versão 1 em collection separada, sem afirmar conciliação financeira',async()=>{
    const {db,auth}=make();
    const res=await handleOwnerLeadsRequest(change({id:leadId,status:'em_contato',expectedVersion:0}),{DB:db} as never,auth);
    expect(res?.status).toBe(200);
    const body=await res!.json() as any;
    expect(body).toMatchObject({ok:true,version:1,status:'em_contato',manual:true});
    expect(body).not.toHaveProperty('confirmedSale');
    expect(db.prepare).toHaveBeenCalledTimes(2);
    expect(db.prepare.mock.calls[1][0]).toContain('ON CONFLICT');
  });
  it('não infere o pagamento por clique: apenas marcação manual pode alterar etapa',async()=>{
    const {db,auth}=make();
    const res=await handleOwnerLeadsRequest(change({id:leadId,status:'pago',expectedVersion:0}),{DB:db} as never,auth);
    const body=await res!.json() as any;
    expect(body.note).toContain('não confirma pagamento no gateway');
  });
});
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
