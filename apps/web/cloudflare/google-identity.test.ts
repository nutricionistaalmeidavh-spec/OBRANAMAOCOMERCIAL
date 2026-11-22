import { describe, expect, it } from 'vitest';
import { GoogleIdentityFailure, linkedUserIdForPassword, resolveGoogleIdentity, verifiedGoogleClaims } from './google-identity';

type Row = Record<string, any>;
class FakeD1 {
  links: Row[] = [];
  passwordEmails = new Set<string>();
  members = new Map<string, Row[]>();
  platform = new Map<string, Row>();
  licenseIds = new Map<string,string>();
  licenses = new Map<string,Row>();
  prepare(sql: string) {
    const self=this;
    let params: any[]=[];
    return {
      bind(...values:any[]) { params=values; return this; },
      async run() {
        if (sql.includes('CREATE TABLE IF NOT EXISTS google_identity_links')) return {success:true};
        if (sql.includes('INSERT OR IGNORE INTO google_identity_links')) {
          const [sub,email,user_id,created_at]=params;
          if (!self.links.some(x=>x.sub===sub||x.email===email)) self.links.push({sub,email,user_id,created_at});
          return {success:true};
        }
        throw new Error('Unexpected run: '+sql);
      },
      async first():Promise<any> {
        if (sql.includes('FROM google_identity_links WHERE sub=?')) return self.links.find(x=>x.sub===params[0])||null;
        if (sql.includes('FROM google_identity_links WHERE email=?')) return self.links.find(x=>x.email===params[0])||null;
        if (sql.includes("FROM sqlite_master") && sql.includes("password_credentials")) return self.passwordEmails.size?{name:'password_credentials'}:null;
        if (sql.includes('FROM password_credentials WHERE email=?')) return self.passwordEmails.has(params[0])?{email:params[0]}:null;
        if (sql.includes("FROM kv_records WHERE collection='platform_accesses'")) {
          const row=[...self.platform.values()].find(x=>x.id===params[0]);
          return row?{record_json:JSON.stringify(row)}:null;
        }
        if (sql.includes("FROM kv_records WHERE collection='licenses'")) {
          const lic=self.licenses.get(params[0]);return lic?{record_json:JSON.stringify(lic)}:null;
        }
        if (sql.includes('FROM kv_records WHERE collection=?')) {
          const collection=params[0];
          if (collection.startsWith('platform_access_email_')) {
            const p=[...self.platform.values()][0];return p?{record_json:JSON.stringify({accessId:p.id})}:null;
          }
          if (collection.startsWith('license_email_')) {
            const id=self.licenseIds.get(collection);return id?{record_json:JSON.stringify({licenseId:id})}:null;
          }
        }
        throw new Error('Unexpected first: '+sql);
      },
      async all():Promise<any> {
        if (sql.includes('FROM kv_records WHERE collection=?')) {
          const collection=params[0];
          if (collection.startsWith('access_')) return {results:(self.members.get(collection)||[]).map(x=>({record_json:JSON.stringify(x)}))};
          if (collection.startsWith('license_email_')) {const id=self.licenseIds.get(collection);return {results:id?[{record_json:JSON.stringify({licenseId:id})}]:[]};}
        }
        throw new Error('Unexpected all: '+sql);
      }
    };
  }
}
const claims=(sub='google-sub-1',email='client@example.com')=>({sub,email,name:'Cliente'});
const db=(v:FakeD1)=>v as unknown as D1Database;
function membershipKey(email:string) {
  let h=2166136261;for(const ch of email){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return 'access_'+email.slice(0,28).replace(/[^a-zA-Z0-9_-]/g,'_')+'_'+(h>>>0).toString(16);
}
describe('P0 Google identity and canonical account links',()=>{
  it('accepts a verified Google identity with the expected OAuth client and issuer',()=>{
    expect(verifiedGoogleClaims({aud:'client-id',iss:'https://accounts.google.com',email_verified:'true',sub:'google-sub-1',email:'CLIENT@example.com',name:'Cliente'},'client-id')).toEqual(claims());
  });
  it.each([
    [{aud:'other',iss:'https://accounts.google.com',email_verified:'true',sub:'1',email:'client@example.com'},'client-id'],
    [{aud:'client-id',iss:'https://untrusted.example',email_verified:'true',sub:'1',email:'client@example.com'},'client-id'],
    [{aud:'client-id',iss:'https://accounts.google.com',email_verified:'false',sub:'1',email:'client@example.com'},'client-id'],
    [{aud:'client-id',iss:'https://accounts.google.com',email_verified:'true',email:'client@example.com'},'client-id']
  ])('rejects untrusted Google ID token claims', (token,clientId)=>{
    expect(()=>verifiedGoogleClaims(token,clientId)).toThrow(GoogleIdentityFailure);
  });
  it('preserves the canonical ID of a previously registered client without creating another membership', async()=>{
    const state=new FakeD1();state.members.set(membershipKey('client@example.com'),[{userId:'pwd:existing-id',status:'active',projectId:'obra-a'}]);
    const first=await resolveGoogleIdentity(db(state),claims());
    const second=await resolveGoogleIdentity(db(state),claims());
    expect(first.userId).toBe('pwd:existing-id');
    expect(second.userId).toBe(first.userId);
    expect(state.links).toHaveLength(1);
    expect(state.members.get(membershipKey('client@example.com'))).toHaveLength(1);
  });
  it('authenticates a new Google account without creating a company or granting a license',async()=>{
    const state=new FakeD1();
    expect((await resolveGoogleIdentity(db(state),claims())).userId).toBe('google-sub-1');
    expect(state.links).toHaveLength(1);
    expect(state.members.size).toBe(0);
    expect(state.licenses.size).toBe(0);
  });
  it('rejects a different Google sub trying to take the same verified email',async()=>{
    const state=new FakeD1();
    await resolveGoogleIdentity(db(state),claims());
    await expect(resolveGoogleIdentity(db(state),claims('other-google-sub'))).rejects.toMatchObject({status:403});
    expect(state.links).toHaveLength(1);
  });
  it('rejects the same Google account trying to silently switch its linked email',async()=>{
    const state=new FakeD1();
    await resolveGoogleIdentity(db(state),claims());
    await expect(resolveGoogleIdentity(db(state),claims('google-sub-1','other@example.com'))).rejects.toMatchObject({status:403});
  });
  it('blocks accounts suspended in the platform before issuing a Google session',async()=>{
    const state=new FakeD1();state.platform.set('blocked',{id:'blocked',email:'client@example.com',status:'blocked'});
    await expect(resolveGoogleIdentity(db(state),claims())).rejects.toMatchObject({status:403});
    expect(state.links).toHaveLength(0);
  });
  it('preserves the linked canonical user ID when signing in later with a password',async()=>{
    const state=new FakeD1();
    state.members.set(membershipKey('client@example.com'),[{userId:'legacy-canonical-id',status:'active'}]);
    await resolveGoogleIdentity(db(state),claims());
    expect(await linkedUserIdForPassword(db(state),'CLIENT@example.com','pwd:other-id')).toBe('legacy-canonical-id');
  });
  it('reuses an existing link with password sign-in, rather than rebinding membership',async()=>{
    const state=new FakeD1();state.members.set(membershipKey('client@example.com'),[{userId:'old-google-id',status:'active'}]);
    await resolveGoogleIdentity(db(state),claims());
    expect(state.links[0].user_id).toBe('old-google-id');
  });
});
