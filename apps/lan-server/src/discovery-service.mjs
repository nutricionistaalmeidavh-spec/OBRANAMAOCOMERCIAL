import dgram from 'node:dgram'

export const DISCOVERY_GROUP='239.255.43.21'
export const DISCOVERY_PORT=4733
export const DISCOVERY_PROTOCOL_VERSION=1
const QUERY_TYPE='obra-na-mao.discovery.query'
const RESPONSE_TYPE='obra-na-mao.discovery.response'

function safeNonce(value){
  const nonce=String(value||'')
  return /^[A-Za-z0-9._-]{1,96}$/.test(nonce)?nonce:null
}
function lanAddressable(host){
  const value=String(host||'').trim().toLowerCase()
  return !!value && !['127.0.0.1','localhost','::1'].includes(value)
}
export function createDiscoveryService({
  host,
  servicePort,
  serverId,
  instanceName='Obra na Mão Server',
  socketFactory=()=>dgram.createSocket({type:'udp4',reuseAddr:true})
}={}){
  let socket=null
  let running=false
  let starting=null

  const state=()=>Object.freeze({running,reason:running?null:(lanAddressable(host)?'stopped':'loopback-only')})

  async function start(){
    if(running)return state()
    if(starting)return starting
    if(!lanAddressable(host))return state()
    starting=new Promise((resolve,reject)=>{
      const next=socketFactory()
      socket=next
      const fail=(error)=>{ try{next.close()}catch{}; socket=null; starting=null; reject(error) }
      next.once?.('error',fail)
      next.on('message',(message,rinfo)=>{
        if(!Buffer.isBuffer(message)||message.length>4096)return
        let body
        try{body=JSON.parse(message.toString('utf8'))}catch{return}
        if(body?.type!==QUERY_TYPE||body?.version!==DISCOVERY_PROTOCOL_VERSION)return
        const nonce=safeNonce(body?.nonce)
        if(!nonce)return
        const port=Number(servicePort)
        if(!Number.isInteger(port)||port<1||port>65535)return
        const response={
          type:RESPONSE_TYPE,
          version:DISCOVERY_PROTOCOL_VERSION,
          nonce,
          product:'Obra na Mão',
          apiVersion:'1',
          serverId:String(serverId||''),
          instanceName:String(instanceName||'Obra na Mão Server').slice(0,120),
          port
        }
        if(!response.serverId)return
        next.send(Buffer.from(JSON.stringify(response),'utf8'),rinfo.port,rinfo.address,()=>{})
      })
      next.bind(DISCOVERY_PORT,'0.0.0.0',()=>{
        try{
          next.removeListener?.('error',fail)
          next.on?.('error',()=>{})
          next.addMembership(DISCOVERY_GROUP)
          next.setMulticastTTL(1)
          running=true
          starting=null
          resolve(state())
        }catch(error){fail(error)}
      })
    })
    return starting
  }

  async function stop(){
    if(starting){try{await starting}catch{}}
    const current=socket
    socket=null
    running=false
    starting=null
    if(!current)return state()
    await new Promise(resolve=>{try{current.close(()=>resolve())}catch{resolve()}})
    return state()
  }

  return Object.freeze({start,stop,state})
}
