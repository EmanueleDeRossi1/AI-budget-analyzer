import { BudgetLineItem } from './api'
import { FilterSpec, applyFilters } from './filterSpec'
import { PeriodType, periodLabel, sortPeriodValues } from './periods'

export type ChartRow = {
  name: string
  budget: number
  actual: number
  variance: number
  variance_pct: number
}

export type PeriodChartRow = ChartRow & { period: string }

export type PeriodChartData = {
  rows: PeriodChartRow[]
  excluded: number
}

/**
 * Apply only the filter part of a FilterSpec to raw line items.
 * Re-exported here for convenience — the canonical implementation lives in filterSpec.ts.
 */
export { applyFilters }

/**
 * Group filtered items by a single dimension (department or category),
 * summing budget and actual, computing variance.
 */
export function aggregateByDimension(
  items: BudgetLineItem[],
  field: 'department' | 'category',
): ChartRow[] {
  const groups = new Map<string, { budget: number; actual: number }>()
  for (const item of items) {
    const key = item[field] || '—'
    const g = groups.get(key) ?? { budget: 0, actual: 0 }
    groups.set(key, {
      budget: g.budget + Number(item.budget_amount),
      actual: g.actual + Number(item.actual_amount),
    })
  }
  return Array.from(groups.entries()).map(([name, { budget, actual }]) => {
    const variance = budget - actual
    return { name, budget, actual, variance, variance_pct: budget ? (variance / budget) * 100 : 0 }
  })
}

/**
 * Group filtered items by period, sorted chronologically.
 * Items without a period are excluded and counted separately.
 */
export function aggregateByPeriod(
  items: BudgetLineItem[],
  periodType: PeriodType,
): PeriodChartData {
  const withPeriod = items.filter(i => i.period)
  const excluded = items.length - withPeriod.length

  const groups = new Map<string, { budget: number; actual: number }>()
  for (const item of withPeriod) {
    const g = groups.get(item.period) ?? { budget: 0, actual: 0 }
    groups.set(item.period, {
      budget: g.budget + Number(item.budget_amount),
      actual: g.actual + Number(item.actual_amount),
    })
  }

  const sorted = sortPeriodValues([...groups.keys()], periodType)
  const rows: PeriodChartRow[] = sorted.map(period => {
    const { budget, actual } = groups.get(period)!
    const variance = budget - actual
    return {
      period,
      name: periodLabel(period, periodType),
      budget,
      actual,
      variance,
      variance_pct: budget ? (variance / budget) * 100 : 0,
    }
  })

  return { rows, excluded }
}
