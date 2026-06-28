import { BudgetLineItem } from './api'
import { toNum, computeVariance, computeVariancePct } from './budget'
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
      budget: g.budget + toNum(item.budget_amount),
      actual: g.actual + toNum(item.actual_amount),
    })
  }
  return Array.from(groups.entries()).map(([name, { budget, actual }]) => {
    const variance = computeVariance(budget, actual)
    return { name, budget, actual, variance, variance_pct: computeVariancePct(budget, actual) }
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
      budget: g.budget + toNum(item.budget_amount),
      actual: g.actual + toNum(item.actual_amount),
    })
  }

  const sorted = sortPeriodValues(Array.from(groups.keys()), periodType)
  const rows: PeriodChartRow[] = sorted.map(period => {
    const { budget, actual } = groups.get(period)!
    const variance = computeVariance(budget, actual)
    return {
      period,
      name: periodLabel(period, periodType),
      budget,
      actual,
      variance,
      variance_pct: computeVariancePct(budget, actual),
    }
  })

  return { rows, excluded }
}
