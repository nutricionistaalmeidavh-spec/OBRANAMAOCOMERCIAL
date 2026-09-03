function compact(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}
function digits(value) {
  return String(value || '').replace(/\D/g, '')
}
function key(value) {
  return compact(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
function baseImportedName(value) {
  return compact(value).replace(/\s+\([^)]*\)\s*$/, '').trim()
}
function firstNameKey(value) {
  return key(baseImportedName(value).split(/\s+/)[0] || '')
}
function formatCpf(value) {
  const raw=digits(value)
  return raw.length===11 ? raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4') : compact(value)
}
function formatCnpj(value) {
  const raw=digits(value)
  return raw.length===14 ? raw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5') : compact(value)
}
function employeeIdentityIssues(employee, company) {
  const issues=[]
  const name=compact(employee && employee.nome)
  if(name.split(/\s+/).filter(Boolean).length<2) issues.push('nome completo')
  if(digits(employee && employee.cpf).length!==11) issues.push('CPF')
  if(!compact(company && company.razao_social)) issues.push('razão social da empresa')
  if(digits(company && company.cnpj).length!==14) issues.push('CNPJ da empresa')
  return issues
}
function resolveImportedEmployee(employees, importedName) {
  const source=baseImportedName(importedName), sourceKey=key(source)
  if(!sourceKey) return {kind:'invalid',source}
  const active=(employees||[]).filter((item)=>!item.deleted_at)
  const exact=active.filter((item)=>key(item.nome)===sourceKey)
  if(exact.length===1) return {kind:'match',source,employee:exact[0],reason:'exact'}
  if(exact.length>1) return {kind:'ambiguous',source,candidates:exact}
  const tokens=source.split(/\s+/).filter(Boolean)
  if(tokens.length>1) return {kind:'new',source}
  const first=firstNameKey(source)
  const candidates=active.filter((item)=>firstNameKey(item.nome)===first)
  if(candidates.length===1) return {kind:'match',source,employee:candidates[0],reason:'unique-first-name'}
  if(candidates.length>1) return {kind:'ambiguous',source,candidates}
  return {kind:'incomplete',source,candidates:[]}
}
function ambiguityMessage(resolution) {
  const names=(resolution.candidates||[]).map((item)=>compact(item.nome)).filter(Boolean)
  return 'Nome ambíguo na planilha: "'+resolution.source+'". Existem '+names.length+' funcionários com esse primeiro nome ('+names.join(' / ')+'). Use o nome completo na planilha ou vincule pelo cadastro correto antes de importar.'
}
module.exports={compact,digits,key,baseImportedName,firstNameKey,formatCpf,formatCnpj,employeeIdentityIssues,resolveImportedEmployee,ambiguityMessage}
