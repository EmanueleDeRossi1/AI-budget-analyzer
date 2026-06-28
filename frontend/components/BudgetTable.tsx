'use client'

import { useMemo, useState, useCallback } from 'react'
import {
  Group, Text, Badge, ActionIcon, Table, Select,
} from '@mantine/core'
import { Trash2, CopyPlus, ChevronRight, ChevronDown } from 'lucide-react'
import { BudgetLineItem } from '@/lib/api'
import { FilterSpec, FilteredRow, GroupByField } from '@/lib/filterSpec'
import { PeriodType, PERIOD_TYPE_LABELS, periodLabel, periodOptions } from '@/lib/periods'
import { fmt } from '@/lib/utils'
import { useInlineEdit, EditableField } from '@/lib/useInlineEdit'
import EditableCell, { CellInput } from '@/components/EditableCell'
import SuggestInput from '@/components/SuggestInput'
import EditRow from '@/components/EditRow'
import ColumnPicker from '@/components/ColumnPicker'
import { api } from '@/lib/api'
import { getDerivedColumn, DerivedColumnDef } from '@/lib/operations'

// ── Variance display ─────────────────────────────────────────────────────────

function VarianceBadge({ variance }: { variance: number }) {
  if (variance > 0) return <Badge color="green" variant="light">+{fmt(variance)}</Badge>
  if (variance < 0) return <Badge color="red" variant="light">{fmt(variance)}</Badge>
  return <Badge color="gray" variant="light">—</Badge>
}

function VariancePct({ pct }: { pct: number }) {
  if (pct === 0) return null
  return (
    <Text size="xs" c={pct > 0 ? 'green' : 'red'}>
      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
    </Text>
  )
}

// ── Group header row ─────────────────────────────────────────────────────────

function GroupHeaderRow({
  row, periodType, activeColumns, allRowsContext, collapsed, onToggle,
}: {
  row: FilteredRow
  periodType: PeriodType
  activeColumns: DerivedColumnDef[]
  allRowsContext: { budget: number; actual: number }[]
  collapsed: boolean
  onToggle: () => void
}) {
  const paddingLeft = 4 + row.level * 16
  const bg = row.level === 0 ? 'var(--mantine-color-gray-1)' : 'var(--mantine-color-gray-0)'
  const displayValue = row.groupField === 'period'
    ? periodLabel(row.groupValue ?? '', periodType)
    : row.groupValue

  return (
    <Table.Tr style={{ background: bg }}>
      <Table.Td colSpan={3} style={{ paddingLeft, paddingTop: 8, paddingBottom: 8 }}>
        <Group gap={4}>
          <ActionIcon variant="subtle" size="xs" color="gray" onClick={onToggle} style={{ width: 20, height: 20 }}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </ActionIcon>
          <Text size="sm" fw={row.level === 0 ? 700 : 600}>{displayValue}</Text>
          <Text size="xs" c="dimmed">({row.item_count} {row.item_count === 1 ? 'item' : 'items'})</Text>
        </Group>
      </Table.Td>
      <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={600}>{fmt(row.budget)}</Text></Table.Td>
      <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={600}>{fmt(row.actual)}</Text></Table.Td>
      <Table.Td style={{ textAlign: 'right' }}><VarianceBadge variance={row.variance} /></Table.Td>
      {activeColumns.map(col => (
        <Table.Td key={col.id} style={{ textAlign: 'right' }}>
          <Text size="sm" fw={600} c="blue">
            {col.format(col.compute(
              { budget: row.budget, actual: row.actual, variance: row.variance },
              allRowsContext
            ))}
          </Text>
        </Table.Td>
      ))}
      <Table.Td><VariancePct pct={row.variance_pct} /></Table.Td>
      <Table.Td />
    </Table.Tr>
  )
}

// ── Main table component ─────────────────────────────────────────────────────

export default function BudgetTable({
  lineItems,
  visibleRows,
  activeSpec,
  activePeriodType,
  refresh,
  selectedId,
  onDeleteItem,
  onDuplicateItem,
  dispatch,
  addingRow,
  newRow,
  onNewRowChange,
  onNewRowSave,
  onNewRowCancel,
}: {
  lineItems: BudgetLineItem[]
  visibleRows: FilteredRow[]
  activeSpec: FilterSpec
  activePeriodType: PeriodType
  refresh: () => void
  selectedId: number | null
  onDeleteItem: (id: number) => void
  onDuplicateItem: (item: BudgetLineItem) => void
  dispatch: (operationId: string, params?: any) => any
  addingRow?: boolean
  newRow?: Partial<BudgetLineItem>
  onNewRowChange?: (v: Partial<BudgetLineItem>) => void
  onNewRowSave?: () => void
  onNewRowCancel?: () => void
}) {
  const { editCell, activateCell, saveCellEdit, cancelCellEdit, updateValue, setEditCell } = useInlineEdit(refresh)

  const uniqueDepts = Array.from(new Set(lineItems.map(i => i.department)))
  const uniqueCats = Array.from(new Set(lineItems.map(i => i.category)))

  // ── Collapsed groups state (collapsed by default) ────────────────────

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleCollapse = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }, [])

  const isGrouped = (activeSpec.group_by ?? []).length > 0

  // ── Derived columns ──────────────────────────────────────────────────────

  const activeColumns = useMemo(() => {
    return (activeSpec.columns ?? [])
      .map(id => getDerivedColumn(id))
      .filter((c): c is DerivedColumnDef => c !== undefined)
  }, [activeSpec.columns])

  // Pre-compute allRows context for derived column functions
  const allRowsContext = useMemo(() => {
    return visibleRows
      .filter(r => !r.isGroupRow)
      .map(r => ({ budget: r.budget, actual: r.actual }))
  }, [visibleRows])

  // ── Cell renderers ───────────────────────────────────────────────────────

  function periodCell(item: BudgetLineItem, display: React.ReactNode) {
    const isEditing = editCell?.itemId === item.id && editCell.field === 'period'

    const input = activePeriodType === 'custom' ? (
      <CellInput
        value={editCell?.value ?? ''}
        onChange={updateValue}
        onSave={saveCellEdit}
        onCancel={cancelCellEdit}
      />
    ) : (
      <Select
        data={periodOptions(activePeriodType)}
        value={editCell?.value ?? null}
        onChange={async v => {
          setEditCell(null)
          await api.updateLineItem(item.id, { period: v ?? '' })
          refresh()
        }}
        onKeyDown={e => { if (e.key === 'Escape') cancelCellEdit() }}
        autoFocus
        size="xs"
        style={{ width: '100%' }}
        styles={{ input: { fontSize: 'var(--mantine-font-size-sm)', height: '100%' } }}
      />
    )

    return (
      <EditableCell isEditing={isEditing} onActivate={() => activateCell(item, 'period')} input={input}>
        {display}
      </EditableCell>
    )
  }

  function suggestCell(item: BudgetLineItem, field: EditableField, display: React.ReactNode, suggestions: string[]) {
    const isEditing = editCell?.itemId === item.id && editCell.field === field
    return (
      <EditableCell isEditing={isEditing} onActivate={() => activateCell(item, field)} input={
        <SuggestInput
          value={editCell?.value ?? ''}
          onChange={updateValue}
          suggestions={suggestions}
          onEnter={saveCellEdit}
          onBlur={saveCellEdit}
          autoFocus
          inputStyle={{
            height: '100%',
            border: 'none',
            outline: '2px solid var(--mantine-color-blue-5)',
            outlineOffset: '-2px',
            borderRadius: 'var(--mantine-radius-xs)',
            padding: '0 6px',
            boxSizing: 'border-box',
          }}
        />
      }>
        {display}
      </EditableCell>
    )
  }

  function cell(item: BudgetLineItem, field: EditableField, display: React.ReactNode, align: 'left' | 'right' = 'left') {
    const isEditing = editCell?.itemId === item.id && editCell.field === field
    return (
      <EditableCell
        isEditing={isEditing}
        onActivate={() => activateCell(item, field)}
        align={align}
        input={
          <CellInput
            value={editCell?.value ?? ''}
            onChange={updateValue}
            onSave={saveCellEdit}
            onCancel={cancelCellEdit}
            align={align}
          />
        }
      >
        {display}
      </EditableCell>
    )
  }

  // ── Derived column cells ─────────────────────────────────────────────────

  function renderDerivedCells(row: FilteredRow) {
    return activeColumns.map(col => {
      const value = col.compute(
        { budget: row.budget, actual: row.actual, variance: row.variance },
        allRowsContext,
      )
      return (
        <Table.Td key={col.id} style={{ textAlign: 'right' }}>
          <Text size="sm" c="blue">{col.format(value)}</Text>
        </Table.Td>
      )
    })
  }

  // ── Row rendering ────────────────────────────────────────────────────────

  function renderLeafRow(row: FilteredRow, item: BudgetLineItem) {
    const paddingLeft = isGrouped ? 8 + row.level * 16 : undefined
    const actions = (
      <Group gap={4} wrap="nowrap" style={{ opacity: 0 }} className="row-actions">
        <ActionIcon variant="subtle" size="sm" color="gray" onClick={() => onDuplicateItem(item)} title="Duplicate">
          <CopyPlus size={13} />
        </ActionIcon>
        <ActionIcon variant="subtle" size="sm" color="red" onClick={() => onDeleteItem(item.id)} title="Delete">
          <Trash2 size={13} />
        </ActionIcon>
      </Group>
    )

    return (
      <Table.Tr key={row.key}>
        <Table.Td style={paddingLeft ? { paddingLeft } : undefined}>
          {periodCell(item, row.period ? periodLabel(row.period, activePeriodType) : '—')}
        </Table.Td>
        <Table.Td fw={500}>{suggestCell(item, 'department', row.department, uniqueDepts)}</Table.Td>
        <Table.Td>{suggestCell(item, 'category', row.category, uniqueCats)}</Table.Td>
        <Table.Td style={{ textAlign: 'right' }}>
          {cell(item, 'budget_amount', fmt(row.budget), 'right')}
        </Table.Td>
        <Table.Td style={{ textAlign: 'right' }}>
          {cell(item, 'actual_amount', fmt(row.actual), 'right')}
        </Table.Td>
        <Table.Td style={{ textAlign: 'right' }}><VarianceBadge variance={row.variance} /></Table.Td>
        {renderDerivedCells(row)}
        <Table.Td c="dimmed" style={{ maxWidth: 160 }}>
          {row.notes
            ? cell(item, 'notes', <Text size="xs" truncate>{row.notes}</Text>)
            : <VariancePct pct={row.variance_pct} />}
        </Table.Td>
        <Table.Td>{actions}</Table.Td>
      </Table.Tr>
    )
  }

  // Build a set of group keys whose children should be hidden
  // For nested groups, collapsing a parent hides all descendants
  const hiddenRows = useMemo(() => {
    const hidden = new Set<string>()
    let skipUntilLevel: number | null = null

    for (const row of visibleRows) {
      if (skipUntilLevel !== null) {
        if (row.isGroupRow && row.level <= skipUntilLevel) {
          skipUntilLevel = null // We've exited the collapsed group
        } else {
          hidden.add(row.key)
          continue
        }
      }
      if (row.isGroupRow && !expandedGroups.has(row.key)) {
        skipUntilLevel = row.level
      }
    }
    return hidden
  }, [visibleRows, expandedGroups])

  function renderRow(row: FilteredRow) {
    if (hiddenRows.has(row.key)) return null

    if (row.isGroupRow) {
      return (
        <GroupHeaderRow
          key={row.key}
          row={row}
          periodType={activePeriodType}
          activeColumns={activeColumns}
          allRowsContext={allRowsContext}
          collapsed={!expandedGroups.has(row.key)}
          onToggle={() => toggleCollapse(row.key)}
        />
      )
    }
    const item = lineItems.find(i => String(i.id) === row.key)
    if (!item) return null
    return renderLeafRow(row, item)
  }

  // ── Table header ─────────────────────────────────────────────────────────
  // Always show all three dimension columns

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{PERIOD_TYPE_LABELS[activePeriodType]}</Table.Th>
          <Table.Th>Department</Table.Th>
          <Table.Th>Category</Table.Th>
          <Table.Th style={{ textAlign: 'right' }}>Budget</Table.Th>
          <Table.Th style={{ textAlign: 'right' }}>Actual</Table.Th>
          <Table.Th style={{ textAlign: 'right' }}>Variance</Table.Th>
          {activeColumns.map(col => (
            <Table.Th key={col.id} style={{ textAlign: 'right', color: 'var(--mantine-color-blue-6)' }}>
              {col.label}
            </Table.Th>
          ))}
          <Table.Th>Notes</Table.Th>
          <Table.Th style={{ width: 72 }}>
            <ColumnPicker
              activeColumns={activeSpec.columns ?? []}
              onToggle={(colId) => dispatch('toggleColumn', { column: colId })}
            />
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody key={(activeSpec.group_by ?? []).join(',') || 'flat'}>
        {visibleRows.map(renderRow)}
        {addingRow && onNewRowChange && onNewRowSave && onNewRowCancel && (
          <Table.Tr style={{ background: 'var(--mantine-color-blue-0)' }}>
            <EditRow
              values={newRow ?? {}}
              onChange={onNewRowChange}
              onSave={onNewRowSave}
              onCancel={onNewRowCancel}
              deptSuggestions={uniqueDepts}
              catSuggestions={uniqueCats}
              periodType={activePeriodType}
            />
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  )
}
