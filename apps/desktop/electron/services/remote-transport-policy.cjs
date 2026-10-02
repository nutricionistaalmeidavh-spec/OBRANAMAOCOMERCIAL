const net=require('node:net')

function isPrivateIpv4(host){
  const parts=String(host).split('.').map(Number)
  if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false
  const [a,b]=parts
  return a===10||a===127||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)
}

function isPrivateIpv6(host){
  const value=String(host||'').toLowerCase()
  return value==='::1'||value.startsWith('fc')||value.startsWith('fd')||value.startsWith('fe8')||value.startsWith('fe9')||value.startsWith('fea')||value.startsWith('feb')
}

function isPrivateNetworkHost(host){
  const value=String(host||'').trim().toLowerCase()
  if(!value)return false
  if(value==='localhost'||value.endsWith('.local'))return true
  const family=net.isIP(value)
  if(family===4)return isPrivateIpv4(value)
  if(family===6)return isPrivateIpv6(value)
  return false
}

function remoteTransportFor(endpoint){
  if(endpoint?.scheme==='https')return 'https'
  if(endpoint?.scheme==='http'&&isPrivateNetworkHost(endpoint.host))return 'private-network'
  throw new Error('Servidor remoto público exige HTTPS. HTTP só é permitido em endereço privado/VPN (por exemplo, WireGuard).')
}

function validateRemoteEndpoint(endpoint){
  return remoteTransportFor(endpoint)
}

module.exports={isPrivateNetworkHost,remoteTransportFor,validateRemoteEndpoint}
