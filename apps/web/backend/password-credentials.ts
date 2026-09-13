export type PasswordRecord={
  algorithm:'PBKDF2-SHA256';
  salt:string;
  hash:string;
  iterations:number;
  createdAt:string;
  updatedAt:string;
};

// Cloudflare Workers Web Crypto rejects PBKDF2 above 100,000 iterations.
// Node's Web Crypto does not enforce this limit; keep the runtime-cap regression test.
const ITERATIONS=100_000;
const encoder=new TextEncoder();

function b64url(bytes:Uint8Array){
  let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromB64url(value:string){
  const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);
  const raw=atob(padded),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;
}
async function derive(password:string,salt:Uint8Array,iterations:number){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);
  return new Uint8Array(bits);
}
function constantTimeEqual(a:Uint8Array,b:Uint8Array){
  if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}

export async function createPasswordRecord(password:string):Promise<PasswordRecord>{
  if(password.length<8)throw new Error('A senha deve ter ao menos 8 caracteres.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),hash=await derive(password,salt,ITERATIONS),stamp=new Date().toISOString();
  return{algorithm:'PBKDF2-SHA256',salt:b64url(salt),hash:b64url(hash),iterations:ITERATIONS,createdAt:stamp,updatedAt:stamp};
}

export async function verifyPasswordRecord(password:string,record:PasswordRecord){
  if(record.algorithm!=='PBKDF2-SHA256'||record.iterations<100_000)return false;
  try{return constantTimeEqual(await derive(password,fromB64url(record.salt),record.iterations),fromB64url(record.hash))}catch{return false}
}

export function newInitialPassword(){
  const lower='abcdefghjkmnpqrstuvwxyz',upper='ABCDEFGHJKMNPQRSTUVWXYZ',digits='23456789',symbols='!@#$%';
  const all=lower+upper+digits+symbols,pick=(chars:string)=>chars[crypto.getRandomValues(new Uint32Array(1))[0]%chars.length];
  const chars=[pick(lower),pick(upper),pick(digits),pick(symbols)];
  while(chars.length<18)chars.push(pick(all));
  for(let i=chars.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[chars[i],chars[j]]=[chars[j],chars[i]]}
  return chars.join('');
}

export async function sha256Hex(value:string){
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
