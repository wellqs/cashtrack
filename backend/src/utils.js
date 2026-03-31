export function sanitizeText(value = '') {
  return String(value).trim()
}

export function parseIsoDateParts(dateStr) {
  const value = String(dateStr || '')
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() + 1 !== month || probe.getUTCDate() !== day) return null

  return { year, month, day }
}

export function isIsoDateString(dateStr) {
  return Boolean(parseIsoDateParts(dateStr))
}

export function toMonth(dateStr) {
  const parts = parseIsoDateParts(dateStr)
  if (!parts) return ''
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`
}

export function quarterMonths(period) {
  if (period === 'Q1') return [1, 2, 3]
  if (period === 'Q2') return [4, 5, 6]
  if (period === 'Q3') return [7, 8, 9]
  if (period === 'Q4') return [10, 11, 12]
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}
