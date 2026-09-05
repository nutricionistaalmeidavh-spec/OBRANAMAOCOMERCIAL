import { describe, expect, it } from 'vitest'
import { ADMISSION_DOCUMENTS } from './admission-documents.cjs'
import { buildAdmissionPlan, validateAdmissionDocuments, admissionDocumentFilename } from './admission-policy.cjs'

const employee:any={
  nome:'COLABORADOR TESTE',cpf:'12345678901',rg:'123456',rg_orgao:'SSP',data_nascimento:'2000-01-01',
  naturalidade:'CIDADE-UF',nacionalidade:'Brasileira',estado_civil:'Solteiro',pai:'RESPONSAVEL 1',mae:'RESPONSAVEL 2',
  ctps:'1234567',ctps_serie:'001',pis:'12345678901',endereco_logradouro:'Rua Exemplo',endereco_numero:'10',
  endereco_bairro:'Centro',endereco_cidade:'Cidade',endereco_uf:'SP',cep:'14000-000',matricula_esocial:'0001',
  admissao:'2026-09-01',cargo_id:1,cargo_nome:'Cargo Teste',salario_centavos:250000,jornada_inicio:'07:00',
  intervalo_inicio:'11:00',intervalo_fim:'12:00',jornada_fim:'17:00',experiencia_dias:45,experiencia_fim:'2026-10-15',
  fgts_optante:1,fgts_opcao_em:'2026-09-01',vale_transporte_opcao:1
}

describe('commercial admission rules',()=>{
  it('uses the canonical admission set and retires livro registro',()=>{
    const keys=ADMISSION_DOCUMENTS.map((doc:any)=>doc.key)
    expect(keys).toEqual(['contrato_experiencia','ficha_registro','ordem_servico','vale_transporte','ficha_epi','carta_sindical'])
    expect(keys).not.toContain('livro_registro')
  })

  it('keeps company-specific or union-sensitive documents optional',()=>{
    expect(ADMISSION_DOCUMENTS.find((doc:any)=>doc.key==='carta_sindical')?.optional).toBe(true)
    expect(buildAdmissionPlan(employee,false).map((doc:any)=>doc.key)).not.toContain('carta_sindical')
  })

  it('validates required fields per document before generation',()=>{
    const result=validateAdmissionDocuments({...employee,ctps:'',endereco_logradouro:''},['contrato_experiencia','vale_transporte'])
    expect(result.ok).toBe(false)
    expect(result.byDocument.contrato_experiencia).toContain('ctps')
    expect(result.byDocument.vale_transporte).toContain('endereco_logradouro')
  })

  it('does not embed MH-specific identity or fixed monetary values in admission rules',()=>{
    const serialized=JSON.stringify({documents:ADMISSION_DOCUMENTS,plan:buildAdmissionPlan(employee,true)})
    expect(serialized).not.toMatch(/MH Hidráulica|510|180|266475/i)
  })

  it('uses stable numbered filenames for deterministic dossiers',()=>{
    expect(admissionDocumentFilename(0,'Contrato de experiência')).toBe('01 - Contrato de experiência.pdf')
  })
})
