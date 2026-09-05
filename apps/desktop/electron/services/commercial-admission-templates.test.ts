import { describe, expect, it } from 'vitest'
import { renderCommercialAdmissionTemplate } from './commercial-admission-templates.cjs'

const employee:any={nome:'COLABORADOR TESTE',cpf:'12345678901',ctps:'123',ctps_serie:'1',cargo_nome:'Técnico de Campo',admissao:'2026-09-01',salario_centavos:250000,jornada_inicio:'08:00',intervalo_inicio:'12:00',intervalo_fim:'13:00',jornada_fim:'17:00',experiencia_dias:45,experiencia_fim:'2026-10-15',endereco_logradouro:'Rua A',endereco_numero:'10',endereco_bairro:'Centro',endereco_cidade:'Cidade',endereco_uf:'SP',cep:'14000-000'}
const company:any={razao_social:'EMPRESA CLIENTE',cnpj:'00.000.000/0001-00',endereco:'Avenida Cliente, 100 - Cidade/SP'}

describe('commercial admission templates',()=>{
  it('renders company and role from runtime data instead of MH defaults',()=>{
    const html=renderCommercialAdmissionTemplate('contrato_experiencia',employee,company,[],null,{})
    expect(html).toContain('EMPRESA CLIENTE')
    expect(html).toContain('Técnico de Campo')
    expect(html).not.toMatch(/MH Hidráulica|Encanador|Ribeirão Preto/i)
  })

  it('keeps union recipient configurable instead of hardcoded',()=>{
    const neutral=renderCommercialAdmissionTemplate('carta_sindical',employee,company,[],null,{})
    expect(neutral).toContain('entidade sindical')
    expect(neutral).not.toContain('Sindicato da Construção Civil')
    const configured=renderCommercialAdmissionTemplate('carta_sindical',employee,company,[],null,{sindicato_nome:'Sindicato Configurado'})
    expect(configured).toContain('Sindicato Configurado')
  })

  it('uses configured SST activity, risks and orientation text for service orders',()=>{
    const html=renderCommercialAdmissionTemplate('ordem_servico',employee,company,[],null,{atividades:'Atividade configurada',riscos:'Risco configurado',medidas:'Medida configurada'})
    expect(html).toContain('Atividade configurada')
    expect(html).toContain('Risco configurado')
    expect(html).toContain('Medida configurada')
    expect(html).not.toMatch(/instalações hidráulicas|NR35/i)
  })
})
