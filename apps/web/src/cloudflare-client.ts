type ApiResponse<T=any>={data:T};
async function request<T=any>(method:string,path:string,body?:unknown,query?:Record<string,unknown>):Promise<ApiResponse<T>>{
  const url=new URL(path,location.origin);
  if(query)for(const [key,value] of Object.entries(query))if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));
  const response=await fetch(url.toString(),{
    method,credentials:'include',headers:body===undefined?{}:{'content-type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  let data:any={};try{data=await response.json()}catch{}
  if(!response.ok){const error:any=new Error(data.error||data.message||('HTTP '+response.status));error.response={status:response.status,data};throw error}
  return {data};
}
export const api={
  get:<T=any>(path:string,query?:Record<string,unknown>)=>request<T>('GET',path,undefined,query),
  post:<T=any>(path:string,body?:unknown)=>request<T>('POST',path,body),
  put:<T=any>(path:string,body?:unknown)=>request<T>('PUT',path,body),
  delete:<T=any>(path:string,body?:unknown)=>request<T>('DELETE',path,body)
};
export const auth={
  isSignedIn:()=>document.cookie.split(';').some(x=>x.trim()==='obn_auth=1'),
  async signIn(_options?:{scope?:string}){location.assign('/api/auth/start?return='+encodeURIComponent(location.href));return new Promise<never>(()=>{})},
  async getUser(){try{return (await api.get<{user:{userId:string;email?:string;name?:string}}>('/api/auth/me')).data.user}catch{return null}},
  async signOut(){try{await api.post('/api/auth/logout',{})}finally{location.reload()}}
};
