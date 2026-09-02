import { db } from '@appdeploy/sdk';
export type PlatformAuditInput={action:string;actorUserId:string;actorEmail?:string;companyId?:string;projectId?:string;entity?:string;entityId?:string;source?:string;metadata?:Record<string,unknown>};
const TABLE='platform_audit_v2';const now=()=>new Date().toISOString();
export async function writePlatformAudit(input:PlatformAuditInput){const record={...input,source:input.source||'mh-platform',at:now()};const[id]=await db.add(TABLE,[record as unknown as Record<string,unknown>]);return id?{...record,id}:record}
export async function listPlatformAudit(companyId:string,projectId?:string,limit=100){const{items}=await db.list<Record<string,unknown>>(TABLE,{limit:500});return items.filter(x=>String(x.companyId||'')===companyId&&(!projectId||String(x.projectId||'')===projectId)).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))).slice(0,Math.max(1,Math.min(limit,200)))}
