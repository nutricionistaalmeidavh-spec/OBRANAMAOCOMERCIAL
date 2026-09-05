const ADMISSION_DOCUMENTS = Object.freeze([
  { key: 'contrato_experiencia', title: 'Contrato de experiência' },
  { key: 'ficha_registro', title: 'Ficha de registro', canonical: true },
  { key: 'ordem_servico', title: 'Ordem de serviço' },
  { key: 'vale_transporte', title: 'Vale-transporte' },
  { key: 'ficha_epi', title: 'Ficha de EPI' },
  { key: 'carta_sindical', title: 'Carta de oposição sindical', optional: true }
])

const employeeDocumentMatrix = Object.freeze([
  { key:'nome',group:'identificacao' },{ key:'cpf',group:'identificacao' },{ key:'rg',group:'identificacao' },
  { key:'rg_emissao',group:'identificacao' },{ key:'rg_orgao',group:'identificacao' },{ key:'data_nascimento',group:'identificacao' },
  { key:'naturalidade',group:'identificacao' },{ key:'nacionalidade',group:'identificacao' },{ key:'estado_civil',group:'identificacao' },
  { key:'sexo',group:'identificacao' },{ key:'cor',group:'identificacao' },{ key:'escolaridade',group:'identificacao' },
  { key:'deficiencia',group:'identificacao' },{ key:'pai',group:'identificacao' },{ key:'mae',group:'identificacao' },
  { key:'ctps',group:'documentos' },{ key:'ctps_serie',group:'documentos' },{ key:'ctps_uf',group:'documentos' },
  { key:'ctps_expedicao',group:'documentos' },{ key:'pis',group:'documentos' },{ key:'cnh',group:'documentos' },
  { key:'cnh_categoria',group:'documentos' },{ key:'titulo_eleitor',group:'documentos' },{ key:'titulo_eleitor_zona',group:'documentos' },
  { key:'titulo_eleitor_secao',group:'documentos' },{ key:'certificado_reservista',group:'documentos' },{ key:'reservista_categoria',group:'documentos' },
  { key:'endereco',group:'endereco' },{ key:'endereco_logradouro',group:'endereco' },{ key:'endereco_numero',group:'endereco' },
  { key:'endereco_complemento',group:'endereco' },{ key:'endereco_bairro',group:'endereco' },{ key:'endereco_cidade',group:'endereco' },
  { key:'endereco_uf',group:'endereco' },{ key:'cep',group:'endereco' },
  { key:'matricula',group:'contrato' },{ key:'matricula_esocial',group:'contrato' },{ key:'admissao',group:'contrato' },
  { key:'cargo_id',group:'contrato' },{ key:'cbo',group:'contrato',derived:true },{ key:'salario_centavos',group:'contrato' },
  { key:'jornada_inicio',group:'contrato' },{ key:'intervalo_inicio',group:'contrato' },{ key:'intervalo_fim',group:'contrato' },
  { key:'jornada_fim',group:'contrato' },{ key:'experiencia_dias',group:'contrato' },{ key:'experiencia_fim',group:'contrato' },
  { key:'fgts_optante',group:'contrato' },{ key:'fgts_opcao_em',group:'contrato' },{ key:'beneficiarios',group:'contrato' },
  { key:'vale_transporte_opcao',group:'beneficios' },{ key:'vale_transporte_detalhes',group:'beneficios' }
])

module.exports = { ADMISSION_DOCUMENTS, employeeDocumentMatrix }
