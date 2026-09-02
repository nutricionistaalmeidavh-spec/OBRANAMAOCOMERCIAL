const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const { BrowserWindow } = require('electron')
const { sanitizeName, sha256 } = require('./file-service.cjs')

const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
const brl = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(v)||0)/100)
function validCompetence(v) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v||''))) throw new Error('Competência inválida.')
  return String(v)
}
function addMinutes(time, delta) {
  const p=String(time).split(':').map(Number), total=Math.max(0,Math.min(1439,p[0]*60+p[1]+delta))
  return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0')
}
function jitter(employeeId,date,slot) {
  const values=[-7,-6,-5,-4,-3,-2,-1,1,2,3,4,5,6,7]
  const byte=crypto.createHash('sha256').update(employeeId+'|'+date+'|'+slot).digest()[slot]
  return values[byte%values.length]
}
function monthDays(competencia) {
  const parts=validCompetence(competencia).split('-').map(Number), year=parts[0], month=parts[1]
  return Array.from({length:new Date(year,month,0).getDate()},(_,index)=>{
    const day=index+1, data=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0')
    return {data,day,weekday:new Date(year,month-1,day).getDay()}
  })
}

class TimeService {
  constructor({db,fileService}) { this.db=db; this.fileService=fileService }
  ensure(funcionarioId,competencia) {
    const employee=this.db.get('funcionarios',Number(funcionarioId))
    if(!employee) throw new Error('Funcionário não encontrado.')
    competencia=validCompetence(competencia)
    let point=this.db.db.prepare('SELECT * FROM pontos_mensais WHERE funcionario_id=? AND competencia=?').get(employee.id,competencia)
    if(!point) {
      const info=this.db.db.prepare('INSERT INTO pontos_mensais(funcionario_id,competencia,jornada_inicio,intervalo_inicio,intervalo_fim,jornada_fim) VALUES (?,?,?,?,?,?)').run(employee.id,competencia,employee.jornada_inicio||'07:00',employee.intervalo_inicio||'11:00',employee.intervalo_fim||'12:00',employee.jornada_fim||'17:00')
      point=this.db.db.prepare('SELECT * FROM pontos_mensais WHERE id=?').get(Number(info.lastInsertRowid))
    }
    return {employee,point}
  }
  get(payload) {
    const base=this.ensure(payload.funcionario_id,payload.competencia)
    const marks=this.db.db.prepare('SELECT * FROM ponto_marcacoes WHERE ponto_mensal_id=? ORDER BY data').all(base.point.id)
    return {employee:base.employee,point:base.point,marks}
  }
  autoFill(payload) {
    const base=this.ensure(payload.funcionario_id,payload.competencia), point=base.point, overwrite=Boolean(payload.overwrite)
    const insert=this.db.db.prepare("INSERT INTO ponto_marcacoes(ponto_mensal_id,data,tipo,entrada,intervalo_saida,intervalo_entrada,saida) VALUES (?,?,?,?,?,?,?) ON CONFLICT(ponto_mensal_id,data) DO UPDATE SET tipo=excluded.tipo,entrada=excluded.entrada,intervalo_saida=excluded.intervalo_saida,intervalo_entrada=excluded.intervalo_entrada,saida=excluded.saida,updated_at=CURRENT_TIMESTAMP")
    const exists=this.db.db.prepare('SELECT id FROM ponto_marcacoes WHERE ponto_mensal_id=? AND data=?')
    this.db.db.transaction(()=>{
      for(const day of monthDays(point.competencia)) {
        if(!overwrite && exists.get(point.id,day.data)) continue
        const weekend=day.weekday===0?'domingo':day.weekday===6?'sabado':null
        const values=weekend?[null,null,null,null]:[addMinutes(point.jornada_inicio,jitter(base.employee.id,day.data,0)),addMinutes(point.intervalo_inicio,jitter(base.employee.id,day.data,1)),addMinutes(point.intervalo_fim,Math.abs(jitter(base.employee.id,day.data,2))),addMinutes(point.jornada_fim,jitter(base.employee.id,day.data,3))]
        insert.run(point.id,day.data,weekend||'trabalho',values[0],values[1],values[2],values[3])
      }
      this.db.db.prepare('UPDATE pontos_mensais SET preenchimento_automatico=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(point.id)
    })()
    return this.get(payload)
  }
  save(payload) {
    const base=this.ensure(payload.funcionario_id,payload.competencia), allowed=new Set(['trabalho','falta','ferias','feriado','folga','afastado','sabado','domingo'])
    const upsert=this.db.db.prepare("INSERT INTO ponto_marcacoes(ponto_mensal_id,data,tipo,entrada,intervalo_saida,intervalo_entrada,saida,observacoes) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(ponto_mensal_id,data) DO UPDATE SET tipo=excluded.tipo,entrada=excluded.entrada,intervalo_saida=excluded.intervalo_saida,intervalo_entrada=excluded.intervalo_entrada,saida=excluded.saida,observacoes=excluded.observacoes,updated_at=CURRENT_TIMESTAMP")
    this.db.db.transaction(()=>{
      for(const row of payload.marks||[]) {
        const tipo=allowed.has(row.tipo)?row.tipo:'trabalho', clean=(value)=>/^\d{2}:\d{2}$/.test(String(value||''))?value:null
        const values=tipo==='trabalho'?[clean(row.entrada),clean(row.intervalo_saida),clean(row.intervalo_entrada),clean(row.saida)]:[null,null,null,null]
        upsert.run(base.point.id,row.data,tipo,values[0],values[1],values[2],values[3],row.observacoes||null)
      }
      this.db.db.prepare("UPDATE pontos_mensais SET status='preenchido',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(base.point.id)
    })()
    return this.get(payload)
  }

  pointHtml(data,company,cargo) {
    const point=data.point, rows=data.marks, parts=point.competencia.split('-'), title=MONTHS[Number(parts[1])-1].toUpperCase()+'/'+parts[0]
    const table=(items)=>'<table><thead><tr><th>Dia</th><th>Manhã<br>Entrada</th><th>Manhã<br>Saída</th><th>Tarde<br>Entrada</th><th>Tarde<br>Saída</th><th>Observação</th></tr></thead><tbody>'+items.map((r)=>{
      const label=r.tipo==='trabalho'?'':r.tipo.toUpperCase()
      return '<tr><td>'+Number(r.data.slice(-2))+'</td><td>'+esc(r.entrada)+'</td><td>'+esc(r.intervalo_saida)+'</td><td>'+esc(r.intervalo_entrada)+'</td><td>'+esc(r.saida)+'</td><td>'+esc(label||r.observacoes)+'</td></tr>'
    }).join('')+'</tbody></table>'
    return '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{font-family:Arial;color:#111;margin:0;font-size:9px}.title{text-align:center;font-size:18px;font-weight:700;margin-bottom:7px}.meta{display:grid;grid-template-columns:2fr 1fr 1fr;border:1px solid #333;margin-bottom:7px}.meta div{padding:4px 6px;border-right:1px solid #555;border-bottom:1px solid #555}.meta div:nth-child(3n){border-right:0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #444;padding:3px;text-align:center;height:22px}th{background:#edf1f5;font-size:8px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:80px;margin:28px 55px 0;text-align:center}.sign div{border-top:1px solid #111;padding-top:4px}.note{text-align:center;margin-top:8px;color:#555}</style></head><body><div class="title">FICHA DE PONTO - '+title+'</div><div class="meta"><div><b>Empregador:</b> '+esc(company&&company.razao_social)+'</div><div><b>CNPJ:</b> '+esc(company&&company.cnpj)+'</div><div><b>Nº ordem:</b> '+esc(data.employee.matricula||data.employee.id)+'</div><div><b>Empregado:</b> '+esc(data.employee.nome)+'</div><div><b>Função:</b> '+esc(cargo&&cargo.nome)+'</div><div><b>Competência:</b> '+title+'</div><div><b>Horário:</b> '+esc(point.jornada_inicio)+' às '+esc(point.intervalo_inicio)+'</div><div><b>Intervalo:</b> '+esc(point.intervalo_inicio)+' às '+esc(point.intervalo_fim)+'</div><div><b>Saída:</b> '+esc(point.jornada_fim)+'</div></div><div class="grid">'+table(rows.slice(0,15))+table(rows.slice(15))+'</div><div class="sign"><div>Assinatura do empregado</div><div>Assinatura do empregador</div></div><div class="note">Declaro que as marcações acima correspondem à jornada realizada no período.</div></body></html>'
  }

  receiptHtml(data,company,cargo,benefits,paymentDate) {
    const parts=data.point.competencia.split('-'), competence=MONTHS[Number(parts[1])-1].toUpperCase()+'/'+parts[0]
    const items=benefits.length?benefits:[{descricao:'Benefícios do mês',valor_centavos:0}]
    const blocks=items.map((item)=>'<section><div class="head"><b>'+esc(data.employee.nome)+'</b><span>'+esc(cargo&&cargo.nome)+'</span><span>Competência: '+competence+'</span></div><table><tr><th>Benefício</th><th>Valor</th></tr><tr><td>'+esc(item.descricao)+'</td><td>'+brl(item.valor_centavos)+'</td></tr><tr><td>Empregador: '+esc(company&&company.razao_social)+'</td><td>CNPJ: '+esc(company&&company.cnpj)+'</td></tr><tr><td>CPF: '+esc(data.employee.cpf)+'</td><td>Data: '+String(paymentDate||'').split('-').reverse().join('/')+'</td></tr><tr><td colspan="2">Declaro ter recebido o valor acima referente a '+esc(item.descricao)+' da competência '+competence+'.</td></tr></table><div class="signature">'+esc(data.employee.nome)+' - assinatura</div></section>').join('')
    return '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial;color:#111;margin:0;font-size:10px}h1{text-align:center;font-size:15px;margin:0 0 12px}section{border:1.4px solid #333;margin-bottom:12px;break-inside:avoid}.head{display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;padding:7px;background:#edf1f5}.head span{display:block}table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:6px;text-align:left}th{background:#f7f8fa}.signature{width:45%;margin:25px 12px 10px auto;border-top:1px solid #111;text-align:center;padding-top:4px}</style></head><body><h1>RECIBOS DE BENEFÍCIOS - '+competence+'</h1>'+blocks+'</body></html>'
  }

  async printHtml(html,destination) {
    const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}})
    const htmlPath=path.join(os.tmpdir(),'fluxo-dre-render-'+process.pid+'-'+Date.now()+'.html')
    try { fs.writeFileSync(htmlPath,html,'utf8'); await win.loadFile(htmlPath); const pdf=await win.webContents.printToPDF({pageSize:'A4',printBackground:true,margins:{marginType:'none'}}); fs.writeFileSync(destination,pdf) }
    finally { win.destroy(); if(fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath) }
  }

  registerPdf(employee,category,title,destination) {
    const stat=fs.statSync(destination), version=(this.db.db.prepare('SELECT COALESCE(MAX(versao),0)+1 value FROM documentos WHERE funcionario_id=? AND categoria=? AND deleted_at IS NULL').get(employee.id,category).value)
    const file=this.db.save('arquivos',{nome_original:path.basename(destination),nome_armazenado:path.basename(destination),caminho:destination,tamanho:stat.size,extensao:'.pdf',mime_type:'application/pdf',hash:sha256(destination),origem:'gerado_mensal'})
    return this.db.save('documentos',{arquivo_id:file.id,empresa_id:employee.empresa_id,obra_id:employee.obra_atual_id,funcionario_id:employee.id,categoria:category,titulo:title,status_assinatura:'nao_assinado',versao:version})
  }

  async generateDocuments(payload) {
    let data=this.get(payload)
    if(!data.marks.length) data=this.autoFill(payload)
    const company=data.employee.empresa_id?this.db.get('empresas',data.employee.empresa_id):null
    const cargo=data.employee.cargo_id?this.db.get('cargos',data.employee.cargo_id):null
    const sheet=this.db.db.prepare('SELECT id FROM folhas_pagamento WHERE empresa_id IS ? AND competencia=?').get(data.employee.empresa_id||null,data.point.competencia)
    const benefits=sheet?this.db.db.prepare("SELECT descricao,valor_centavos FROM folha_lancamentos WHERE folha_id=? AND funcionario_id=? AND natureza='credito' AND (tipo LIKE 'beneficio_%' OR lower(descricao) LIKE '%café%' OR lower(descricao) LIKE '%aliment%') ORDER BY descricao").all(sheet.id,data.employee.id):[]
    const folders=this.fileService.employeeFolders(data.employee,company&&(company.nome_fantasia||company.razao_social))
    const parts=data.point.competencia.split('-'), monthFolder=path.join(folders.base,'Mensal',parts[0],parts[1]+' - '+MONTHS[Number(parts[1])-1])
    const pointFolder=path.join(monthFolder,'Folha de ponto'), receiptFolder=path.join(monthFolder,'Recibos')
    fs.mkdirSync(pointFolder,{recursive:true}); fs.mkdirSync(receiptFolder,{recursive:true})
    const stamp=Date.now(), pointName='Ficha de ponto - '+data.point.competencia+' - '+sanitizeName(data.employee.nome)+' - '+stamp+'.pdf'
    const receiptName='Recibos de benefícios - '+data.point.competencia+' - '+sanitizeName(data.employee.nome)+' - '+stamp+'.pdf'
    const pointPath=path.join(pointFolder,pointName), receiptPath=path.join(receiptFolder,receiptName)
    await this.printHtml(this.pointHtml(data,company,cargo),pointPath)
    await this.printHtml(this.receiptHtml(data,company,cargo,benefits,payload.paymentDate),receiptPath)
    const pointDoc=this.registerPdf(data.employee,'folha_ponto','Ficha de ponto - '+data.point.competencia,pointPath)
    const receiptDoc=this.registerPdf(data.employee,'recibos_beneficios','Recibos de benefícios - '+data.point.competencia,receiptPath)
    this.db.db.prepare("UPDATE pontos_mensais SET status='gerado',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(data.point.id)
    return {point:{...pointDoc,path:pointPath},receipt:{...receiptDoc,path:receiptPath}}
  }

  async generateForAll(payload) {
    const employees=this.db.db.prepare("SELECT id FROM funcionarios WHERE deleted_at IS NULL AND status='ativo' ORDER BY nome").all()
    const generated=[]
    for(const employee of employees) generated.push(await this.generateDocuments({funcionario_id:employee.id,competencia:payload.competencia,paymentDate:payload.paymentDate}))
    return generated
  }
}

module.exports={TimeService,monthDays,addMinutes,jitter}










