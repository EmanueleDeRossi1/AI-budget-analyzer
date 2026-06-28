import { BudgetLineItem } from '../api'
import { FilterSpec, GroupByField } from '../filterSpec'

// ── Types ────────────────────────────────────────────────────────────────────

export type OperationKind = 'view' | 'compute' | 'data'

export type OperationContext = {
  lineItems: BudgetLineItem[]
  filterSpec: FilterSpec
  scenarioId: number | null
  refresh: () => void
}

export type ViewResult = {
  filterSpec?: FilterSpec
}

export type OperationDef<TParams = any, TResult = any> = {
  id: string
  kind: OperationKind
  execute: (ctx: OperationContext, params: TParams) => TResult | Promise<TResult>
}

export type DerivedColumnDef<TParams = any> = OperationDef<TParams, never> & {
  kind: 'compute'
  column: true
  label: string
  description: string
  // Returns a value for a single row given all items for context
  compute: (row: { budget: number; actual: number; variance: number }, allRows: { budget: number; actual: number }[]) => number
  format: (value: number) => string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function num(v: string | number): number {
  return typeof v === 'string' ? parseFloat(v) || 0 : v
}

function applyFilters(
  items: BudgetLineItem[],
  filters?: { departments?: string[]; categories?: string[]; periods?: string[] },
): BudgetLineItem[] {
  let result = items
  if (filters?.departments?.length)
    result = result.filter(i => filters.departments!.includes(i.department))
  if (filters?.categories?.length)
    result = result.filter(i => filters.categories!.includes(i.category))
  if (filters?.periods?.length)
    result = result.filter(i => filters.periods!.includes(i.period))
  return result
}

function groupAndReduce(
  items: BudgetLineItem[],
  groupBy: string,
  reducer: (items: BudgetLineItem[]) => number,
): Record<string, number> {
  const groups: Record<string, BudgetLineItem[]> = {}
  for (const item of items) {
    const key = (item as any)[groupBy] ?? ''
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  const result: Record<string, number> = {}
  for (const [key, members] of Object.entries(groups)) {
    result[key] = reducer(members)
  }
  return result
}

// ── View Operations ──────────────────────────────────────────────────────────

const setFilter: OperationDef<
  { departments?: string[]; categories?: string[]; periods?: string[] },
  ViewResult
> = {
  id: 'setFilter',
  kind: 'view',
  execute: (ctx, params) => ({
    filterSpec: {
      ...ctx.filterSpec,
      departments: params.departments?.length ? params.departments : undefined,
      categories: params.categories?.length ? params.categories : undefined,
      periods: params.periods?.length ? params.periods : undefined,
    },
  }),
}

const setGroupBy: OperationDef<{ group_by: GroupByField[] }, ViewResult> = {
  id: 'setGroupBy',
  kind: 'view',
  execute: (ctx, params) => ({
    filterSpec: {
      ...ctx.filterSpec,
      group_by: params.group_by.length ? params.group_by : undefined,
    },
  }),
}

const setSort: OperationDef<
  { sort_by: FilterSpec['sort_by']; sort_dir?: FilterSpec['sort_dir'] },
  ViewResult
> = {
  id: 'setSort',
  kind: 'view',
  execute: (ctx, params) => ({
    filterSpec: {
      ...ctx.filterSpec,
      sort_by: params.sort_by,
      sort_dir: params.sort_dir ?? ctx.filterSpec.sort_dir ?? 'desc',
    },
  }),
}

const resetView: OperationDef<Record<string, never>, ViewResult> = {
  id: 'resetView',
  kind: 'view',
  execute: () => ({ filterSpec: {} }),
}

const addColumn: OperationDef<{ column: string }, ViewResult> = {
  id: 'addColumn',
  kind: 'view',
  execute: (ctx, params) => {
    const current = ctx.filterSpec.columns ?? []
    if (current.includes(params.column)) return { filterSpec: ctx.filterSpec }
    return {
      filterSpec: { ...ctx.filterSpec, columns: [...current, params.column] },
    }
  },
}

const removeColumn: OperationDef<{ column: string }, ViewResult> = {
  id: 'removeColumn',
  kind: 'view',
  execute: (ctx, params) => {
    const current = ctx.filterSpec.columns ?? []
    const next = current.filter(c => c !== params.column)
    return {
      filterSpec: { ...ctx.filterSpec, columns: next.length ? next : undefined },
    }
  },
}

const toggleColumn: OperationDef<{ column: string }, ViewResult> = {
  id: 'toggleColumn',
  kind: 'view',
  execute: (ctx, params) => {
    const current = ctx.filterSpec.columns ?? []
    if (current.includes(params.column)) {
      return removeColumn.execute(ctx, params)
    }
    return addColumn.execute(ctx, params)
  },
}

// Combined view update (used by AI's update_view tool)
const updateView: OperationDef<
  {
    departments?: string[]
    categories?: string[]
    periods?: string[]
    group_by?: GroupByField[]
    sort_by?: FilterSpec['sort_by']
    sort_dir?: FilterSpec['sort_dir']
    columns?: string[]
  },
  ViewResult
> = {
  id: 'updateView',
  kind: 'view',
  execute: (ctx, params) => ({
    filterSpec: {
      ...ctx.filterSpec,
      ...(params.departments !== undefined ? { departments: params.departments.length ? params.departments : undefined } : {}),
      ...(params.categories !== undefined ? { categories: params.categories.length ? params.categories : undefined } : {}),
      ...(params.periods !== undefined ? { periods: params.periods.length ? params.periods : undefined } : {}),
      ...(params.group_by !== undefined ? { group_by: params.group_by.length ? params.group_by : undefined } : {}),
      ...(params.sort_by !== undefined ? { sort_by: params.sort_by } : {}),
      ...(params.sort_dir !== undefined ? { sort_dir: params.sort_dir } : {}),
      ...(params.columns !== undefined ? { columns: params.columns.length ? params.columns : undefined } : {}),
    },
  }),
}

// ── Compute Operations ───────────────────────────────────────────────────────

const sum: OperationDef<
  { field?: 'actual' | 'budget' | 'variance'; groupBy?: string; filters?: { departments?: string[]; categories?: string[]; periods?: string[] } },
  number | Record<string, number>
> = {
  id: 'sum',
  kind: 'compute',
  execute: (ctx, params) => {
    const items = applyFilters(ctx.lineItems, params.filters)
    const field = params.field ?? 'actual'
    const valueOf = (i: BudgetLineItem) => {
      if (field === 'budget') return num(i.budget_amount)
      if (field === 'variance') return num(i.budget_amount) - num(i.actual_amount)
      return num(i.actual_amount)
    }
    if (params.groupBy) {
      return groupAndReduce(items, params.groupBy, members =>
        Math.round(members.reduce((s, i) => s + valueOf(i), 0) * 100) / 100
      )
    }
    return Math.round(items.reduce((s, i) => s + valueOf(i), 0) * 100) / 100
  },
}

const count: OperationDef<
  { groupBy?: string; filters?: { departments?: string[]; categories?: string[]; periods?: string[] }; overBudget?: boolean },
  number | Record<string, number>
> = {
  id: 'count',
  kind: 'compute',
  execute: (ctx, params) => {
    let items = applyFilters(ctx.lineItems, params.filters)
    if (params.overBudget) {
      items = items.filter(i => num(i.actual_amount) > num(i.budget_amount))
    }
    if (params.groupBy) {
      return groupAndReduce(items, params.groupBy, members => members.length)
    }
    return items.length
  },
}

const min: OperationDef<
  { field?: 'actual' | 'budget' | 'variance'; filters?: { departments?: string[]; categories?: string[]; periods?: string[] } },
  number | null
> = {
  id: 'min',
  kind: 'compute',
  execute: (ctx, params) => {
    const items = applyFilters(ctx.lineItems, params.filters)
    if (!items.length) return null
    const field = params.field ?? 'actual'
    const valueOf = (i: BudgetLineItem) => {
      if (field === 'budget') return num(i.budget_amount)
      if (field === 'variance') return num(i.budget_amount) - num(i.actual_amount)
      return num(i.actual_amount)
    }
    return Math.round(Math.min(...items.map(valueOf)) * 100) / 100
  },
}

const max: OperationDef<
  { field?: 'actual' | 'budget' | 'variance'; filters?: { departments?: string[]; categories?: string[]; periods?: string[] } },
  number | null
> = {
  id: 'max',
  kind: 'compute',
  execute: (ctx, params) => {
    const items = applyFilters(ctx.lineItems, params.filters)
    if (!items.length) return null
    const field = params.field ?? 'actual'
    const valueOf = (i: BudgetLineItem) => {
      if (field === 'budget') return num(i.budget_amount)
      if (field === 'variance') return num(i.budget_amount) - num(i.actual_amount)
      return num(i.actual_amount)
    }
    return Math.round(Math.max(...items.map(valueOf)) * 100) / 100
  },
}

const pctOfBudget: OperationDef<
  { filters?: { departments?: string[]; categories?: string[]; periods?: string[] } },
  number | null
> = {
  id: 'pctOfBudget',
  kind: 'compute',
  execute: (ctx, params) => {
    const items = applyFilters(ctx.lineItems, params.filters)
    const b = items.reduce((s, i) => s + num(i.budget_amount), 0)
    const a = items.reduce((s, i) => s + num(i.actual_amount), 0)
    return b ? Math.round((a / b) * 1000) / 10 : null
  },
}

const pctOfTotal: OperationDef<
  { filters?: { departments?: string[]; categories?: string[]; periods?: string[] } },
  number | null
> = {
  id: 'pctOfTotal',
  kind: 'compute',
  execute: (ctx, params) => {
    const totalActual = ctx.lineItems.reduce((s, i) => s + num(i.actual_amount), 0)
    const items = applyFilters(ctx.lineItems, params.filters)
    const filteredActual = items.reduce((s, i) => s + num(i.actual_amount), 0)
    return totalActual ? Math.round((filteredActual / totalActual) * 1000) / 10 : null
  },
}

// ── Derived Column Definitions ───────────────────────────────────────────────

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

function fmtMoney(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export const derivedColumns: Record<string, DerivedColumnDef> = {
  pctOfTotal: {
    id: 'pctOfTotal',
    kind: 'compute',
    column: true,
    label: '% of Total',
    description: "Each row's share of total spend",
    compute: (row, allRows) => {
      const total = allRows.reduce((s, r) => s + r.actual, 0)
      return total ? (row.actual / total) * 100 : 0
    },
    format: fmtPct,
    execute: () => { throw new Error('Use compute() for derived columns') },
  },
  burnRate: {
    id: 'burnRate',
    kind: 'compute',
    column: true,
    label: 'Burn Rate',
    description: 'Actual / Budget %',
    compute: (row) => {
      return row.budget ? (row.actual / row.budget) * 100 : 0
    },
    format: fmtPct,
    execute: () => { throw new Error('Use compute() for derived columns') },
  },
  variancePct: {
    id: 'variancePct',
    kind: 'compute',
    column: true,
    label: 'Variance %',
    description: 'Variance as % of budget',
    compute: (row) => {
      return row.budget ? (row.variance / row.budget) * 100 : 0
    },
    format: fmtPct,
    execute: () => { throw new Error('Use compute() for derived columns') },
  },
  runningTotal: {
    id: 'runningTotal',
    kind: 'compute',
    column: true,
    label: 'Running Total',
    description: 'Cumulative actual spend',
    // This is computed at the table level since it depends on row order
    compute: () => 0, // placeholder — computed in BudgetTable with index awareness
    format: fmtMoney,
    execute: () => { throw new Error('Use compute() for derived columns') },
  },
  rank: {
    id: 'rank',
    kind: 'compute',
    column: true,
    label: 'Rank',
    description: 'Position by spend (1 = highest)',
    compute: (row, allRows) => {
      const sorted = [...allRows].sort((a, b) => b.actual - a.actual)
      return sorted.findIndex(r => r.actual === row.actual) + 1
    },
    format: (v) => `#${v}`,
    execute: () => { throw new Error('Use compute() for derived columns') },
  },
}

// ── Registry ─────────────────────────────────────────────────────────────────

export const registry: Record<string, OperationDef> = {
  // View ops
  setFilter,
  setGroupBy,
  setSort,
  resetView,
  addColumn,
  removeColumn,
  toggleColumn,
  updateView,
  // Compute ops
  sum,
  count,
  min,
  max,
  pctOfBudget,
  pctOfTotal,
}

export function getOperation(id: string): OperationDef | undefined {
  return registry[id]
}

export function getDerivedColumn(id: string): DerivedColumnDef | undefined {
  return derivedColumns[id]
}

export function getAllDerivedColumns(): DerivedColumnDef[] {
  return Object.values(derivedColumns)
}
