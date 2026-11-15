import {describe,expect,it,vi} from 'vitest';
import {handlePublicDiagnostic,validateQuickDiagnosticPayload,reconcilePendingDiagnosticLeads} from './public-diagnostic';

const quick=()=>({kind:'quick',name:'Ana Souza',company:'Oficina Exemplo',
  contact:'ana@exemplo.com',goal:'Preciso automatizar o atendimento e acompanhar os meus clientes.',website:''});
const req=(body:unknown,headers:Record<string,string>={})=>new Request('https://artisys.dev/api/public/diagnostico',{
  method:'POST',headers:{origin:'https://artisys.dev','content-type':'application/json',...headers},body:JSON.stringify(body)
});
function fakeEnv(){
 const queries:Array<{sql:string;args:unknown[]}>=[];
 const DB={prepare(sql:string){
   const q={sql,args:[] as unknown[]};queries.push(q);
   return {bind(...args:unknown[]){q.args=args;return this;},
     async first(){return {count:1};},async run(){return {success:true};}};
 }};
 return {DB,queries};
}
describe('Avaliação rápida ArtiSys: único formulário público',()=>{
 it('valida somente quatro campos e contato e-mail ou WhatsApp brasileiro',()=>{
   const email=validateQuickDiagnosticPayload(quick());
   expect(email.ok).toBe(true);
   if(email.ok)expect(email.value).toMatchObject({email:'ana@exemplo.com',whatsapp:'',mode:'quick',consent:true});
   const phone=validateQuickDiagnosticPayload({...quick(),contact:'(16) 99999-1234'});
   expect(phone.ok).toBe(true);
   if(phone.ok)expect(phone.value.whatsapp).toBe('5516999991234');
   for(const invalid of [
     {...quick(),name:'A'}, {...quick(),company:' '},
     {...quick(),contact:'xyz'}, {...quick(),goal:'curto'},
     {...quick(),website:'robo'}, {...quick(),serverKind:'cloud'},
     {...quick(),kind:'full'}
   ])expect(validateQuickDiagnosticPayload(invalid).ok).toBe(false);
 });
 it('rejeita diretamente o payload legado de cinco etapas sem consultar o D1',async()=>{
   const env=fakeEnv();
   const full={name:'Ana Souza',company:'Oficina Exemplo',email:'ana@exemplo.com',
     sector:'servicos',teamSize:'2-5',goal:'Preciso de uma automação no atendimento.'};
   const result=await handlePublicDiagnostic(req(full),env);
   expect(result?.status).toBe(422);
   expect(env.queries).toHaveLength(0);
 });
 it('só devolve protocolo após persistir o lead rápido no D1 canônico',async()=>{
   const env=fakeEnv();
   const response=await handlePublicDiagnostic(req(quick()),env);
   expect(response?.status).toBe(201);
   const result=await response!.json() as any;
   expect(result.ok).toBe(true);
   expect(result.protocol).toHaveLength(8);
   const saved=env.queries.find(q=>q.sql.includes('INSERT INTO kv_records'));
   expect(saved?.args[0]).toBe('artisys_diagnostic_leads_v1');
   const record=JSON.parse(String(saved?.args[2]));
   expect(record).toMatchObject({mode:'quick',source:'/links/diagnostico/',email:'ana@exemplo.com',
     status:'novo',goal:quick().goal});
   for(const oldKey of ['serverKind','teamSize','monthlyRevenue','painPoints','integrations'])
     expect(record).not.toHaveProperty(oldKey);
 });
 it('bloqueia origens externas, formatos inválidos, honeypot e payload desconhecido',async()=>{
   const env=fakeEnv();
   for(const [body,headers,status] of [
     [quick(),{origin:'https://evil.example'},403],
     [quick(),{'content-type':'text/plain'},415],
     [{...quick(),website:'bot'}, {},400],
     [{...quick(),extra:'personal-data'}, {},422],
   ] as const){
     const r=await handlePublicDiagnostic(req(body,headers),env);
     expect(r?.status).toBe(status);
   }
   expect(env.queries).toHaveLength(0);
 });
 it('não intercepta outras rotas',async()=>{
   expect(await handlePublicDiagnostic(new Request('https://artisys.dev/api/auth/me'),fakeEnv())).toBeNull();
 });
});
describe('Activepieces opcional, D1 canônico e preservação de leads históricos',()=>{
 const withIntegration=(base:ReturnType<typeof fakeEnv>)=>({...base,
   ACTIVEPIECES_LEADS_WEBHOOK_URL:'https://example.activepieces.test/webhook',
   ACTIVEPIECES_LEADS_WEBHOOK_TOKEN:'test-token'});
 it('encaminha dados mínimos após salvar, sem campos técnicos nem cobrança obrigatória',async()=>{
   const env=withIntegration(fakeEnv()),pending:Promise<unknown>[]=[];
   const mock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:202}));
   try{
     const response=await handlePublicDiagnostic(req({...quick(),utm_source:'tiktok',utm_campaign:'shorts-11'}),env,
       {waitUntil:p=>pending.push(p)});
     expect(response?.status).toBe(201);
     await Promise.all(pending);
     expect(mock).toHaveBeenCalledTimes(1);
     const body=JSON.parse(String(mock.mock.calls[0][1]?.body));
     expect(body).toMatchObject({nome:'Ana Souza',empresa:'Oficina Exemplo',email:'ana@exemplo.com',
       utm_source:'tiktok',campanha:'shorts-11',contato_solicitado:true});
     for(const field of ['monthlyRevenue','sensitiveData','serverKind','currentSystems'])
       expect(body).not.toHaveProperty(field);
     expect(env.queries.some(x=>x.sql.includes('INSERT INTO kv_records'))).toBe(true);
     expect(env.queries.some(x=>x.sql.includes('ON CONFLICT(collection,id)'))).toBe(true);
   }finally{mock.mockRestore();}
 });
 it('mantém o protocolo se webhook falhar ou estiver desconfigurado',async()=>{
   const env=withIntegration(fakeEnv()),pending:Promise<unknown>[]=[];
   const mock=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('offline'));
   try{
     const response=await handlePublicDiagnostic(req(quick()),env,{waitUntil:p=>pending.push(p)});
     expect(response?.status).toBe(201);
     await expect(Promise.all(pending)).resolves.toBeDefined();
     mock.mockClear();
     expect((await handlePublicDiagnostic(req(quick()),fakeEnv()))?.status).toBe(201);
     expect(mock).not.toHaveBeenCalled();
   }finally{mock.mockRestore();}
 });
 it('reconcilia somente registros elegíveis e conserva leitura de leads full arquivados',async()=>{
   const legacy={name:'Lead antigo',company:'Empresa antiga',email:'old@empresa.com',whatsapp:'',
     goal:'Diagnóstico legado já persistido no D1',mode:'full',consent:false};
   const recent={...legacy,name:'Novo lead',mode:'quick'};
   const manual={...legacy,name:'Contato cadastrado no WhatsApp',mode:'manual'};
   const queries:Array<{sql:string;args:unknown[]}>=[],DB={prepare(sql:string){
     const q={sql,args:[] as unknown[]};queries.push(q);
     return {bind(...args:unknown[]){q.args=args;return this;},
       async all(){return {results:[
         {id:'12345678-aaaa-bbbb-cccc-dddddddddddd',record_json:JSON.stringify(legacy)},
         {id:'12345678-bbbb-bbbb-cccc-dddddddddddd',record_json:JSON.stringify(recent)},
         {id:'12345678-cccc-bbbb-cccc-dddddddddddd',record_json:JSON.stringify(manual)}
       ]};},
       async run(){return {success:true};}
     };
   }};
   const mock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(null,{status:202}));
   try{
     const result=await reconcilePendingDiagnosticLeads({DB,
       ACTIVEPIECES_LEADS_WEBHOOK_URL:'https://example.activepieces.test/webhook',
       ACTIVEPIECES_LEADS_WEBHOOK_TOKEN:'test-token'});
     expect(result).toEqual({sent:2,failed:0});
     expect(mock).toHaveBeenCalledTimes(2);
     expect(queries.filter(x=>x.sql.includes('ON CONFLICT(collection,id)'))).toHaveLength(2);
     expect(queries.some(x=>x.args[0]==='artisys_diagnostic_deliveries_v1')).toBe(true);
   }finally{mock.mockRestore();}
 });
 it('não executa reconciliação sem webhook',async()=>{
   expect(await reconcilePendingDiagnosticLeads({})).toEqual({sent:0,failed:0});
 });
});
