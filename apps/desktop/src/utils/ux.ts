export const financialMargin = (result: number, revenue: number): number | null => revenue > 0 ? result / revenue * 100 : null
export function matchesNavigation(label: string, search: string) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  return normalize(label).includes(normalize(search))
}
export function statusTone(value: string) {
  const status = String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll(' ', '_')
  const tones: Record<string, string> = {
    pago:'success', recebida:'success', recebido:'success', ativo:'success', ativa:'success', concluido:'success', concluida:'success', assinado:'success', assinada:'success',
    vencido:'danger', vencida:'danger', cancelado:'danger', cancelada:'danger', inativo:'danger', inativa:'danger',
    parcial:'warning', parcialmente_pago:'warning', parcialmente_recebido:'warning', pendente:'warning', rascunho:'warning', aberta:'warning', aberto:'warning', em_andamento:'warning',
  }
  return tones[status] || 'neutral'
}
export function matchesAccountStatus(status: string, filter: string) {
  return !filter || (filter === 'pendente' ? ['pendente', 'vencido', 'parcialmente_pago', 'parcialmente_recebido', 'parcial'].includes(status) : status === filter)
}
