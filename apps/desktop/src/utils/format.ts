export const brl = (value = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0) / 100)

const normalizeDateInput = (value?: string | number | Date) => {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value)
    return excelEpoch.toISOString().slice(0, 10)
  }
  return String(value).slice(0, 10)
}

export const brDate = (value?: string | number | Date) => {
  const normalized = normalizeDateInput(value)
  return normalized ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${normalized}T12:00:00`)) : '-'
}

export const competenceLabel = (value: string | number | Date) => {
  if (!value) return '-'
  const [year, month] = normalizeDateInput(value).split('-').map(Number)
  if (!year || !month) return String(value)
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1)).replace('.', '')
}

export const toCents = (value: string | number) => Math.round(Number(String(value || 0).replace(/\./g, '').replace(',', '.')) * 100)
export const currentCompetence = () => new Date().toISOString().slice(0, 7)
export const today = () => new Date().toISOString().slice(0, 10)
