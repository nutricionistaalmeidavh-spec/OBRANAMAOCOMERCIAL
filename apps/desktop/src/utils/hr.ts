const documentLabels: Record<string,string> = {
  contrato_experiencia: 'Contrato de experiência',
  ficha_registro: 'Ficha de registro',
  ordem_servico: 'Ordem de serviço',
  vale_transporte: 'Vale-transporte',
  ficha_epi: 'Ficha de EPI',
  carta_sindical: 'Carta de oposição sindical',
}

export function humanizeHrDocumentKey(value: string) {
  return documentLabels[value] || String(value || '').replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())
}
