import { db } from '@appdeploy/sdk';

export type PhoneSystemGrant = { enabled:boolean; role:string };
export type PhoneAccess = {
  phone:string;
  name:string;
  employeeId:string;
  companyId:string;
  projectId:string;
  status:'active'|'blocked';
  systems:{
    obra360:PhoneSystemGrant;
    universidade:PhoneSystemGrant;
  };
  createdAt:string;
  updatedAt:string;
};

function normalizePhone(value:string){let d=String(value||'').replace(/\D/g,'');if(d.length===10||d.length===11)d='55'+d;return d.length>=12&&d.length<=13?d:''}
function hashKey(v:string){let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
const tableFor=(phone:string)=>'platform_phone_access_'+hashKey(phone);
const now=()=>new Date().toISOString();

export async function getPhoneAccess(inputPhone:string){
  const phone=normalizePhone(inputPhone);if(!phone)return null;
  const items=(await db.list<PhoneAccess>(tableFor(phone),{limit:1})).items;
  const item=items[0];return item?{...item,id:item.id}:null;
}

export async function ensurePhoneAccess(input:{phone:string;name:string;employeeId:string;companyId:string;projectId:string;obraRole?:string;universityRole?:string}){
  const phone=normalizePhone(input.phone);if(!phone)throw new Error('Celular inválido.');
  const stamp=now(),current=await getPhoneAccess(phone);
  const record:PhoneAccess={
    phone,
    name:String(input.name||'Colaborador').trim()||'Colaborador',
    employeeId:String(input.employeeId||'').trim(),
    companyId:String(input.companyId||'').trim(),
    projectId:String(input.projectId||'').trim(),
    status:'active',
    systems:{
      obra360:{enabled:true,role:input.obraRole||'encarregado'},
      universidade:{enabled:true,role:input.universityRole||'colaborador'},
    },
    createdAt:current?.createdAt||stamp,
    updatedAt:stamp,
  };
  if(!record.employeeId||!record.companyId||!record.projectId)throw new Error('Vínculo operacional incompleto.');
  const table=tableFor(phone);
  if(current?.id)await db.update(table,[{id:current.id,record}]);
  else await db.add(table,[record]);
  return record;
}

export function phoneAccessView(access:PhoneAccess){
  return {
    phone:access.phone,
    name:access.name,
    employeeId:access.employeeId,
    companyId:access.companyId,
    projectId:access.projectId,
    status:access.status,
    systems:access.systems,
  };
}
