// WebAuthn interface for iOS Face ID/Touch ID, Android biometrics and device PIN.
// Biometric data never leaves the device. This module is self-hosted and dependency-free.
(()=>{
  const supported=()=>Boolean(window.isSecureContext&&window.PublicKeyCredential&&navigator.credentials&&navigator.credentials.get&&navigator.credentials.create);
  const bytes=value=>{
    const input=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(input+'='.repeat((4-input.length%4)%4));
    return Uint8Array.from(raw,char=>char.charCodeAt(0));
  };
  const base64=buffer=>{
    const raw=Array.from(new Uint8Array(buffer),char=>String.fromCharCode(char)).join('');
    return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  };
  const assertSupported=()=>{
    if(!supported())throw new Error('Chaves de acesso não estão disponíveis neste navegador. Use o login normal.');
  };
  const api=async(path,payload)=>{
    const response=await fetch('/api/auth/passkey/'+path,{
      method:'POST',credentials:'include',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Não foi possível validar a chave de acesso.');
    return data;
  };
  const friendly=error=>{
    if(error&&error.name==='NotAllowedError')throw new Error('Verificação cancelada ou não disponível no aparelho.');
    if(error&&error.name==='InvalidStateError')throw new Error('Esta chave já está cadastrada neste aparelho.');
    throw error;
  };
  async function enroll(scope,token){
    assertSupported();
    const options=await api('register/options',{scope,token});
    const publicKey={
      ...options,challenge:bytes(options.challenge),
      user:{...options.user,id:bytes(options.user.id)}
    };
    let credential;
    try{credential=await navigator.credentials.create({publicKey})}catch(error){friendly(error)}
    if(!credential||!credential.response)throw new Error('Nenhuma chave de acesso foi criada.');
    const response={
      id:credential.id,type:credential.type,
      response:{
        clientDataJSON:base64(credential.response.clientDataJSON),
        attestationObject:base64(credential.response.attestationObject)
      }
    };
    return api('register/verify',{scope,token,response});
  }
  async function login(scope){
    assertSupported();
    const options=await api('login/options',{scope});
    const publicKey={...options,challenge:bytes(options.challenge)};
    let credential;
    try{credential=await navigator.credentials.get({publicKey})}catch(error){friendly(error)}
    if(!credential||!credential.response)throw new Error('Nenhuma chave de acesso selecionada.');
    const response={
      id:credential.id,type:credential.type,
      response:{
        clientDataJSON:base64(credential.response.clientDataJSON),
        authenticatorData:base64(credential.response.authenticatorData),
        signature:base64(credential.response.signature),
        userHandle:credential.response.userHandle?base64(credential.response.userHandle):null
      }
    };
    return api('login/verify',{scope,response});
  }
  const list=(scope,token)=>api('list',{scope,token});
  const remove=(scope,id,token)=>api('remove',{scope,id,token});
  window.obnPasskeys={supported,enroll,login,list,remove};
})();
