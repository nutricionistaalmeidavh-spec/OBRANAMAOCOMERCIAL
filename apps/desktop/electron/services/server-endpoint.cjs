const DEFAULT_PORT=4732

function normalizeHost(host){
  const value=String(host||'').trim()
  if(!value)throw new Error('Endereço do servidor inválido.')
  if(/[\s\\/?#@]/.test(value))throw new Error('Endereço do servidor inválido.')
  return value
}

function baseUrlFor({scheme,host,port}){
  const url=new URL(`${scheme}://${host.includes(':')?`[${host}]`:host}:${port}`)
  if((scheme==='http'&&port===80)||(scheme==='https'&&port===443))return url.origin
  return url.origin
}

function parseServerAddress(input,{defaultPort=DEFAULT_PORT}={}){
  const raw=String(input??'').trim()
  if(!raw)throw new Error('Endereço do servidor não informado.')
  const explicitScheme=/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(raw)
  let url
  try{url=new URL(explicitScheme?raw:`http://${raw}`)}catch{throw new Error('Endereço do servidor inválido.')}
  const scheme=url.protocol.replace(':','').toLowerCase()
  if(!['http','https'].includes(scheme))throw new Error('Protocolo do servidor inválido. Use HTTP ou HTTPS.')
  if(url.username||url.password)throw new Error('Endereço do servidor não pode conter credenciais.')
  if(url.pathname&&url.pathname!=='/')throw new Error('Endereço do servidor não pode conter caminho.')
  if(url.search||url.hash)throw new Error('Endereço do servidor não pode conter parâmetros ou fragmento.')
  const host=normalizeHost(url.hostname)
  const implicitPort=scheme==='https'?443:defaultPort
  const port=url.port?Number(url.port):implicitPort
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Porta do servidor inválida.')
  return Object.freeze({
    scheme,host,port,
    baseUrl:baseUrlFor({scheme,host,port}),
    address:raw
  })
}

module.exports={parseServerAddress,DEFAULT_PORT}
