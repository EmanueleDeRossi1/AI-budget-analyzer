import { BudgetLineItem } from './api'

/**
 * Canonical financial math for the budget domain.
 * All variance/percent computations across the app derive from here.
 */

export function toNum(v: string | number): number {
  return typeof v === 'string' ? parseFloat(v) || 0 : v
}

export function computeVariance(budget: number, actual: number): number {
  return budget - actual
}

export function computeVariancePct(budget: number, actual: number): number {
  return budget ? (budget - actual) / budget * 100 : 0
}

// Minimal filter shape shared by FilterSpec, agent tool params, and chart helpers.
export type DimensionFilters = {
  departments?: string[]
  categories?: string[]
  periods?: string[]
}

export function applyFilters(items: BudgetLineItem[], filters?: DimensionFilters): BudgetLineItem[] {
  let result = items
  if (filters?.departments?.length)
    result = result.filter(i => filters.departments!.includes(i.department))
  if (filters?.categories?.length)
    result = result.filter(i => filters.categories!.includes(i.category))
  if (filters?.periods?.length)
    result = result.filter(i => filters.periods!.includes(i.period))
  return result
}
