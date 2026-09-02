import { db, json, error, requireAuth, withScopes, type AuthUser, type RouterRoutes, type RouterResponse } from '@appdeploy/sdk';
import { productionEngine, planningEngine, rhEngine, financeEngine, costsEngine, measurementsEngine, documentsEngine, executiveEngine, routeAssistantQuestion, helpCatalog } from './domain-engines';
import { listIntegrationEvents } from './integration-events';
import { listPlatformAudit } from './platform-audit';
import { type PlatformContext } from './platform-context';
type Resolver=(user:AuthUser)=>Promise<PlatformContext|null>;type FinanceReader=(companyId:string,view:string)=>Promise<unknown>;const safe=(v:string)=>v.replace(/[^a-zA-Z0-9_-]/g,'_');
function protectedRoute(resolve:Resolver,fn:(ctx:PlatformContext,query:Record<string,string>,body:unknown)=>Promise<RouterResponse>|RouterResponse){return[requireAuth(),withScopes('email','profile'),async(c:any)=>{const ctx=await resolve(c.user!);if(!ctx)return error('Contexto da plataforma não autorizado.',403);return fn(ctx,c.query||{},c.body)}]}
async function projectState(projectId?:string){if(!projectId)return{};const{items}=await db.list<Record<string,unknown>>('project_meta_'+safe(projectId),{limit:1}),row=items[0];return row&&row.state&&typeof row.state==='object'?row.state:{}}
export function createPlatformCoreRoutes(resolve:Resolver,financeRead:FinanceReader):RouterRoutes{return{
'GET /api/platform/context':protectedRoute(resolve,async(ctx)=>json({context:ctx,contractVersion:2})),
'GET /api/platform/architecture':protectedRoute(resolve,async(ctx)=>json({version:'mh-platform-v2',context:{companyId:ctx.companyId,projectId:ctx.projectId||null},sourceOfTruth:{identity:'platform_access',company:'companies',project:'projects',finance:'afi_*_<companyId>',field:'project_*_<projectId>'},modules:['gestao','obra360','universidade','finance'],aiPolicy:'read-only-by-default',desktopSync:['accepted','duplicate','conflict']})),
'GET /api/platform/executive':protectedRoute(resolve,async(ctx)=>{const state=await projectState(ctx.projectId);let finance:unknown={};if(ctx.systems.finance?.enabled)try{finance=await financeRead(ctx.companyId,'dashboard')}catch{finance={}}const engines=[productionEngine(state),planningEngine(state),rhEngine(state),financeEngine(finance),costsEngine(state),measurementsEngine(state),documentsEngine(state)];return json({context:{companyId:ctx.companyId,projectId:ctx.projectId||null},engines,executive:executiveEngine(engines)})}),
'GET /api/platform/events':protectedRoute(resolve,async(ctx,q)=>json({events:await listIntegrationEvents(ctx.companyId,ctx.projectId,Number(q.limit||100))})),
'GET /api/platform/audit-log':protectedRoute(resolve,async(ctx,q)=>json({audit:await listPlatformAudit(ctx.companyId,ctx.projectId,Number(q.limit||100))})),
'GET /api/platform/help':protectedRoute(resolve,async(_ctx,q)=>json({items:helpCatalog(String(q.q||''))})),
'POST /api/platform/assistant/route':protectedRoute(resolve,async(ctx,_q,body)=>{const b=body&&typeof body==='object'&&!Array.isArray(body)?body as Record<string,unknown>:{},question=String(b.question||'').trim();if(!question)return error('Escreva uma pergunta.',400);return json({route:routeAssistantQuestion(question),help:helpCatalog(question).slice(0,3),context:{companyId:ctx.companyId,projectId:ctx.projectId||null},readOnly:true})})
}}
