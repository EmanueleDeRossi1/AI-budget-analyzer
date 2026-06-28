import { BudgetLineItem } from './api'
import { PeriodType, periodLabel, sortPeriodValues } from './periods'

export type GroupByField = 'period' | 'department' | 'category'

export type HighlightSpec = {
  departments?: string[]
  categories?: string[]
  periods?: string[]
}

export function matchesHighlight(
  item: { department: string; category: string; period: string },
  spec: HighlightSpec,
): boolean {
  if (spec.departments?.length && !spec.departments.includes(item.department)) return false
  if (spec.categories?.length && !spec.categories.includes(item.category)) return false
  if (spec.periods?.length && !spec.periods.includes(item.period)) return false
  return true
}

export type FilterSpec = {
  departments?: string[]
  categories?: string[]
  periods?: string[]
  group_by?: GroupByField[]   // ordered array — position = nesting level
  sort_by?: 'variance' | 'budget' | 'actual'
  sort_dir?: 'asc' | 'desc'
  period_type?: PeriodType    // passed through for correct period display + sort order
  columns?: string[]          // active derived column IDs from the operations registry
}

export type FilteredRow = {
  key: string
  // Dimension values — only populated for the dimensions present in the data/grouping
  period?: string
  department?: string
  category?: string
  // Financials
  budget: number
  actual: number
  variance: number
  variance_pct: number
  notes?: string
  item_count?: number
  // Grouping metadata
  level: number           // 0 = top-level, 1 = nested, 2 = double-nested, etc.
  isGroupRow: boolean     // true = summary/header row (no edit/delete)
  // The dimension this row groups by (used for the group label in the table)
  groupField?: GroupByField
  groupValue?: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function toRow(item: BudgetLineItem): FilteredRow {
  const budget = Number(item.budget_amount)
  const actual = Number(item.actual_amount)
  const variance = budget - actual
  return {
    key: String(item.id),
    period: item.period || undefined,
    department: item.department,
    category: item.category,
    budget,
    actual,
    variance,
    variance_pct: budget ? (variance / budget) * 100 : 0,
    notes: item.notes,
    level: 0,
    isGroupRow: false,
  }
}

function summarise(
  rows: FilteredRow[],
  key: string,
  level: number,
  groupField: GroupByField,
  groupValue: string,
  dimensionValues: Partial<Record<GroupByField, string>>,
): FilteredRow {
  const budget   = rows.reduce((s, r) => s + r.budget, 0)
  const actual   = rows.reduce((s, r) => s + r.actual, 0)
  const variance = budget - actual
  return {
    key,
    ...dimensionValues,
    budget,
    actual,
    variance,
    variance_pct: budget ? (variance / budget) * 100 : 0,
    item_count: rows.length,
    isGroupRow: true,
    level,
    groupField,
    groupValue,
  }
}

function sortRows(
  rows: FilteredRow[],
  sortBy: FilterSpec['sort_by'],
  sortDir: FilterSpec['sort_dir'],
): FilteredRow[] {
  const dir = (sortDir ?? 'desc') === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const va = sortBy === 'budget' ? a.budget : sortBy === 'actual' ? a.actual : a.variance
    const vb = sortBy === 'budget' ? b.budget : sortBy === 'actual' ? b.actual : b.variance
    return dir * (va - vb)
  })
}

/**
 * Recursively group `rows` by `dimensions[0]`, then recurse into each group
 * with `dimensions[1:]`. Returns a flat interleaved list: header row followed
 * by its children (which may themselves be header+children pairs).
 *
 * Period groups are always sorted chronologically; other dimensions sort by
 * the active financial metric.
 */
function groupRecursive(
  rows: FilteredRow[],
  dimensions: GroupByField[],
  level: number,
  sortBy: FilterSpec['sort_by'],
  sortDir: FilterSpec['sort_dir'],
  periodType: PeriodType,
  parentDimensions: Partial<Record<GroupByField, string>> = {},
): FilteredRow[] {
  if (dimensions.length === 0) return rows

  const field = dimensions[0]
  const rest  = dimensions.slice(1)

  // Group by the current dimension
  const groups = new Map<string, FilteredRow[]>()
  for (const row of rows) {
    const k = (row[field] ?? '') as string
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(row)
  }

  // Build summary rows for this level
  const summaries: FilteredRow[] = Array.from(groups.entries()).map(([value, members]) => {
    const dimValues = { ...parentDimensions, [field]: value }
    return summarise(members, `grp-${level}-${value}`, level, field, value, dimValues)
  })

  // Period groups sort chronologically; all others sort by financial metric
  const sorted = field === 'period'
    ? (() => {
        const order = sortPeriodValues(summaries.map(r => r.groupValue!), periodType)
        return order.map(v => summaries.find(r => r.groupValue === v)!)
      })()
    : sortRows(summaries, sortBy, sortDir)

  // Interleave: summary row → recursed children
  const result: FilteredRow[] = []
  for (const summary of sorted) {
    result.push(summary)
    const members = groups.get(summary.groupValue!)!
    const dimValues = { ...parentDimensions, [field]: summary.groupValue! }

    if (rest.length > 0) {
      result.push(...groupRecursive(members, rest, level + 1, sortBy, sortDir, periodType, dimValues))
    } else {
      for (const r of sortRows(members, sortBy, sortDir)) {
        result.push({ ...r, level: level + 1 })
      }
    }
  }
  return result
}

// ── main export ───────────────────────────────────────────────────────────────

export function applyFilterSpec(items: BudgetLineItem[], spec: FilterSpec): FilteredRow[] {
  // 1. Filter
  let filtered = items
  if (spec.departments?.length)
    filtered = filtered.filter(i => spec.departments!.includes(i.department))
  if (spec.categories?.length)
    filtered = filtered.filter(i => spec.categories!.includes(i.category))
  if (spec.periods?.length)
    filtered = filtered.filter(i => spec.periods!.includes(i.period))

  const groupBy = spec.group_by ?? []
  const rows = filtered.map(toRow)

  // 2. No grouping — flat sorted list
  if (groupBy.length === 0) {
    return sortRows(rows, spec.sort_by, spec.sort_dir)
  }

  // 3. Grouped — recursive n-level
  return groupRecursive(rows, groupBy, 0, spec.sort_by, spec.sort_dir, spec.period_type ?? 'custom')
}

export function isEmptySpec(spec: FilterSpec): boolean {
  return (
    !spec.departments?.length &&
    !spec.categories?.length &&
    !spec.periods?.length &&
    !spec.group_by?.length &&
    !spec.sort_by &&
    !spec.columns?.length
  )
}

/**
 * Add or remove a dimension from the group_by ordered list.
 * Adding always appends to the end (preserving existing order).
 * Removing leaves the other dimensions in place.
 */
export function toggleGroupBy(spec: FilterSpec, field: GroupByField): FilterSpec {
  const current = spec.group_by ?? []
  const has = current.includes(field)
  const next = has ? current.filter(f => f !== field) : [...current, field]
  return { ...spec, group_by: next.length ? next : undefined }
}

/**
 * Move a group-by dimension one position earlier or later in the order.
 */
export function moveGroupBy(spec: FilterSpec, field: GroupByField, dir: 'up' | 'down'): FilterSpec {
  const current = [...(spec.group_by ?? [])]
  const idx = current.indexOf(field)
  if (idx < 0) return spec
  const target = dir === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= current.length) return spec
  ;[current[idx], current[target]] = [current[target], current[idx]]
  return { ...spec, group_by: current }
}
