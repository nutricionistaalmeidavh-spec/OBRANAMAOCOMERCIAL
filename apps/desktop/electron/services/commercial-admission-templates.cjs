const esc=(value)=>String(value??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
const money=(cents)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(cents)||0)/100)
const dateBR=(iso)=>iso?String(iso).split('-').reverse().join('/'):'____/____/________'

function page(title,body){
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;font-size:10pt;line-height:1.42;margin:0}h1{text-align:center;font-size:14pt;text-transform:uppercase;margin:0 0 16px}h2{font-size:10.5pt;background:#f1f4f8;border-left:3px solid #53657d;padding:6px 8px;margin:14px 0 7px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;border:1px solid #aeb7c4;padding:9px}.signature{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:38px;text-align:center}.signature div{border-top:1px solid #111;padding-top:5px}.page-break{break-after:page}table{width:100%;border-collapse:collapse;font-size:8.8pt}th,td{border:1px solid #777;padding:5px;text-align:left;vertical-align:top}th{background:#eef1f5}.small{font-size:8pt}.check{display:inline-block;border:1px solid #111;width:13px;height:13px;margin:0 5px -2px 12px}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`
}

function employeeAddress(employee){
  const parts=[employee.endereco_logradouro,employee.endereco_numero,employee.endereco_complemento,employee.endereco_bairro,employee.endereco_cidade,employee.endereco_uf].filter(Boolean)
  return parts.length?parts.join(', '):(employee.endereco||'')
}

function meta(employee,company){
  const companyName=company?.razao_social||company?.nome_fantasia||'EMPREGADORA'
  return `<div class="meta"><div><b>Empregador:</b> ${esc(companyName)}</div><div><b>CNPJ:</b> ${esc(company?.cnpj||'')}</div><div><b>Empregado:</b> ${esc(employee.nome||'')}</div><div><b>CPF:</b> ${esc(employee.cpf||'')}</div><div><b>Função:</b> ${esc(employee.cargo_nome||'')}</div><div><b>Admissão:</b> ${dateBR(employee.admissao)}</div></div>`
}

function registration(employee,company){
  const companyName=company?.razao_social||company?.nome_fantasia||'EMPREGADORA'
  return page('Ficha de registro',`${meta(employee,company)}<h2>Identificação</h2><table><tr><th>Nascimento</th><th>Naturalidade</th><th>Nacionalidade</th><th>Estado civil</th></tr><tr><td>${dateBR(employee.data_nascimento)}</td><td>${esc(employee.naturalidade||'')}</td><td>${esc(employee.nacionalidade||'')}</td><td>${esc(employee.estado_civil||'')}</td></tr><tr><th>Sexo</th><th>Cor</th><th>Escolaridade</th><th>Deficiência</th></tr><tr><td>${esc(employee.sexo||'')}</td><td>${esc(employee.cor||'')}</td><td>${esc(employee.escolaridade||'')}</td><td>${esc(employee.deficiencia||'')}</td></tr><tr><th>Filiação - Pai</th><th colspan="3">Filiação - Mãe</th></tr><tr><td>${esc(employee.pai||'')}</td><td colspan="3">${esc(employee.mae||'')}</td></tr></table><h2>Documentos</h2><table><tr><th>RG / órgão</th><th>CTPS / série / UF</th><th>PIS</th><th>Matrícula eSocial</th></tr><tr><td>${esc(employee.rg||'')} / ${esc(employee.rg_orgao||'')}</td><td>${esc(employee.ctps||'')} / ${esc(employee.ctps_serie||'')} / ${esc(employee.ctps_uf||'')}</td><td>${esc(employee.pis||'')}</td><td>${esc(employee.matricula_esocial||employee.matricula||'')}</td></tr></table><h2>Endereço</h2><p>${esc(employeeAddress(employee))} · CEP ${esc(employee.cep||'')}</p><h2>Contrato</h2><table><tr><th>Cargo</th><th>CBO</th><th>Salário</th><th>FGTS</th></tr><tr><td>${esc(employee.cargo_nome||'')}</td><td>${esc(employee.cbo||'')}</td><td>${money(employee.salario_centavos)}</td><td>${Number(employee.fgts_optante)===1?'Optante':'Não informado'} ${employee.fgts_opcao_em?`desde ${dateBR(employee.fgts_opcao_em)}`:''}</td></tr></table><div class="signature"><div>${esc(employee.nome||'')}</div><div>${esc(companyName)}</div></div>`)
}

function contract(employee,company){
  const companyName=company?.razao_social||company?.nome_fantasia||'EMPREGADORA', companyAddress=company?.endereco||'endereço cadastrado da empregadora'
  return page('Contrato de experiência',`${meta(employee,company)}<p>Entre <b>${esc(companyName)}</b>, CNPJ ${esc(company?.cnpj||'')}, com endereço em ${esc(companyAddress)}, doravante EMPREGADORA, e <b>${esc(employee.nome||'')}</b>, doravante EMPREGADO, é celebrado o presente contrato de experiência.</p><p>O EMPREGADO exercerá a função de <b>${esc(employee.cargo_nome||'')}</b>, conforme atribuições cadastradas pela empresa, mediante remuneração mensal de <b>${money(employee.salario_centavos)}</b>.</p><p>A jornada cadastrada é das ${esc(employee.jornada_inicio||'')} às ${esc(employee.intervalo_inicio||'')} e das ${esc(employee.intervalo_fim||'')} às ${esc(employee.jornada_fim||'')}, observadas a legislação, instrumentos coletivos aplicáveis e eventuais ajustes formalizados pela empregadora.</p><p>O contrato vigorará por <b>${esc(employee.experiencia_dias||45)} dias</b>, com início em ${dateBR(employee.admissao)} e término em ${dateBR(employee.experiencia_fim)}. Eventual prorrogação deverá ser formalizada e respeitar os limites legais.</p><p>As demais condições de trabalho, segurança, confidencialidade, mobilidade e uso de recursos observarão as políticas válidas da empresa e a legislação aplicável.</p><div class="signature"><div>${esc(companyName)}<br>EMPREGADORA</div><div>${esc(employee.nome||'')}<br>EMPREGADO</div></div><div class="page-break"></div><h2>Prorrogação</h2><p>Por mútuo acordo, o contrato fica prorrogado até ____/____/________, respeitados os limites legais aplicáveis.</p><div class="signature"><div>${esc(companyName)}</div><div>${esc(employee.nome||'')}</div></div>`)
}

function serviceOrder(employee,company,config){
  const activities=config.atividades||'Conforme descrição de cargo, procedimentos internos e atividades efetivamente atribuídas pela empresa.'
  const risks=config.riscos||'Conforme inventário de riscos ocupacionais, PGR, avaliações aplicáveis e condições reais do posto de trabalho.'
  const epis=config.epis_orientacao||'Utilizar os equipamentos de proteção definidos para a função e para cada atividade, observando treinamento, ajuste, conservação, troca e registro de entrega.'
  const measures=config.medidas||'Cumprir procedimentos de segurança, sinalização, proteções coletivas, permissões e orientações da supervisão; comunicar riscos e interromper a atividade em condição insegura.'
  const training=config.treinamentos||'Realizar somente atividades para as quais esteja autorizado, capacitado e treinado quando houver requisito legal, normativo ou interno.'
  return page('Ordem de serviço - Segurança e saúde no trabalho',`${meta(employee,company)}<h2>Atividades</h2><p>${esc(activities)}</p><h2>Riscos ocupacionais</h2><p>${esc(risks)}</p><h2>Equipamentos de proteção</h2><p>${esc(epis)}</p><h2>Medidas preventivas</h2><p>${esc(measures)}</p><h2>Orientações e treinamentos</h2><p>${esc(training)}</p><h2>Ciência do trabalhador</h2><p>Declaro que recebi orientações sobre as atividades, riscos, medidas de prevenção e procedimentos aplicáveis à minha função, comprometendo-me a seguir as instruções vigentes e comunicar situações de risco.</p><div class="signature"><div>${esc(employee.nome||'')}<br>Trabalhador</div><div>Responsável da empresa</div></div>`)
}

function transit(employee,company){
  return page('Opção de vale-transporte',`${meta(employee,company)}<p><span class="check">${Number(employee.vale_transporte_opcao)===1?'X':''}</span> Opto pelo benefício <span class="check">${Number(employee.vale_transporte_opcao)===0?'X':''}</span> Não opto.</p><p>Declaro que as informações prestadas sobre deslocamento são verdadeiras, comprometendo-me a informar alterações e autorizando os descontos legalmente aplicáveis.</p><h2>Endereço residencial</h2><p>${esc(employeeAddress(employee))} · CEP ${esc(employee.cep||'')}</p><h2>Trajeto / tarifas</h2><p>${esc(employee.vale_transporte_detalhes||'Preencher conforme necessidade do trabalhador e política da empresa.')}</p><div class="signature"><div>${esc(employee.nome||'')}</div><div>Responsável da empresa</div></div>`)
}

function epi(employee,company,epis){
  const rows=(epis?.length?epis:Array.from({length:8},()=>({}))).map(item=>`<tr><td>${dateBR(item.data_entrega)}</td><td>${esc(item.nome||'')}</td><td>${esc(item.ca||'')}</td><td>${esc(item.quantidade_texto??item.quantidade??'')}</td><td>${dateBR(item.data_devolucao)}</td><td></td></tr>`).join('')
  return page('Ficha de controle de EPI',`${meta(employee,company)}<p>Declaro receber os equipamentos relacionados abaixo e ter sido orientado sobre uso, guarda, conservação, substituição e devolução conforme as regras aplicáveis à atividade.</p><table><tr><th>Data</th><th>Descrição</th><th>C.A.</th><th>Quantidade</th><th>Devolução</th><th>Assinatura</th></tr>${rows}</table><div class="signature"><div>${esc(employee.nome||'')}</div><div>Responsável da empresa</div></div>`)
}

function unionLetter(employee,company,config){
  const recipient=config.sindicato_nome||'entidade sindical competente', address=config.sindicato_endereco||''
  return page('Carta de oposição sindical',`<p style="text-align:right">${esc(employee.endereco_cidade||'')}${employee.endereco_uf?`/${esc(employee.endereco_uf)}`:''}, ${dateBR(new Date().toISOString().slice(0,10))}.</p><p>À ${esc(recipient)}${address?`, ${esc(address)}`:''}.</p><p>Eu, <b>${esc(employee.nome||'')}</b>, CTPS nº ${esc(employee.ctps||'')}, série ${esc(employee.ctps_serie||'')}, empregado de ${esc(company?.razao_social||company?.nome_fantasia||'EMPREGADORA')}, apresento a presente manifestação de oposição aos descontos de contribuições sindicais/assistenciais que dependam de oposição individual, nos termos e prazos aplicáveis ao vínculo e ao instrumento coletivo pertinente.</p><p>Este modelo deve ser conferido pela empresa e pelo trabalhador conforme a convenção coletiva e as regras locais vigentes antes da assinatura/protocolo.</p><div class="signature"><div>${esc(employee.nome||'')}</div><div>Recebimento</div></div>`)
}

function renderCommercialAdmissionTemplate(key,employee,company,epis=[],work=null,config={}){
  if(key==='contrato_experiencia')return contract(employee,company)
  if(key==='ficha_registro')return registration(employee,company)
  if(key==='ordem_servico')return serviceOrder(employee,company,config||{})
  if(key==='vale_transporte')return transit(employee,company)
  if(key==='ficha_epi')return epi(employee,company,epis)
  if(key==='carta_sindical')return unionLetter(employee,company,config||{})
  throw new Error('Tipo de documento admissional inválido.')
}

module.exports={renderCommercialAdmissionTemplate,employeeAddress}
