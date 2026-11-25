const NS='http://www.portalfiscal.inf.br/nfe'
export const MAX_NFE_BYTES=8*1024*1024
function one(node,name,required=true){
  const matches=node.children.filter(x=>x.name===name)
  if(matches.length>1||(!matches.length&&required))throw new Error('Campo XML inválido: '+name+'.')
  return matches[0]
}
function value(node,name,required=true){
  const n=one(node,name,required)
  const result=n?.text.trim()||''
  if(required&&!result)throw new Error('Campo XML ausente: '+name+'.')
  if(n?.children.length)throw new Error('Campo XML inválido: '+name+'.')
  return result
}
function decimal(input,label,positive=false){
  if(!/^\d{1,15}(?:\.\d{1,10})?$/.test(input)||!Number.isFinite(Number(input))||(positive&&Number(input)<=0))throw new Error(label+' inválido.')
  return input
}
function date(input,label){
  const raw=input.slice(0,10)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||!Number.isFinite(Date.parse(raw+'T12:00:00Z'))||new Date(raw+'T12:00:00Z').toISOString().slice(0,10)!==raw)throw new Error(label+' inválida.')
  return raw
}
export function validNfeKey(key){
  if(!/^\d{44}$/.test(key))return false
  let total=0,weight=2
  for(let i=42;i>=0;i--){total+=Number(key[i])*weight;weight=weight===9?2:weight+1}
  const remainder=11-total%11
  return Number(key[43])===(remainder>=10?0:remainder)
}
export function parseNfeXml(xml,SaxesParser){
  if(!xml.trim()||new TextEncoder().encode(xml).byteLength>MAX_NFE_BYTES)throw new Error('O XML deve ter conteúdo e até 8 MB.')
  if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml))throw new Error('XML com declarações de entidades ou DTD não é aceito.')
  const stack=[]
  let root
  let nodes=0
  const parser=new SaxesParser({xmlns:true})
  parser.on('error',()=>{throw new Error('XML malformado.')})
  parser.on('doctype',()=>{throw new Error('DTD não permitido.')})
  parser.on('opentag',tag=>{
    if(++nodes>150000||stack.length>=64)throw new Error('Estrutura XML excede os limites de segurança.')
    // Preserve local names only for the official NF-e namespace.
    const attrs=Object.create(null)
    for(const attr of Object.values(tag.attributes))if(!attr.uri)attrs[attr.local]=attr.value
    const node={name:tag.uri===NS?tag.local:'@'+tag.name,attrs,children:[],text:''}
    if(stack.length)stack[stack.length-1].children.push(node)
    else {if(root)throw new Error('XML contém mais de um documento.');root=node}
    stack.push(node)
  })
  const append=(chunk)=>{if(stack.length)stack[stack.length-1].text+=chunk}
  parser.on('text',append)
  parser.on('cdata',append)
  parser.on('closetag',()=>{stack.pop()})
  parser.write(xml).close()
  if(!root||!['nfeProc','NFe'].includes(root.name))throw new Error('Selecione um XML de NF-e no namespace oficial.')
  const nfe=root.name==='nfeProc'?one(root,'NFe'):root
  const info=one(nfe,'infNFe')
  const key=String(info.attrs.Id||'').replace(/^NFe/,'')
  if(!validNfeKey(key)||info.attrs.Id!=='NFe'+key)throw new Error('Chave de acesso NF-e inválida.')
  const ide=one(info,'ide'),emit=one(info,'emit'),dest=one(info,'dest',false)
  if(value(ide,'mod')!=='55')throw new Error('Este fluxo aceita somente NF-e modelo 55.')
  const protocol=one(root,'protNFe',false)
  const pi=protocol?one(protocol,'infProt'):undefined
  const status=pi?value(pi,'cStat'):''
  if(pi&&(value(pi,'chNFe')!==key||!['100','150'].includes(status)))throw new Error('Protocolo da nota inválido ou não autorizado no XML.')
  const doc=(value(emit,'CNPJ',false)||value(emit,'CPF',false)).trim()
  if(!/^\d{11}$|^\d{14}$/.test(doc))throw new Error('CPF/CNPJ do emitente inválido.')
  const itens=info.children.filter(n=>n.name==='det').map((n,index)=>{
    const p=one(n,'prod')
    const numero=n.attrs.nItem||String(index+1)
    return {numero,codigo:value(p,'cProd'),descricao:value(p,'xProd'),unidade:value(p,'uCom'),gtin:value(p,'cEAN',false),gtin_tributavel:value(p,'cEANTrib',false),ncm:value(p,'NCM',false),cfop:value(p,'CFOP',false),pedido:value(p,'xPed',false),item_pedido:value(p,'nItemPed',false),unidade_tributavel:value(p,'uTrib',false),quantidade_tributavel:value(p,'qTrib',false),quantidade:decimal(value(p,'qCom'),'Quantidade',true),valor_unitario:decimal(value(p,'vUnCom'),'Preço unitário'),valor_produto:decimal(value(p,'vProd'),'Total do produto')}
  })
  if(!itens.length||new Set(itens.map(i=>i.numero)).size!==itens.length)throw new Error('Itens ausentes ou repetidos no XML.')
  const icms=one(one(info,'total'),'ICMSTot')
  const componentes={}
  for(const field of ['vProd','vFrete','vSeg','vDesc','vOutro','vIPI','vII','vST','vFCPST','vIPIDevol','vICMSDeson']){const raw=value(icms,field,false);if(raw)componentes[field]=decimal(raw,field)}
  const cobr=one(info,'cobr',false)
  const parcelas=(cobr?.children||[]).filter(n=>n.name==='dup').map((n,index)=>({numero:value(n,'nDup',false)||String(index+1),vencimento:value(n,'dVenc',false)?date(value(n,'dVenc'),'Vencimento'):'',valor:decimal(value(n,'vDup'),'Valor da parcela')}))
  return {chave:key,numero:value(ide,'nNF'),serie:value(ide,'serie'),emissao:date(value(ide,'dhEmi',false)||value(ide,'dEmi'),'Emissão'),fornecedor:value(emit,'xNome'),documento:doc,destinatario:dest?(value(dest,'CNPJ',false)||value(dest,'CPF',false)):'',ambiente:value(ide,'tpAmb',false),tipo_operacao:value(ide,'tpNF',false),finalidade:value(ide,'finNFe',false),natureza_operacao:value(ide,'natOp',false),total_produtos:componentes.vProd||'',componentes,total:decimal(value(icms,'vNF'),'Total da nota'),protocolo:pi?value(pi,'nProt',false):'',status,itens,parcelas}
}
