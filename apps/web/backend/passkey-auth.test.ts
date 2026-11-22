import {createRequire} from 'node:module';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite');
import {describe,expect,it,vi} from 'vitest';

vi.mock('./education',()=>({
  educationParticipantBySession:vi.fn(async (token:string)=>token==='edu-valid'?{id:'worker-1',name:'Colaborador',email:'worker@example.com',status:'active'}:null),
  educationSessionForPasskey:vi.fn(async (id:string)=>id==='worker-1'?{token:'edu-issued',participant:{id,name:'Colaborador',phone:'11999999999',jobRole:'Encarregado'}}:null)
}));
import {handlePasskeyAuth} from './passkey-auth';

class TestDB {
  db=new DatabaseSync(':memory:');
  constructor(){
    this.db.exec('CREATE TABLE auth_sessions(id TEXT PRIMARY KEY,user_id TEXT,email TEXT,name TEXT,expires_at TEXT,created_at TEXT)');
    this.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,?,?)').run('session-1','google-user-123','admin@example.com','Admin','2099-01-01T00:00:00Z','2026');
  }
  prepare(sql:string){
    const db=this.db;
    const stmt=(args:any[]=[])=>({
      bind:(...values:any[])=>stmt(values),
      first:async()=>db.prepare(sql).get(...args),
      all:async()=>({results:db.prepare(sql).all(...args)}),
      run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})
    });
    return stmt();
  }
}
const scope='corporate';
const origin='https://example.com';
const b64=(b:Uint8Array)=>btoa(Array.from(b,c=>String.fromCharCode(c)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const utf8=(s:string)=>new TextEncoder().encode(s);
const join=(...parts:Uint8Array[])=>{const out=new Uint8Array(parts.reduce((n,v)=>n+v.length,0));let pos=0;for(const part of parts){out.set(part,pos);pos+=part.length}return out};
const sha=async (bytes:Uint8Array)=>new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
const cborBytes=(bytes:Uint8Array)=>bytes.length<24?join(Uint8Array.of(0x40+bytes.length),bytes):join(Uint8Array.of(0x58,bytes.length),bytes);
const der=(raw:Uint8Array)=>{
  const integer=(n:Uint8Array)=>{
    let start=0;while(start<31&&n[start]===0)start++;
    let bytes=n.slice(start);
    if(bytes[0]&128)bytes=join(Uint8Array.of(0),bytes);
    return join(Uint8Array.of(2,bytes.length),bytes);
  };
  const value=join(integer(raw.slice(0,32)),integer(raw.slice(32)));
  return join(Uint8Array.of(0x30,value.length),value);
};
const jsonData=(type:string,challenge:string,target=origin)=>b64(utf8(JSON.stringify({type,challenge,origin:target,crossOrigin:false})));
async function call(db:TestDB,path:string,payload:unknown,session=false,customOrigin=origin){
  const headers:Record<string,string>={'content-type':'application/json',origin:customOrigin};
  if(session)headers.cookie='obn_session=session-1';
  return (await handlePasskeyAuth(new Request(origin+'/api/auth/passkey/'+path,{method:'POST',headers,body:JSON.stringify(payload)}),{DB:db as any}))!;
}
async function makeCredential(db:TestDB,forScope:'corporate'|'collaborator'='corporate',clientOrigin=origin){
  const token=forScope==='collaborator'?'edu-valid':undefined;
  const opts=(await (await call(db,'register/options',{scope:forScope,token},forScope==='corporate')).json()) as any;
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);
  const raw=(input:string)=>Uint8Array.from(atob(input.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-input.length%4)%4)),c=>c.charCodeAt(0));
  const credentialId=crypto.getRandomValues(new Uint8Array(32)),id=b64(credentialId);
  const cose=join(Uint8Array.of(0xa5,0x01,0x02,0x03,0x26,0x20,0x01,0x21),cborBytes(raw(jwk.x!)),Uint8Array.of(0x22),cborBytes(raw(jwk.y!)));
  const rpHash=await sha(utf8('example.com'));
  const authData=join(rpHash,Uint8Array.of(0x45,0,0,0,0),new Uint8Array(16),Uint8Array.of(0,32),credentialId,cose);
  const attestation=join(Uint8Array.of(0xa3,0x63),utf8('fmt'),Uint8Array.of(0x64),utf8('none'),Uint8Array.of(0x67),utf8('attStmt'),Uint8Array.of(0xa0,0x68),utf8('authData'),cborBytes(authData));
  const response={id,type:'public-key',response:{clientDataJSON:jsonData('webauthn.create',opts.challenge,clientOrigin),attestationObject:b64(attestation)}};
  const enrolled=await call(db,'register/verify',{scope:forScope,token,response},forScope==='corporate');
  return {enrolled,id,keys,rpHash,forScope};
}
async function signIn(db:TestDB,keys:CryptoKeyPair,id:string,rpHash:Uint8Array,forScope:'corporate'|'collaborator'='corporate',override?:{origin?:string;counter?:number;signature?:string}){
  const options=(await (await call(db,'login/options',{scope:forScope})).json()) as any;
  const count=override?.counter??1;
  const authData=join(rpHash,Uint8Array.of(0x05),Uint8Array.of((count>>>24)&255,(count>>>16)&255,(count>>>8)&255,count&255));
  const data=jsonData('webauthn.get',options.challenge,override?.origin||origin);
  const raw=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,join(authData,await sha(Uint8Array.from(atob(data.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-data.length%4)%4)),c=>c.charCodeAt(0))))));
  const response={id,type:'public-key',response:{clientDataJSON:data,authenticatorData:b64(authData),signature:override?.signature||b64(der(raw))}};
  return {result:await call(db,'login/verify',{scope:forScope,response}),response};
}

describe('WebAuthn/Face ID sign-in with canonical web and collaborator sessions',()=>{
  it('requires the existing authenticated account to register a passkey',async()=>{
    const db=new TestDB();
    const result=await call(db,'register/options',{scope});
    expect(result.status).toBe(401);
    const options=await call(db,'register/options',{scope},true);
    expect(options.status).toBe(200);
    const parsed=await options.json() as any;
    expect(parsed.authenticatorSelection).toMatchObject({residentKey:'required',userVerification:'required'});
    expect(parsed.pubKeyCredParams).toEqual([{type:'public-key',alg:-7}]);
  });
  it('registers an ES256 passkey and signs in without a password, with a real cryptographic signature',async()=>{
    const db=new TestDB(),credential=await makeCredential(db);
    expect(credential.enrolled.status).toBe(200);
    const {result,response}=await signIn(db,credential.keys,credential.id,credential.rpHash);
    expect(result.status).toBe(200);
    expect(result.headers.get('set-cookie')).toContain('obn_session=');
    const sessions=(db.db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get() as any).n;
    expect(sessions).toBe(2);
    expect((await call(db,'login/verify',{scope,response})).status).toBe(401);
  });
  it('rejects a registration created for another origin',async()=>{
    const db=new TestDB(),credential=await makeCredential(db,'corporate','https://evil.example');
    expect(credential.enrolled.status).toBe(400);
    expect((db.db.prepare('SELECT COUNT(*) AS n FROM passkey_credentials').get() as any).n).toBe(0);
  });
  it('rejects tampered signatures and never issues a session',async()=>{
    const db=new TestDB(),credential=await makeCredential(db);
    expect(credential.enrolled.status).toBe(200);
    const result=await signIn(db,credential.keys,credential.id,credential.rpHash,'corporate',{signature:b64(new Uint8Array(64))});
    expect(result.result.status).toBe(401);
    expect((db.db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get() as any).n).toBe(1);
  });
  it('rejects counter rollback after a successful sign-in',async()=>{
    const db=new TestDB(),credential=await makeCredential(db);
    expect((await signIn(db,credential.keys,credential.id,credential.rpHash)).result.status).toBe(200);
    expect((await signIn(db,credential.keys,credential.id,credential.rpHash,'corporate',{counter:1})).result.status).toBe(401);
  });
  it('reuses collaborator tokens only for active collaborators',async()=>{
    const db=new TestDB(),credential=await makeCredential(db,'collaborator');
    expect(credential.enrolled.status).toBe(200);
    const result=(await signIn(db,credential.keys,credential.id,credential.rpHash,'collaborator')).result;
    expect(result.status).toBe(200);
    expect((await result.json() as any).token).toBe('edu-issued');
  });
  it('prevents a corporate credential from authenticating as a collaborator',async()=>{
    const db=new TestDB(),credential=await makeCredential(db);
    expect((await signIn(db,credential.keys,credential.id,credential.rpHash,'collaborator')).result.status).toBe(401);
  });
  it('refuses cross-site requests before creating any challenge',async()=>{
    const db=new TestDB(),response=await call(db,'login/options',{scope},false,'https://evil.example');
    expect(response.status).toBe(403);
  });
  it('lets a signed-in user revoke their own credentials',async()=>{
    const db=new TestDB(),credential=await makeCredential(db);
    const listed=await call(db,'list',{scope},true);
    expect((await listed.json() as any).credentials).toHaveLength(1);
    expect((await call(db,'remove',{scope,id:credential.id},false)).status).toBe(401);
    expect((await call(db,'remove',{scope,id:credential.id},true)).status).toBe(200);
    expect((await call(db,'list',{scope},true).then(r=>r.json()) as any).credentials).toHaveLength(0);
  });
});
