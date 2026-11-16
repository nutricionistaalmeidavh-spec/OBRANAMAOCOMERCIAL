const token = new URLSearchParams(location.search).get('token')
const $ = id => document.getElementById(id)
const result = $('result')
const show = (message, type='') => { result.hidden=false;result.className=`status ${type}`;result.textContent=message }
async function request(route, data) {
  const response = await fetch(route, { method:data?'POST':'GET', headers:{ 'x-setup-token':token, ...(data?{'content-type':'application/json'}:{}) }, ...(data?{body:JSON.stringify(data)}:{}) })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Falha na comunicação com o configurador.')
  return payload
}
const settings = () => ({ publicUrl:$('url').value.trim(), port:Number($('port').value) })
async function action(button, task) {
  button.disabled = true
  try { await task() } catch (error) { show(error.message, 'error') } finally { button.disabled=false }
}
request('/api/state').then(state => { $('port').value=state.port;$('url').value=state.publicUrl }).catch(error => show(error.message,'error'))
$('setup').addEventListener('submit', event => { event.preventDefault();action($('save'),async()=>{show('Salvando configuração e verificando o serviço…');const data=await request('/api/config',settings());show(`${data.message}\nID: ${data.serverId}`,'ok');$('code').hidden=true}) })
$('test').addEventListener('click',()=>action($('test'),async()=>{show('Testando o endereço HTTPS…');const data=await request('/api/test',settings());show(data.message,'ok')}))
$('generate').addEventListener('click',()=>action($('generate'),async()=>{const data=await request('/api/setup-code',{});$('code').hidden=false;$('code').textContent=data.code;show('Código temporário gerado. Informe-o no Desktop antes de reiniciar o serviço.','ok')}))