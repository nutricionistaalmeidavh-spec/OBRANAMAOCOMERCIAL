import { db } from '@appdeploy/sdk';
export type IntegrationEventInput={type:string;companyId:string;projectId?:string;source:string;entityId?:string;actorUserId?:string;payload?:Record<string,unknown>};
const TABLE='platform_integration_events_v1';const now=()=>new Date().toISOString();
export async function emitIntegrationEvent(input:IntegrationEventInput){const record={eventId:crypto.randomUUID(),schemaVersion:1,occurredAt:now(),...input,payload:input.payload||{}};const[id]=await db.add(TABLE,[record as unknown as Record<string,unknown>]);return id?{...record,id}:record}
export async function listIntegrationEvents(companyId:string,projectId?:string,limit=100){const{items}=await db.list<Record<string,unknown>>(TABLE,{limit:500});return items.filter(x=>String(x.companyId||'')===companyId&&(!projectId||String(x.projectId||'')===projectId)).sort((a,b)=>String(b.occurredAt||'').localeCompare(String(a.occurredAt||''))).slice(0,Math.max(1,Math.min(limit,200)))}
