import { db, runtimeEnv } from '../cloudflare/sdk';
import { createLicense, mutateLicense, LICENSE_MODULES, LICENSE_CHANNELS } from './license-service';

type Row=Record<string,any>&{id:string};
export type ManagedActor={userId:string;email?:string};
export class ManagedAdminError extends Error{status:number;constructor(message:string,status=400){super(message);this.name='ManagedAdminError';this.status=status}}

const norm=(value:unknown)=>String(value||'').trim().toLowerCase();
const bounded=(value:unknown,fallback:number)=>Math.max(1,Math.min(999,Math.floor(Number(value)||fallback)));

export function normalizeManagedCompanyInput(input:Record<string,unknown>,allowed={modules:[...LICENSE_MODULES],channels:[...LICENSE_CHANNELS]}){
  const modules=(Array.isArray(input.modules)?input.modules:[]).map(String).filter(value=>allowed.modules.includes(value as any));
  const channels=(Array.isArray(input.channels)?input.channels:[]).map(String).filter(value=>allowed.channels.includes(value as any));
  return {
    name:String(input.name||'').trim(),
    email:norm(input.adminEmail),
    modules,
    channels,
    plan:String(input.plan||'custom'),
    expiresAt:input.expiresAt?String(input.expiresAt):undefined,
    maxUsers:bounded(input.maxUsers,10),
    maxProjects:bounded(input.maxProjects,5),
    maxDevices:bounded(input.maxDevices,2),
  };
}

async function rows(collection:string):Promise<Row[]>{
  const result=await runtimeEnv().DB.prepare('SELECT id,record_json FROM kv_records WHERE collection=?').bind(collection).all<{id:string;record_json:string}>();
  return(result.results||[]).map(row=>({...JSON.parse(row.record_json),id:row.id}));
}

export function companyViews(companies:Row[],licenses:Row[],users:Row[],projects:Row[],devices:Row[],credentials:{email:string;created_at:string}[],ownerEmail:string,ownerCompanyName=''){
  const operationIds=new Set(companies.filter(company=>company.licenseId==='owner'||(!!ownerCompanyName&&norm(company.name)===norm(ownerCompanyName))||users.some(user=>user.platformRole==='superadmin'&&norm(user.email)===norm(ownerEmail)&&(user.companyIds||[]).includes(company.id))).map(company=>company.id));
  const view=(company:Row|undefined,license:Row|undefined)=>{
    const id=company?.id||`license:${license!.id}`,adminEmail=norm(company?.principalEmail||license?.email);
    const companyUsers=users.filter(user=>(user.companyIds||[]).includes(id)&&user.platformRole!=='superadmin').map(user=>({id:user.id,email:user.email,name:user.name,status:user.status,role:user.email===adminEmail?'admin':'user',passwordCreatedAt:credentials.find(item=>norm(item.email)===norm(user.email))?.created_at||null}));
    const companyProjects=projects.filter(project=>project.companyId===id).map(project=>({id:project.id,name:project.name}));
    const companyDevices=devices.filter(device=>device.companyId===id).map(device=>({id:device.id,name:device.name,email:device.email,status:device.status,lastSeenAt:device.lastSeenAt}));
    const passwordCreatedAt=credentials.find(item=>norm(item.email)===adminEmail)?.created_at||null;
    return{id,name:company?.name||`Licença reservada — ${adminEmail||'sem e-mail'}`,adminEmail,reserved:!company,status:license?.status==='revoked'?'suspended':license?.expiresAt&&license.expiresAt<new Date().toISOString()?'expired':!license?.claimedBy?'pending':'active',license:license?{id:license.id,plan:license.plan,status:license.status,expiresAt:license.expiresAt,maxUsers:license.maxUsers,maxProjects:license.maxProjects,maxDevices:license.maxDevices,claimed:!!license.claimedBy}:null,modules:license?.modules||[],channels:license?.channels||[],passwordCreatedAt,usersCount:companyUsers.length,projectsCount:companyProjects.length,devicesCount:companyDevices.length,users:companyUsers,projects:companyProjects,devices:companyDevices};
  };
  return{companies:[...companies.filter(company=>!operationIds.has(company.id)).map(company=>view(company,licenses.find(license=>license.id===company.licenseId)||licenses.find(license=>license.companyId===company.id))),...licenses.filter(license=>!license.companyId&&!companies.some(company=>company.licenseId===license.id)&&norm(license.email)!==norm(ownerEmail)).map(license=>view(undefined,license))],operationCompanyIds:[...operationIds]};
}

export async function managedCompanyInventory(){
  const [companies,licenses,users,projects,devices]=await Promise.all(['companies','licenses','platform_accesses','projects','devices'].map(rows));
  const table=await runtimeEnv().DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='password_credentials'").first();
  const credentials=table?(await runtimeEnv().DB.prepare('SELECT email,created_at FROM password_credentials').all<{email:string;created_at:string}>()).results||[]:[];
  return companyViews(companies,licenses,users,projects,devices,credentials,String(runtimeEnv().OWNER_EMAIL||''),String(runtimeEnv().OWNER_COMPANY||'Obra na Mão'));
}

export async function createManagedCompany(input:Record<string,unknown>,actor:ManagedActor){
  const normalized=normalizeManagedCompanyInput(input);
  const {name,email,modules,channels}=normalized;
  if(!name||!/^\S+@\S+\.\S+$/.test(email)||!modules.length||!channels.length)throw new ManagedAdminError('Informe empresa, e-mail do admin, módulos e canais.',400);
  if(email===norm(runtimeEnv().OWNER_EMAIL)||norm(name)===norm(runtimeEnv().OWNER_COMPANY||'Obra na Mão'))throw new ManagedAdminError('Use uma empresa cliente e um administrador próprio.',409);
  const existing=await runtimeEnv().DB.prepare("SELECT id FROM kv_records WHERE (collection IN ('licenses','platform_accesses') AND lower(json_extract(record_json,'$.email'))=?) OR (collection='companies' AND lower(json_extract(record_json,'$.principalEmail'))=?) LIMIT 1").bind(email,email).first();
  if(existing)throw new ManagedAdminError('Este e-mail já possui licença ou vínculo. Abra a empresa existente.',409);
  const stamp=new Date().toISOString(),companyId=crypto.randomUUID().replace(/-/g,''),companyRecord={name,principalEmail:email,createdAt:stamp,createdBy:actor.userId,tenantVersion:1,attendanceTimesheetMode:'disabled'};
  const inserted=await runtimeEnv().DB.prepare("INSERT INTO kv_records(collection,id,record_json,created_at,updated_at) SELECT 'companies',?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM kv_records WHERE (collection IN ('licenses','platform_accesses') AND lower(json_extract(record_json,'$.email'))=?) OR (collection='companies' AND lower(json_extract(record_json,'$.principalEmail'))=?) )").bind(companyId,JSON.stringify(companyRecord),stamp,stamp,email,email).run();
  if(Number(inserted.meta?.changes||0)!==1)throw new ManagedAdminError('Este e-mail já foi reservado por outra criação.',409);
  const license=await createLicense({email,companyId,modules,channels,status:'active',plan:normalized.plan,expiresAt:normalized.expiresAt,maxUsers:normalized.maxUsers,maxProjects:normalized.maxProjects,maxDevices:normalized.maxDevices},{source:'manual',userId:actor.userId,email:actor.email});
  await db.update('companies',[{id:companyId,record:{...companyRecord,licenseId:license.id,licensedModules:modules,licensedChannels:channels}}]);
  const company=(await managedCompanyInventory()).companies.find(item=>item.id===companyId);
  return{company,license};
}

export async function updateManagedCompany(companyId:string,input:Record<string,unknown>,actor:ManagedActor){
  const company=(await managedCompanyInventory()).companies.find(item=>item.id===companyId);
  if(!company?.license)throw new ManagedAdminError('Empresa ou licença não encontrada.',404);
  const modules=(Array.isArray(input.modules)?input.modules:company.modules).map(String).filter(value=>(LICENSE_MODULES as readonly string[]).includes(value));
  const channels=(Array.isArray(input.channels)?input.channels:company.channels).map(String).filter(value=>(LICENSE_CHANNELS as readonly string[]).includes(value));
  if(!modules.length||!channels.length)throw new ManagedAdminError('Selecione módulos e canais.',400);
  const license=await mutateLicense(company.license.id,current=>({...current,modules,channels,status:input.status==='suspended'?'revoked':input.status==='active'?'active':current.status,plan:input.plan!==undefined?String(input.plan||'custom'):current.plan,expiresAt:input.expiresAt===null||input.expiresAt===''?undefined:input.expiresAt!==undefined?String(input.expiresAt):current.expiresAt,maxUsers:input.maxUsers!==undefined?bounded(input.maxUsers,current.maxUsers||10):current.maxUsers,maxProjects:input.maxProjects!==undefined?bounded(input.maxProjects,current.maxProjects||5):current.maxProjects,maxDevices:input.maxDevices!==undefined?bounded(input.maxDevices,current.maxDevices||2):current.maxDevices}),{source:'manual',userId:actor.userId,email:actor.email},'company_updated');
  return{company:(await managedCompanyInventory()).companies.find(item=>item.id===companyId),license};
}

export async function setManagedDeviceStatus(deviceId:string,status:unknown){
  const [device]=await db.get<any>('devices',[deviceId]);
  if(!device)throw new ManagedAdminError('Computador não encontrado.',404);
  const nextStatus=String(status)==='active'?'active':'revoked';
  await db.update('devices',[{id:deviceId,record:{...device,status:nextStatus,updatedAt:new Date().toISOString()}}]);
  return{ok:true,status:nextStatus,companyId:String(device.companyId||'')};
}
