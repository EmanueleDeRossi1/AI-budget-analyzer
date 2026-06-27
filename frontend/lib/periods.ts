export type PeriodType = 'year' | 'half' | 'quarter' | 'month' | 'custom'

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  year:    'Year',
  half:    'Half-year',
  quarter: 'Quarter',
  month:   'Month',
  custom:  'Custom',
}

// Valid period values per type, in chronological order.
// Months are stored as zero-padded numbers ('01'–'12') so string sort = chronological sort.
// Years are generated dynamically — see periodOptions().
export const PERIOD_VALUES: Record<Exclude<PeriodType, 'year' | 'custom'>, string[]> = {
  half:    ['H1', 'H2'],
  quarter: ['Q1', 'Q2', 'Q3', 'Q4'],
  month:   ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}

/** Returns display label for a stored period value (e.g. '01' → 'Jan'). */
export function periodLabel(value: string, type: PeriodType): string {
  if (type === 'month') return MONTH_NAMES[value] ?? value
  return value
}

/** Returns the ordered list of { value, label } options for a given period type. */
export function periodOptions(type: PeriodType): { value: string; label: string }[] {
  if (type === 'custom') return []

  if (type === 'year') {
    const current = new Date().getFullYear()
    return Array.from({ length: 7 }, (_, i) => {
      const y = String(current - 2 + i)
      return { value: y, label: y }
    })
  }

  return PERIOD_VALUES[type].map(v => ({ value: v, label: periodLabel(v, type) }))
}

/**
 * Sort an array of period value strings in chronological order for the given type.
 * Falls back to alphabetical for custom periods.
 */
export function sortPeriodValues(values: string[], type: PeriodType): string[] {
  if (type === 'custom') return [...values].sort()

  const order = periodOptions(type).map(o => o.value)
  const known  = values.filter(v => order.includes(v))
  const unknown = values.filter(v => !order.includes(v)).sort()
  return [...known.sort((a, b) => order.indexOf(a) - order.indexOf(b)), ...unknown]
}
