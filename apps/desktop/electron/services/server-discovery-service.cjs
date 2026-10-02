const dgram=require('node:dgram')
const crypto=require('node:crypto')

const DISCOVERY_GROUP='239.255.43.21'
const DISCOVERY_PORT=4733
const DISCOVERY_PROTOCOL_VERSION=1
const QUERY_TYPE='obra-na-mao.discovery.query'
const RESPONSE_TYPE='obra-na-mao.discovery.response'

function responseJson(response){
  return typeof response?.json==='function'?response.json():Promise.resolve(null)
}

class ServerDiscoveryService{
  constructor({
    socketFactory=()=>dgram.createSocket({type:'udp4',reuseAddr:true}),
    fetchImpl=globalThis.fetch,
    randomNonce=()=>crypto.randomBytes(18).toString('base64url'),
    probeTimeoutMs=2500
  }={}){
    this.socketFactory=socketFactory
    this.fetchImpl=fetchImpl
    this.randomNonce=randomNonce
    this.probeTimeoutMs=probeTimeoutMs
  }

  async probe({host,port,scheme='http',expectedServerId=null}){
    const baseUrl=`${scheme}://${host.includes(':')?`[${host}]`:host}:${port}`
    const controller=new AbortController()
    const timer=setTimeout(()=>controller.abort(),this.probeTimeoutMs)
    const started=Date.now()
    try{
      const options={method:'GET',headers:{Accept:'application/json'},signal:controller.signal}
      const [healthResponse,readyResponse]=await Promise.all([
        this.fetchImpl(`${baseUrl}/health`,options),
        this.fetchImpl(`${baseUrl}/ready`,options)
      ])
      if(!healthResponse?.ok)throw new Error('health_failed')
      const health=await responseJson(healthResponse)
      if(health?.status!=='ok'||health?.product!=='Obra na Mão'||String(health?.apiVersion)!=='1')throw new Error('incompatible_server')
      const ready=await responseJson(readyResponse)
      if(!readyResponse?.ok||ready?.ready!==true)throw new Error('server_not_ready')
      const actualServerId=ready?.identity?.serverId||null
      if(expectedServerId&&actualServerId&&String(actualServerId)!==String(expectedServerId))throw new Error('server_identity_mismatch')
      return {ready:true,baseUrl,latencyMs:Math.max(0,Date.now()-started),health,readiness:ready,serverId:actualServerId}
    }finally{clearTimeout(timer)}
  }

  async discover({timeoutMs=1400}={}){
    const timeout=Math.max(10,Math.min(Number(timeoutMs)||1400,5000))
    const socket=this.socketFactory()
    const nonce=this.randomNonce()
    const candidates=new Map()
    return await new Promise((resolve,reject)=>{
      let settled=false
      const finish=async()=>{
        if(settled)return
        settled=true
        clearTimeout(timer)
        try{socket.close()}catch{}
        const verified=[]
        for(const candidate of candidates.values()){
          try{
            const probe=await this.probe({host:candidate.host,port:candidate.port,expectedServerId:candidate.serverId})
            verified.push(Object.freeze({
              serverId:candidate.serverId,
              name:candidate.name,
              host:candidate.host,
              port:candidate.port,
              baseUrl:probe.baseUrl,
              apiVersion:'1',
              ready:true,
              latencyMs:probe.latencyMs
            }))
          }catch{}
        }
        verified.sort((a,b)=>a.latencyMs-b.latencyMs||a.name.localeCompare(b.name,'pt-BR'))
        resolve(verified)
      }
      const timer=setTimeout(()=>{void finish()},timeout)
      socket.on('error',error=>{if(settled)return;settled=true;clearTimeout(timer);try{socket.close()}catch{};reject(error)})
      socket.on('message',(message,rinfo)=>{
        if(!Buffer.isBuffer(message)||message.length>4096)return
        let body
        try{body=JSON.parse(message.toString('utf8'))}catch{return}
        if(body?.type!==RESPONSE_TYPE||body?.version!==DISCOVERY_PROTOCOL_VERSION||body?.nonce!==nonce)return
        if(body?.product!=='Obra na Mão'||String(body?.apiVersion)!=='1')return
        const serverId=String(body?.serverId||'').trim()
        const port=Number(body?.port)
        if(!serverId||!Number.isInteger(port)||port<1||port>65535)return
        const host=String(rinfo?.address||'').trim()
        if(!host)return
        const name=String(body?.instanceName||'Obra na Mão Server').trim().slice(0,120)||'Obra na Mão Server'
        candidates.set(serverId,{serverId,name,host,port})
      })
      socket.bind(0,()=>{
        try{socket.setMulticastTTL?.(1)}catch{}
        const query=Buffer.from(JSON.stringify({type:QUERY_TYPE,version:DISCOVERY_PROTOCOL_VERSION,nonce}),'utf8')
        socket.send(query,DISCOVERY_PORT,DISCOVERY_GROUP,()=>{})
      })
    })
  }
}

module.exports={ServerDiscoveryService,DISCOVERY_GROUP,DISCOVERY_PORT,DISCOVERY_PROTOCOL_VERSION}
