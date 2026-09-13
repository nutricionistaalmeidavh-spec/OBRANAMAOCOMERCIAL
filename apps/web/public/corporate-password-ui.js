(()=>{
  const marker='corporate-password-enhanced';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const errorMessage=async response=>{try{const body=await response.json();return body.error||body.message||`HTTP ${response.status}`}catch{return`HTTP ${response.status}`}};
  const post=async(path,body)=>{const response=await fetch(path,{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw new Error(await errorMessage(response));return response.json()};
  function notice(form,text){let node=form.querySelector('.cp-corporate-notice');if(!node){node=document.createElement('p');node.className='cp-corporate-notice';form.appendChild(node)}node.textContent=text||''}
  function loginForm(section){
    section.classList.add(marker);
    const google=section.querySelector('#googleLogin');if(!google)return;
    const form=document.createElement('form');form.id='corporatePasswordLogin';form.className='cp-corporate-form';form.innerHTML=`
      <label for="corporateEmail">E-mail</label><input id="corporateEmail" type="email" autocomplete="username" placeholder="seuemail@empresa.com" required>
      <label for="corporatePassword">Senha</label><input id="corporatePassword" type="password" autocomplete="current-password" required>
      <button class="mh-primary" type="submit">Entrar</button>
      <button class="cp-text-button" id="corporateFirstAccess" type="button">Primeiro acesso</button>`;
    const divider=document.createElement('div');divider.className='cp-auth-divider';divider.textContent='ou';
    google.before(form,divider);
    form.addEventListener('submit',async event=>{event.preventDefault();const email=form.querySelector('#corporateEmail').value.trim(),password=form.querySelector('#corporatePassword').value;const submit=form.querySelector('button[type=submit]');submit.disabled=true;notice(form,'');try{await post('/api/auth/password/login',{email,password});location.hash='#portal';location.reload()}catch(error){notice(form,error.message||'Não foi possível entrar.')}finally{submit.disabled=false}});
    form.querySelector('#corporateFirstAccess').addEventListener('click',()=>firstAccessForm(section,String(form.querySelector('#corporateEmail').value||'')));
  }
  function firstAccessForm(section,prefill=''){
    section.innerHTML=`<h1>Primeiro acesso</h1><p>Use o e-mail liberado, o código recebido e a senha inicial. A senha não possui prazo obrigatório para troca.</p>
      <form id="corporateFirstAccessForm" class="cp-corporate-form">
        <label for="firstEmail">E-mail</label><input id="firstEmail" type="email" autocomplete="username" value="${esc(prefill)}" required>
        <label for="firstCode">Código de liberação</label><input id="firstCode" type="text" autocomplete="one-time-code" maxlength="12" autocapitalize="characters" required>
        <label for="firstPassword">Senha inicial</label><input id="firstPassword" type="password" autocomplete="current-password" minlength="8" required>
        <label for="firstCompany">Nome da empresa</label><input id="firstCompany" type="text" autocomplete="organization" required>
        <label for="firstProject">Primeira obra</label><input id="firstProject" type="text" required>
        <button class="mh-primary" type="submit">Ativar empresa e entrar</button>
        <button class="cp-text-button" id="corporateBackLogin" type="button">Voltar ao login</button>
      </form>`;
    const form=section.querySelector('#corporateFirstAccessForm');section.querySelector('#corporateBackLogin').addEventListener('click',()=>{section.classList.remove(marker);location.reload()});
    form.addEventListener('submit',async event=>{event.preventDefault();const submit=form.querySelector('button[type=submit]');submit.disabled=true;notice(form,'');try{
      const email=form.querySelector('#firstEmail').value.trim(),code=form.querySelector('#firstCode').value.trim().toUpperCase(),password=form.querySelector('#firstPassword').value,companyName=form.querySelector('#firstCompany').value.trim(),projectName=form.querySelector('#firstProject').value.trim();
      await post('/api/auth/password/first-access',{email,code,password});
      await post('/api/bootstrap/claim',{companyName,projectName,customer:companyName});
      location.hash='#portal';location.reload();
    }catch(error){notice(form,error.message||'Não foi possível concluir o primeiro acesso.');submit.disabled=false}});
  }
  function enhance(){const section=document.querySelector('.cp-login-form');if(!section||section.classList.contains(marker)||!section.querySelector('#googleLogin'))return;loginForm(section)}
  new MutationObserver(enhance).observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();
