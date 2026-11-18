'use strict'
(function(){
 const $=id=>document.getElementById(id)
 const state={token:sessionStorage.getItem('obra-finance-session')||'',company:'',bank:'',tab:'accounts',banks:[],works:[],companies:[],preview:null,file:null,base64:'',fileName:'',mapping:{},search:'',status:'all',work:'',start:'',end:'',transaction:'',selectedPayments:new Map(),cashBank:'',cashWork:'',date:new Date().toLocaleDateString('en-CA'),horizon:30,editing:null}
 const dateToday=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
 state.date=dateToday()
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100)
 const pct=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(Number(n||0))
 const id=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'finance-web-'+Date.now()+'-'+Math.random().toString(36).slice(2)
 const n=(v)=>Number(v||0)
 function node(type,className,text){
  const e=document.createElement(type)
  if(className)e.className=className
  if(text!==undefined)e.textContent=String(text)
  return e
 }
 function append(p,type,cls,txt){const e=node(type,cls,txt);p.append(e);return e}
 function panel(p,title){const e=append(p,'section','panel');append(e,'h2','',title);return e}
 function button(p,label,fn,cls){const el=append(p,'button',cls||'',label);el.type='button';el.addEventListener('click',()=>{Promise.resolve(fn()).catch(noticeError)});return el}
 function form(p,cls){return append(p,'form',cls||'filters')}
 function field(p,label,type='text',value=''){
  const wrap=append(p,'label')
  append(wrap,'span','',label)
  const el=append(wrap,'input')
  el.type=type;el.value=value==null?'':String(value)
  return el
 }
 function select(p,label,values,current,onChange){
  const wrap=append(p,'label')
  append(wrap,'span','',label)
  const s=append(wrap,'select')
  for(const [v,name] of values){const opt=append(s,'option','',name);opt.value=String(v)}
  s.value=current==null?'':String(current)
  if(onChange)s.addEventListener('change',()=>onChange(s.value))
  return s
 }
 function table(p,heads,items){
  const wrap=append(p,'div','table-wrap'),t=append(wrap,'table'),head=append(t,'thead'),tr=append(head,'tr')
  for(const x of heads)append(tr,'th','',x)
  const body=append(t,'tbody')
  for(const row of items){const r=append(body,'tr');for(const x of row){const cell=append(r,'td');if(x instanceof Node)cell.append(x);else cell.textContent=String(x??'')}}
  return body
 }
 function notice(message,error=false){const el=$('notice');el.hidden=false;el.className=error?'error':'';el.textContent=message}
 const noticeError=e=>notice(e?.message||String(e),true)
 function clear(p){p.replaceChildren()}
 function metric(p,label,val,hint){const e=append(p,'div','metric');append(e,'small','',label);append(e,'b','',val);if(hint)append(e,'small','',hint)}
 function actions(p){return append(p,'div','actions')}
 async function request(path,{method='GET',body,anonymous=false}={}){
  const headers={'accept':'application/json'}
  if(!anonymous&&state.token)headers.authorization='Bearer '+state.token
  if(body!==undefined)headers['content-type']='application/json'
  const response=await fetch(path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store'})
  let data=null
  try{data=await response.json()}catch{}
  if(response.status===401&&!anonymous){logout();throw Error('Sua sessão expirou ou o dispositivo foi revogado. Conecte novamente.')}
  if(!response.ok)throw Error(data?.message||data?.error||'Falha de comunicação ('+response.status+').')
  return data
 }
 function get(path,params){const q=new URLSearchParams();Object.entries(params||{}).forEach(([k,v])=>{if(v!==''&&v!==null&&v!==undefined)q.set(k,String(v))});return request(path+(q.toString()?'?'+q:''))}
 const post=(path,body)=>request(path,{method:'POST',body})
 const patch=(path,body)=>request(path,{method:'PATCH',body})
 function logout(){state.token='';sessionStorage.removeItem('obra-finance-session');$('connection').hidden=false;$('app').hidden=true;$('logout').hidden=true;state.preview=null;state.file=null}
 async function connect(token){
  state.token=token
  const session=await request('/api/v1/session')
  if(!session?.member)throw Error('Sessão não autorizada.')
  const companies=await get('/api/v1/finance/companies')
  if(!Array.isArray(companies))throw Error('Nenhuma empresa financeira disponível.')
  sessionStorage.setItem('obra-finance-session',token)
  $('member').textContent=(session.member.name||session.member.email||'Usuário')+' · '+(session.member.role||'')
  $('connection').hidden=true;$('app').hidden=false;$('logout').hidden=false
  state.companies=companies
  state.company=companies.some(c=>String(c.id)===state.company)?state.company:String(companies[0]?.id||'')
  await loadReference()
 }
 async function loadReference(){
  if(!state.company){notice('Cadastre uma empresa para utilizar o financeiro.',true);return}
  const [banks,works]=await Promise.all([get('/api/v1/finance/bank-accounts',{empresaId:state.company}),get('/api/v1/finance/works',{empresaId:state.company})])
  state.banks=banks;state.works=works
  if(!state.banks.some(b=>String(b.id)===state.bank))state.bank=String(state.banks[0]?.id||'')
  updateCompanySelect()
  await render()
 }
 function updateCompanySelect(){
  const s=$('company');clear(s)
  for(const c of state.companies){const op=append(s,'option','',c.nome_fantasia||c.razao_social||'Empresa '+c.id);op.value=String(c.id)}
  s.value=state.company
 }
 const bankValues=()=>[['','Selecione uma conta'],...state.banks.map(b=>[b.id,b.nome+' · '+b.banco_nome])]
 const workValues=()=>[['','Todas as obras / administrativo'],...state.works.map(w=>[w.id,w.nome])]
 function bankChoose(p,handler){return select(p,'Conta bancária',bankValues(),state.bank,v=>{state.bank=v;state.preview=null;handler&&handler()})}
 const message=(p,t,cls='warn')=>append(p,'p',cls,t)
 function cents(value){
  const s=String(value||'').trim().replace(/\s/g,'')
  if(!/^-?\d{1,12}(?:\.\d{3})*(?:,\d{1,2})?$/.test(s)&&!/^-?\d{1,12}(?:,\d{1,2})?$/.test(s))throw Error('Informe um valor em reais: 100,00.')
  const v=Math.round(Number(s.replace(/\./g,'').replace(',','.'))*100)
  if(!Number.isSafeInteger(v))throw Error('Valor excede o limite permitido.')
  return v
 }
 async function render(){
  const mount=$('view');clear(mount)
  document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===state.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})
  try{
   if(state.tab==='accounts')await showAccounts(mount)
   else if(state.tab==='imports')await showImports(mount)
   else if(state.tab==='reconcile')await showReconcile(mount)
   else if(state.tab==='cash')await showCash(mount)
  }catch(e){const p=panel(mount,'Não foi possível carregar');message(p,e.message||String(e))}
 }
 async function showAccounts(mount){
  const p=panel(mount,'Contas bancárias')
  append(p,'p','', 'As contas pertencem à empresa selecionada. Uma conta não pertence exclusivamente a uma obra.')
  const grid=append(p,'div','cardlist')
  for(const b of state.banks){
   const card=append(grid,'div','bank'+(String(b.id)===state.bank?' selected':''));append(card,'strong','',b.nome);append(card,'span','',b.banco_nome);append(card,'small','','Saldo de referência: '+money(b.saldo_inicial_centavos)+' em '+b.saldo_referencia_data)
   append(card,'small','',b.ativo?'Ativa':'Inativa')
   const ops=actions(card)
   button(ops,'Usar esta conta',()=>{state.bank=String(b.id);return render()},'secondary small')
   button(ops,'Editar',()=>{state.editing=b.id;return render()},'secondary small')
   button(ops,b.ativo?'Desativar':'Ativar',async()=>{if(!confirm('Deseja alterar o status de '+b.nome+'? O histórico será preservado.'))return;await patch('/api/v1/finance/bank-accounts/'+b.id,{empresaId:n(state.company),nome:b.nome,bancoNome:b.banco_nome,agencia:b.agencia||'',contaIdentificador:b.conta_identificador||'',tipoConta:b.tipo_conta,saldoInicialCentavos:b.saldo_inicial_centavos,saldoReferenciaData:b.saldo_referencia_data,ativo:!b.ativo});notice('Conta atualizada.');await loadReference()},'secondary small')
  }
  const bank=state.banks.find(b=>b.id===state.editing)
  const f=panel(mount,bank?'Editar conta bancária':'Adicionar conta bancária')
  const formEl=form(f)
  const name=field(formEl,'Nome da conta','text',bank?.nome||'')
  const institution=field(formEl,'Banco','text',bank?.banco_nome||'')
  const branch=field(formEl,'Agência','text',bank?.agencia||'')
  const number=field(formEl,'Identificação da conta','text',bank?.conta_identificador||'')
  const type=select(formEl,'Tipo',[['corrente','Corrente'],['poupanca','Poupança'],['pagamento','Pagamento'],['outra','Outra']],bank?.tipo_conta||'corrente')
  const initial=field(formEl,'Saldo de referência (R$)','text',bank?new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(bank.saldo_inicial_centavos/100):'0,00')
  const reference=field(formEl,'Data do saldo de referência','date',bank?.saldo_referencia_data||dateToday())
  const ops=actions(formEl)
  const save=button(ops,bank?'Salvar alterações':'Cadastrar conta',async()=>{
   const payload={empresaId:n(state.company),nome:name.value,bancoNome:institution.value,agencia:branch.value,contaIdentificador:number.value,tipoConta:type.value,saldoInicialCentavos:cents(initial.value),saldoReferenciaData:reference.value,requestId:id()}
   if(bank)await patch('/api/v1/finance/bank-accounts/'+bank.id,payload)
   else await post('/api/v1/finance/bank-accounts',payload)
   state.editing=null;notice('Conta salva.');await loadReference()
  })
  save.disabled=false
  if(bank)button(ops,'Cancelar',()=>{state.editing=null;return render()},'secondary')
 }
 function fileToBase64(file){
  return new Promise((ok,fail)=>{const reader=new FileReader();reader.onload=()=>ok(String(reader.result||'').split(',')[1]||'');reader.onerror=()=>fail(Error('Não foi possível ler o extrato.'));reader.readAsDataURL(file)})
 }
 function importPayload(){return{empresaId:n(state.company),contaBancariaId:n(state.bank),fileName:state.fileName,format:state.fileName.toLowerCase().split('.').pop(),contentBase64:state.base64,mapping:state.mapping}}
 async function showImports(mount){
  const p=panel(mount,'Importar extrato bancário')
  append(p,'p','','Selecione a conta, revise a prévia e confirme. A importação não cria pagamentos, recebimentos ou despesas.')
  const row=append(p,'div','filters')
  bankChoose(row,()=>render())
  const label=append(row,'label');append(label,'span','','Arquivo OFX ou CSV')
  const input=append(label,'input');input.type='file';input.accept='.csv,.ofx'
  input.addEventListener('change',async()=>{
   try{
    const f=input.files?.[0];state.preview=null;state.file=null;state.base64=''
    if(!f)return
    if(!/\.(ofx|csv)$/i.test(f.name)||f.size>4*1024*1024)throw Error('Use OFX/CSV com até 4 MB.')
    state.file=f;state.fileName=f.name;state.base64=await fileToBase64(f);notice('Arquivo selecionado. Confira a prévia.')
   }catch(e){noticeError(e)}
  })
  const m=append(p,'div','filters')
  const mapping=[]
  for(const [key,labelText] of [['date','Coluna data (índice, opcional)'],['description','Coluna descrição'],['amount','Coluna valor'],['credit','Coluna entrada'],['debit','Coluna saída'],['id','Coluna identificador']]){
   const el=field(m,labelText,'number',state.mapping[key]??'');el.min='0';mapping.push([key,el])
  }
  const ops=actions(p)
  button(ops,'Conferir prévia',async()=>{
   if(!state.bank||!state.base64)throw Error('Selecione conta bancária e arquivo OFX/CSV.')
   state.mapping=Object.fromEntries(mapping.filter(([,el])=>el.value!=='').map(([key,el])=>[key,Number(el.value)]))
   state.preview=await post('/api/v1/finance/bank-imports/preview',importPayload());await render()
  })
  if(state.preview){
   const pre=panel(mount,'Prévia · '+state.fileName)
   const summary=append(pre,'div','grid4')
   metric(summary,'Linhas',state.preview.total);metric(summary,'Novas',state.preview.importable);metric(summary,'Duplicadas',state.preview.duplicates);metric(summary,'Inválidas',state.preview.invalid)
   if(state.preview.duplicatedFile)message(pre,'Este arquivo já foi importado nesta conta.')
   if(state.preview.invalidRows?.length)message(pre,state.preview.invalidRows.map(x=>'Linha '+x.line+': '+x.reason).join(' | '))
   table(pre,['Data','Descrição','Valor','Situação'],state.preview.preview.map(x=>[x.date,x.description,money(x.amountCents),x.duplicate?'Já existente':'Nova']))
   const checkbox=append(pre,'label','row-check')
   const check=append(checkbox,'input');check.type='checkbox';append(checkbox,'span','','Confirmo importação parcial, ignorando linhas inválidas.')
   checkbox.hidden=!state.preview.invalid
   const buttons=actions(pre)
   const confirmButton=button(buttons,'Confirmar importação',async()=>{
    const p={...importPayload(),previewHash:state.preview.previewHash,acceptInvalid:check.checked}
    const outcome=await post('/api/v1/finance/bank-imports/confirm',p)
    state.preview=null;state.file=null;state.base64='';notice(outcome.imported+' novos, '+outcome.duplicates+' duplicados, '+outcome.rejected+' inválidos.')
    await render()
   })
   if(state.preview.duplicatedFile||!state.preview.importable)confirmButton.disabled=true
   if(state.preview.invalid){confirmButton.disabled=true;check.addEventListener('change',()=>confirmButton.disabled=!check.checked)}
  }
  if(state.bank){
   const history=await get('/api/v1/finance/bank-imports',{empresaId:state.company,contaBancariaId:state.bank})
   const h=panel(mount,'Histórico de importações')
   table(h,['Arquivo','Novas','Duplicadas','Rejeitadas','Data'],history.map(x=>[x.nome_arquivo,x.importadas,x.duplicadas,x.rejeitadas,x.created_at]))
  }
 }
 async function showReconcile(mount){
  const p=panel(mount,'Conciliação bancária')
  append(p,'p','','Vincule movimentos a pagamentos ou recebimentos já existentes. As sugestões não efetivam baixas. É possível alocar vários pagamentos e desfazer com justificativa.')
  const fs=append(p,'div','filters')
  bankChoose(fs,()=>{state.transaction='';return render()})
  select(fs,'Situação',[['all','Todas'],['pending','Pendentes'],['partial','Parciais'],['reconciled','Conciliadas']],state.status,v=>{state.status=v;state.transaction='';render()})
  const start=field(fs,'Data inicial','date',state.start)
  const end=field(fs,'Data final','date',state.end)
  select(fs,'Obra atribuída',workValues(),state.work,v=>{state.work=v;state.transaction='';render()})
  const search=field(fs,'Descrição','search',state.search)
  button(actions(p),'Filtrar movimentações',()=>{state.start=start.value;state.end=end.value;state.search=search.value;state.transaction='';return render()},'secondary')
  if(!state.bank){message(p,'Cadastre uma conta bancária antes de conciliar.');return}
  const movements=await get('/api/v1/finance/bank-transactions',{empresaId:state.company,contaBancariaId:state.bank,status:state.status,startDate:state.start,endDate:state.end,obraId:state.work,search:state.search})
  const section=panel(mount,'Movimentações do extrato')
  append(section,'small','muted',movements.length+' registro(s); a visão de obra mostra apenas movimentos atribuídos.')
  if(!movements.length){message(section,'Não há movimentações com estes filtros.');return}
  if(!movements.some(x=>String(x.id)===state.transaction))state.transaction=String(movements[0].id)
  select(section,'Movimento para conciliar',movements.map(x=>[x.id,x.data+' · '+x.descricao+' · '+money(x.valor_centavos)]),state.transaction,v=>{state.transaction=v;state.selectedPayments.clear();render()})
  table(section,['Data','Descrição','Valor','Conciliado','Situação'],movements.map(x=>{
   const used=Number(x.conciliado_centavos||0),value=Math.abs(x.valor_centavos)
   return[x.data,x.descricao,money(x.valor_centavos),money(used),used>=value?'Conciliada':used>0?'Parcial':'Pendente']
  }))
  const tx=movements.find(x=>String(x.id)===state.transaction)
  if(!tx)return
  const suggested=await get('/api/v1/finance/bank-reconciliation/suggestions',{empresaId:state.company,contaBancariaId:state.bank,transacaoId:tx.id,includeAll:true})
  const ss=panel(mount,'Vincular movimento selecionado')
  const summ=append(ss,'div','grid4')
  metric(summ,'Valor no extrato',money(tx.valor_centavos))
  metric(summ,'Conciliado',money(suggested.reconciledCents))
  metric(summ,'Restante',money(suggested.remainingCents))
  if(!suggested.suggestions.length)message(ss,'Nenhum pagamento registrado compatível. Cadastre a baixa em Financeiro > Contas e atualize.')
  const chosen=[]
  for(const x of suggested.suggestions){
   const row=append(ss,'div','bank')
   const lab=append(row,'label','row-check'),check=append(lab,'input');check.type='checkbox'
   append(lab,'span','',x.descricao+' · '+x.data+' · disponível '+money(x.availableCents))
   const amount=field(row,'Valor a vincular (R$)','text',new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(x.availableCents/100))
   amount.disabled=true
   check.addEventListener('change',()=>amount.disabled=!check.checked)
   chosen.push({check,amount,paymentId:x.pagamentoId})
  }
  const confirm=button(actions(ss),'Confirmar conciliação',async()=>{
   const allocations=chosen.filter(x=>x.check.checked).map(x=>({pagamentoId:x.paymentId,valorCentavos:cents(x.amount.value)}))
   if(!allocations.length)throw Error('Selecione ao menos um pagamento.')
   await post('/api/v1/finance/bank-reconciliation/confirm',{empresaId:n(state.company),contaBancariaId:n(state.bank),transacaoId:n(state.transaction),allocations,requestId:id()})
   notice('Conciliação confirmada, sem criar outro pagamento.');state.transaction='';await render()
  })
  if(!suggested.remainingCents||!suggested.suggestions.length)confirm.disabled=true
  const history=await get('/api/v1/finance/bank-reconciliation',{empresaId:state.company,contaBancariaId:state.bank})
  const h=panel(mount,'Histórico e reversões')
  for(const match of history){
   const line=append(h,'div','bank')
   append(line,'strong','','#'+match.id+' · '+money(match.allocatedCents)+' · '+(match.status==='active'?'Ativa':'Revertida'))
   append(line,'small','','Responsável: '+match.createdBy+' · '+match.createdAt)
   append(line,'span','',match.allocations.map(x=>x.descricao+' ('+money(x.valorCentavos)+')').join(' + '))
   if(match.status==='reversed')append(line,'small','', 'Motivo: '+match.reverseReason)
   else{
    const reason=field(line,'Justificativa para desfazer','text')
    button(actions(line),'Desfazer com justificativa',async()=>{
     if(reason.value.trim().length<8)throw Error('Justificativa deve ter ao menos 8 caracteres.')
     if(!confirm('Desfazer conciliação? Pagamentos permanecem registrados.'))return
     await post('/api/v1/finance/bank-reconciliation/reverse',{empresaId:n(state.company),loteId:match.id,reason:reason.value})
     notice('Conciliação revertida e registrada.');await render()
    },'secondary small')
   }
  }
 }
 function drawLine(p,days){
  if(!days?.length)return
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 800 180');svg.classList.add('chart');svg.setAttribute('role','img');svg.setAttribute('aria-label','Evolução do saldo projetado em '+days.length+' dias')
  const values=days.map(x=>Number(x.projectedBalanceCents)),min=Math.min(0,...values),max=Math.max(0,...values),span=Math.max(1,max-min)
  const pts=values.map((v,i)=>(20+760*i/Math.max(1,values.length-1))+','+(150-(v-min)/span*125)).join(' ')
  const poly=document.createElementNS('http://www.w3.org/2000/svg','polyline');poly.setAttribute('points',pts);svg.append(poly);p.append(svg)
 }
 async function showCash(mount){
  const p=panel(mount,'Fluxo de caixa e projeções')
  append(p,'p','','Filtre por banco e obra. Saldo de obra é resultado atribuído, não dinheiro disponível na conta bancária.')
  const fs=append(p,'div','filters')
  select(fs,'Banco', [['','Todas as contas'],...state.banks.map(x=>[x.id,x.nome])],state.cashBank,v=>{state.cashBank=v;render()})
  select(fs,'Obra',workValues(),state.cashWork,v=>{state.cashWork=v;render()})
  const date=field(fs,'Referência','date',state.date)
  select(fs,'Período',[['30','30 dias'],['60','60 dias'],['90','90 dias']],state.horizon,v=>{state.horizon=Number(v);render()})
  button(actions(p),'Recalcular',()=>{state.date=date.value;return render()},'secondary')
  const flow=await get('/api/v1/finance/cash-flow',{empresaId:state.company,contaBancariaId:state.cashBank,obraId:state.cashWork,asOf:state.date,horizonDays:state.horizon})
  const grid=append(mount,'div','grid4')
  metric(grid,flow.hasBankBalance?'Saldo por extratos':'Realizado atribuído à obra',money(flow.realizedCents))
  metric(grid,'Entradas previstas',money(flow.projectedReceivablesCents))
  metric(grid,'Saídas previstas',money(flow.projectedPayablesCents))
  metric(grid,flow.hasBankBalance?'Saldo final previsto':'Resultado gerencial da obra',money(flow.projectedEndCents))
  const chart=panel(mount,'Evolução diária')
  append(chart,'p','',flow.balanceDescription)
  if(flow.warnings?.length)for(const w of flow.warnings)message(chart,w)
  if(flow.negativeDays)message(chart,'Projeção negativa em '+flow.negativeDays+' dia(s) do período.')
  drawLine(chart,flow.days)
  table(chart,['Data','Entrada prevista','Saída prevista',flow.hasBankBalance?'Saldo projetado':'Resultado atribuído'],flow.days.map(x=>[x.date,money(x.projectedInCents),money(x.projectedOutCents),money(x.projectedBalanceCents)]))
  const assignment=panel(mount,'Planejar banco de cada obrigação')
  append(assignment,'p','','Obrigações sem banco escolhido entram no consolidado da empresa, mas não em uma conta específica.')
  const obligations=await get('/api/v1/finance/planned-banks',{empresaId:state.company,obraId:state.cashWork,asOf:state.date})
  const tableBody=table(assignment,['Descrição','Vencimento','Pendente','Banco planejado'],obligations.filter(x=>x.pendente_centavos>0).map(x=>[x.descricao,x.vencimento,money(x.pendente_centavos),'']))
  obligations.filter(x=>x.pendente_centavos>0).forEach((x,i)=>{
   const cell=tableBody.children[i]?.lastElementChild
   if(!cell)return
   const dropdown=append(cell,'select')
   for(const [v,label] of [['','Não definido'],...state.banks.map(b=>[b.id,b.nome+' · '+b.banco_nome])]){const o=append(dropdown,'option','',label);o.value=String(v)}
   dropdown.value=String(x.conta_bancaria_id??'')
   dropdown.addEventListener('change',async()=>{try{dropdown.disabled=true;await post('/api/v1/finance/planned-banks',{empresaId:n(state.company),contaId:x.conta_id,contaBancariaId:dropdown.value?Number(dropdown.value):null});notice('Conta bancária prevista atualizada.');await render()}catch(e){noticeError(e);dropdown.disabled=false}})
  })
  const hist=panel(mount,'Movimentos realizados (30 dias)')
  table(hist,['Data','Entradas','Saídas','Saldo'],flow.history.map(x=>[x.date,money(x.realizedInCents),money(x.realizedOutCents),x.balanceCents==null?'Sem saldo bancário comparável':money(x.balanceCents)]))
 }
 $('pair-form').addEventListener('submit',async e=>{
  e.preventDefault()
  try{
   const code=$('pair-code').value.trim(),deviceName=$('device-name').value.trim()
   if(!code||!deviceName)throw Error('Informe o código de pareamento e o nome do dispositivo.')
   if(location.protocol==='http:'&&!['localhost','127.0.0.1','::1'].includes(location.hostname))notice('Conexão HTTP local: use HTTPS ou VPN para acesso remoto.')
   const result=await request('/api/v1/pair/claim',{method:'POST',body:{code,installationId:id(),deviceName},anonymous:true})
   if(!result.deviceToken)throw Error('Servidor não retornou credencial válida.')
   await connect(result.deviceToken)
   $('pair-code').value=''
   notice('Dispositivo pareado com sucesso.')
  }catch(error){noticeError(error)}
 })
 $('logout').addEventListener('click',()=>{logout();notice('Sessão encerrada nesta aba.')})
 $('company').addEventListener('change',()=>{state.company=$('company').value;state.bank='';state.cashBank='';state.cashWork='';state.work='';loadReference().catch(noticeError)})
 $('reload').addEventListener('click',()=>loadReference().catch(noticeError))
 document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{state.tab=button.dataset.tab;render().catch(noticeError)}))
 if(state.token)connect(state.token).catch(()=>{logout();notice('Reconecte com novo código autorizado.',true)})
})()
