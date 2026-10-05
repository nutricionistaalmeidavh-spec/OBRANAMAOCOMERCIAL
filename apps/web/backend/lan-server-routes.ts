import { db, error, json } from '../cloudflare/sdk';
import { deviceByToken, type Device } from './desktop-store';
import { authenticateLanServer, createDeviceEnrollment, createLanClaim, lanServerSnapshot, redeemDeviceEnrollment, redeemLanClaim, revokeLanServerGrant } from './lan-server-authority';
import { clearLanServerTopology, getCompanyStorageTopology, setCompanyStorageTopology } from './company-storage-topology';

type MemberRecord={id:string;projectMemberId?:string;companyId:string;projectId:string;email:string;name?:string;role:string;modules?:string[];channels?:string[]};
type PlatformRecord={id:string;status?:string};

const norm=(value:unknown)=>String(value||'').trim().toLowerCase();
const safe=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'_');
function hashKey(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
const memberAccessTable=(email:string)=>`access_${safe(norm(email).slice(0,28))}_${hashKey(norm(email))}`;
const platformEmailTable=(email:string)=>`platform_access_email_${hashKey(norm(email))}`;
const array=(value:unknown)=>Array.isArray(value)?value.map(String):[];
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

async function platformActive(email:string){
  const refs=(await db.list<Record<string,unknown>>(platformEmailTable(email),{limit:1})).items,ref=refs[0];
  if(!ref)return true;
  const [access]=await db.get<PlatformRecord>('platform_accesses',[String(ref.accessId||'')]);
  return !access||access.status==='active';
}

async function desktopContext(deviceToken:string){
  const device=await deviceByToken(String(deviceToken||''));
  if(!device||device.status!=='active'||!device.companyId||!device.projectId)return null;
  if(device.tokenExpiresAt&&device.tokenExpiresAt<new Date().toISOString())return null;
  if(!(await platformActive(device.email)))return null;
  const members=(await db.list<MemberRecord>(memberAccessTable(device.email),{limit:20})).items;
  const member=members.find(item=>item.companyId===device.companyId&&item.projectId===device.projectId);
  if(!member)return null;
  const channels=array(member.channels);
  if(channels.length&&!channels.includes('desktop'))return null;
  return {device,member};
}

async function adminDesktopContext(deviceToken:string){
  const context=await desktopContext(deviceToken);
  return context?.member.role==='admin'?context:null;
}

function bearer(request:Request|undefined){
  const value=request?.headers.get('authorization')||'';
  const match=value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim()||'';
}

function validServerId(serverId:string){return serverId.length>=8&&serverId.length<=128&&/^[A-Za-z0-9._:-]+$/.test(serverId)}

export const LAN_SERVER_ROUTES={
  'POST /api/desktop/lan/claim/start':[async(ctx:any)=>{
    const body=record(ctx.body),serverId=String(body.serverId||'').trim();
    if(!validServerId(serverId))return error('Identificador do servidor LAN inválido.',400);
    const admin=await adminDesktopContext(String(body.deviceToken||''));
    if(!admin)return error('Apenas Admin autorizado no Desktop pode vincular servidor LAN.',403);
    const canonicalMemberId=String(admin.member.projectMemberId||admin.member.id||'').trim();
    if(!canonicalMemberId)return error('Vínculo do administrador com a obra está incompleto.',409);
    return json(await createLanClaim({companyId:admin.device.companyId!,serverId,issuedByDeviceId:admin.device.id,issuedByMemberId:canonicalMemberId}));
  }],
  'POST /api/desktop/lan/enroll/start':[async(ctx:any)=>{
    const body=record(ctx.body),serverId=String(body.serverId||'').trim();
    if(!validServerId(serverId))return error('Identificador do servidor LAN inválido.',400);
    const desktop=await desktopContext(String(body.deviceToken||''));
    if(!desktop)return error('Este Desktop não está autorizado para matrícula LAN.',403);
    const topology=await getCompanyStorageTopology(desktop.device.companyId!);
    if(topology.mode!=='lan-server'||String(topology.serverId||'')!==serverId)return error('Este servidor não é a fonte operacional configurada para a empresa.',409);
    const canonicalMemberId=String(desktop.member.projectMemberId||desktop.member.id||'').trim();
    if(!canonicalMemberId)return error('Vínculo do usuário com a obra está incompleto.',409);
    const enrollment=await createDeviceEnrollment({
      companyId:desktop.device.companyId!,serverId,memberId:canonicalMemberId,
      cloudDeviceId:desktop.device.id,installationId:desktop.device.installationId,deviceName:desktop.device.name
    });
    return json({serverId,enrollmentToken:enrollment.enrollmentToken,expiresAt:enrollment.expiresAt});
  }],
  'POST /api/lan/enroll/redeem':[async(ctx:any)=>{
    const body=record(ctx.body),serverId=String(body.serverId||'').trim(),enrollmentToken=String(body.enrollmentToken||'').trim(),installationId=String(body.installationId||'').trim();
    const serverToken=bearer(ctx.request);
    if(!validServerId(serverId)||enrollmentToken.length<16||installationId.length<8||!serverToken)return error('Matrícula LAN inválida.',400);
    try{
      const redeemed=await redeemDeviceEnrollment({serverToken,serverId,enrollmentToken,installationId});
      const snapshot=await lanServerSnapshot(redeemed.companyId);
      const member=snapshot.members.find(item=>item.memberId===redeemed.memberId&&item.status==='active'&&item.channels.includes('desktop'));
      if(!member)return error('Usuário não possui autorização Desktop ativa nesta empresa.',403);
      return json({...redeemed,member,snapshot});
    }catch(cause){return error(cause instanceof Error?cause.message:'Matrícula LAN inválida.',403)}
  }],
  'POST /api/lan/claim/redeem':[async(ctx:any)=>{
    const body=record(ctx.body),serverId=String(body.serverId||'').trim(),claimToken=String(body.claimToken||'').trim();
    if(!validServerId(serverId)||claimToken.length<16)return error('Claim LAN inválido.',400);
    try{
      const redeemed=await redeemLanClaim({serverId,claimToken});
      const snapshot=await lanServerSnapshot(redeemed.companyId);
      const claimingAdmin=snapshot.members.find(member=>member.memberId===redeemed.claimingMemberId&&member.role==='admin'&&member.status==='active'&&member.channels.includes('desktop'));
      const [company]=await db.get<Record<string,unknown>>('companies',[redeemed.companyId]);
      const [requestingDevice]=await db.get<Device>('devices',[redeemed.issuedByDeviceId]);
      if(!company||!claimingAdmin||!requestingDevice||requestingDevice.companyId!==redeemed.companyId){
        await revokeLanServerGrant({serverId,companyId:redeemed.companyId});
        return error('O administrador que iniciou o vínculo não está mais autorizado.',403);
      }
      await setCompanyStorageTopology(redeemed.companyId,{mode:'lan-server',serverId,updatedByDeviceId:requestingDevice.id});
      return json({
        serverToken:redeemed.serverToken,
        company:{id:redeemed.companyId,name:String(company.name||'Empresa')},
        claimingAdmin,
        requestingDevice:{id:requestingDevice.id,installationId:requestingDevice.installationId,name:requestingDevice.name,platform:requestingDevice.platform||null},
        snapshot,
      });
    }catch(cause){return error(cause instanceof Error?cause.message:'Claim LAN inválido.',403)}
  }],
  'POST /api/lan/server/snapshot':[async(ctx:any)=>{
    const token=bearer(ctx.request)||String(record(ctx.body).serverToken||'');
    const grant=await authenticateLanServer(token);
    if(!grant)return error('Servidor LAN não autorizado ou revogado.',401);
    const snapshot=await lanServerSnapshot(grant.companyId);
    if(snapshot.companyId!==grant.companyId)return error('Snapshot LAN inconsistente.',409);
    return json({serverId:grant.serverId,companyId:grant.companyId,snapshot});
  }],
  'POST /api/lan/server/revoke':[async(ctx:any)=>{
    const body=record(ctx.body),serverId=String(body.serverId||'').trim();
    if(!validServerId(serverId))return error('Identificador do servidor LAN inválido.',400);
    const admin=await adminDesktopContext(String(body.deviceToken||''));
    if(!admin)return error('Apenas Admin autorizado no Desktop pode revogar servidor LAN.',403);
    const revoked=await revokeLanServerGrant({serverId,companyId:admin.device.companyId!});
    if(!revoked)return error('Servidor LAN não encontrado nesta empresa.',404);
    await clearLanServerTopology(admin.device.companyId!,serverId);
    return json({ok:true});
  }],
};
