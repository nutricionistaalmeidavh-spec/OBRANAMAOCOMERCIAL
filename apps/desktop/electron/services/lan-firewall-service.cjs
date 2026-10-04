'use strict'

const {execFile}=require('node:child_process')

const API_RULE='Obra na Mão Desktop (LAN)'
const DISCOVERY_RULE='Obra na Mão Desktop Discovery (LAN)'
const DISCOVERY_PORT=4733

function validPort(value){
  const port=Number(value)
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Porta LAN inválida.')
  return port
}

function psLiteral(value){return String(value).replace(/'/g,"''")}

class LanFirewallService{
  constructor({platform=process.platform,execFileImpl=execFile,powershell='powershell.exe'}={}){
    this.platform=platform
    this.execFileImpl=execFileImpl
    this.powershell=powershell
  }

  run(args,{timeout=30000}={}){
    return new Promise((resolve,reject)=>{
      this.execFileImpl(this.powershell,args,{windowsHide:true,timeout},(error,stdout='',stderr='')=>{
        if(error){
          const detail=String(stderr||error.message||'').trim()
          reject(new Error(detail||'Não foi possível executar a configuração de rede do Windows.'))
          return
        }
        resolve(String(stdout||'').trim())
      })
    })
  }

  async state({port=4732}={}){
    const apiPort=validPort(port)
    if(this.platform!=='win32')return{supported:false,enabled:false,port:apiPort,discoveryPort:DISCOVERY_PORT,scope:'local-subnet'}
    const command=[
      "$api=Get-NetFirewallRule -DisplayName '"+psLiteral(API_RULE)+"' -ErrorAction SilentlyContinue",
      "$discovery=Get-NetFirewallRule -DisplayName '"+psLiteral(DISCOVERY_RULE)+"' -ErrorAction SilentlyContinue",
      "if($api -and $discovery){'true'}else{'false'}"
    ].join(';')
    try{
      const output=await this.run(['-NoProfile','-NonInteractive','-Command',command],{timeout:8000})
      return{supported:true,enabled:/true/i.test(output),port:apiPort,discoveryPort:DISCOVERY_PORT,scope:'local-subnet'}
    }catch(error){
      return{supported:true,enabled:false,port:apiPort,discoveryPort:DISCOVERY_PORT,scope:'local-subnet',error:error instanceof Error?error.message:String(error)}
    }
  }

  async enable({port=4732}={}){
    const apiPort=validPort(port)
    if(this.platform!=='win32')throw new Error('A liberação assistida do Firewall está disponível somente no Windows.')
    const inner=[
      "$ErrorActionPreference='Stop'",
      "$api='"+psLiteral(API_RULE)+"'",
      "$discovery='"+psLiteral(DISCOVERY_RULE)+"'",
      "Get-NetFirewallRule -DisplayName $api -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue",
      "Get-NetFirewallRule -DisplayName $discovery -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue",
      "New-NetFirewallRule -DisplayName $api -Direction Inbound -Action Allow -Protocol TCP -LocalPort "+apiPort+" -RemoteAddress LocalSubnet -Profile Domain,Private | Out-Null",
      "New-NetFirewallRule -DisplayName $discovery -Direction Inbound -Action Allow -Protocol UDP -LocalPort "+DISCOVERY_PORT+" -RemoteAddress LocalSubnet -Profile Domain,Private | Out-Null"
    ].join(';')
    const escaped=inner.replace(/'/g,"''")
    const elevate=[
      "$script='"+escaped+"'",
      '$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))',
      "$exe=Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'",
      "$p=Start-Process -FilePath $exe -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',$encoded)",
      'exit $p.ExitCode'
    ].join(';')
    try{await this.run(['-NoProfile','-NonInteractive','-Command',elevate],{timeout:120000})}
    catch(error){throw new Error('Não foi possível liberar o acesso na rede local. '+(error instanceof Error?error.message:String(error)))}
    const result=await this.state({port:apiPort})
    if(!result.enabled)throw new Error('O Windows não confirmou as regras de acesso local após a autorização.')
    return result
  }
}

module.exports={LanFirewallService,API_RULE,DISCOVERY_RULE,DISCOVERY_PORT}
