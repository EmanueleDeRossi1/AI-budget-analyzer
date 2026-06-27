'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Group, Text, Button, Badge, ActionIcon,
  Table, ScrollArea, Box, Paper, Flex,
} from '@mantine/core'
import { Pencil, Trash2, Plus, CopyPlus } from 'lucide-react'
import { api, BudgetScenario, BudgetLineItem } from '@/lib/api'
import { FilterSpec, FilteredRow, GroupByField, applyFilterSpec } from '@/lib/filterSpec'
import { PeriodType, PERIOD_TYPE_LABELS, periodLabel } from '@/lib/periods'
import { RuntimeProvider } from './RuntimeProvider'
import { Thread } from '@/components/assistant-ui/thread'
import ScenarioCombobox from '@/components/ScenarioCombobox'
import StatsBar from '@/components/StatsBar'
import FilterBar from '@/components/FilterBar'
import NewScenarioModal from '@/components/NewScenarioModal'
import EditRow from '@/components/EditRow'

function fmt(value: number) {
  return Number(value).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  })
}

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

// ── Row actions ───────────────────────────────────────────────────────────────

function RowActions({ onEdit, onDuplicate, onDelete }: {
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <Group gap={4} wrap="nowrap" style={{ opacity: 0 }} className="row-actions">
      <ActionIcon variant="subtle" size="sm" onClick={onEdit} title="Edit"><Pencil size={13} /></ActionIcon>
      <ActionIcon variant="subtle" size="sm" color="gray" onClick={onDuplicate} title="Duplicate"><CopyPlus size={13} /></ActionIcon>
      <ActionIcon variant="subtle" size="sm" color="red" onClick={onDelete} title="Delete"><Trash2 size={13} /></ActionIcon>
    </Group>
  )
}

// ── Table rows ────────────────────────────────────────────────────────────────

function GroupHeaderRow({ row, periodType }: { row: FilteredRow; periodType: PeriodType }) {
  const paddingLeft = 8 + row.level * 16
  const bg = row.level === 0 ? 'var(--mantine-color-gray-1)' : 'var(--mantine-color-gray-0)'
  const displayValue = row.groupField === 'period'
    ? periodLabel(row.groupValue ?? '', periodType)
    : row.groupValue

  return (
    <Table.Tr style={{ background: bg }}>
      <Table.Td colSpan={3} style={{ paddingLeft, paddingTop: 8, paddingBottom: 8 }}>
        <Group gap={6}>
          <Text size="sm" fw={row.level === 0 ? 700 : 600}>{displayValue}</Text>
          <Text size="xs" c="dimmed">({row.item_count} {row.item_count === 1 ? 'item' : 'items'})</Text>
        </Group>
      </Table.Td>
      <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={600}>{fmt(row.budget)}</Text></Table.Td>
      <Table.Td style={{ textAlign: 'right' }}><Text size="sm" fw={600}>{fmt(row.actual)}</Text></Table.Td>
      <Table.Td style={{ textAlign: 'right' }}><VarianceBadge variance={row.variance} /></Table.Td>
      <Table.Td><VariancePct pct={row.variance_pct} /></Table.Td>
      <Table.Td />
    </Table.Tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [scenarios, setScenarios] = useState<BudgetScenario[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [lineItems, setLineItems] = useState<BudgetLineItem[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<Partial<BudgetLineItem>>({})
  const [addingRow, setAddingRow] = useState(false)
  const [newRow, setNewRow] = useState<Partial<BudgetLineItem>>({})
  const [showModal, setShowModal] = useState(false)
  const [filterSpec, setFilterSpec] = useState<FilterSpec>({})

  useEffect(() => {
    api.getScenarios().then(data => {
      setScenarios(data)
      if (data.length > 0) setSelectedId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (selectedId) {
      setFilterSpec({})
      api.getLineItems(selectedId).then(setLineItems)
    }
  }, [selectedId])

  const refresh = useCallback(() => {
    if (selectedId) api.getLineItems(selectedId).then(setLineItems)
  }, [selectedId])

  const saveEdit = async () => {
    if (!editingId) return
    await api.updateLineItem(editingId, editValues)
    setEditingId(null)
    refresh()
  }

  const deleteItem = async (id: number) => {
    await api.deleteLineItem(id)
    refresh()
  }

  const duplicateItem = async (item: BudgetLineItem) => {
    if (!selectedId) return
    await api.createLineItem({
      scenario: selectedId,
      period: item.period,
      department: item.department,
      category: item.category,
      budget_amount: item.budget_amount,
      actual_amount: item.actual_amount,
      notes: item.notes,
    })
    refresh()
  }

  const saveNewRow = async () => {
    if (!selectedId) return
    await api.createLineItem({ ...newRow, scenario: selectedId })
    setAddingRow(false)
    setNewRow({})
    refresh()
  }

  const selectedScenario = scenarios.find(s => s.id === selectedId)
  const activePeriodType: PeriodType = selectedScenario?.period_type ?? 'custom'
  const activeSpec: FilterSpec = { ...filterSpec, period_type: activePeriodType }
  const visibleRows = applyFilterSpec(lineItems, activeSpec)

  const uniqueDepts = Array.from(new Set(lineItems.map(i => i.department)))
  const uniqueCats  = Array.from(new Set(lineItems.map(i => i.category)))

  function renderRow(row: FilteredRow) {
    if (row.isGroupRow) {
      return <GroupHeaderRow key={row.key} row={row} periodType={activePeriodType} />
    }

    const originalItem = lineItems.find(i => String(i.id) === row.key)
    const isGrouped = (activeSpec.group_by ?? []).length > 0

    if (originalItem && editingId === originalItem.id) {
      return (
        <Table.Tr key={row.key}>
          <EditRow
            values={editValues}
            onChange={setEditValues}
            onSave={saveEdit}
            onCancel={() => setEditingId(null)}
            deptSuggestions={uniqueDepts}
            catSuggestions={uniqueCats}
            periodType={activePeriodType}
          />
        </Table.Tr>
      )
    }

    const actions = originalItem ? (
      <RowActions
        onEdit={() => { setEditingId(originalItem.id); setEditValues(originalItem) }}
        onDuplicate={() => duplicateItem(originalItem)}
        onDelete={() => deleteItem(originalItem.id)}
      />
    ) : null

    if (isGrouped) {
      const groupBy = activeSpec.group_by ?? []
      const allDims: GroupByField[] = ['period', 'department', 'category']
      const remaining = allDims.filter(d => !groupBy.includes(d))
      const label = remaining
        .map(d => {
          const v = row[d] ?? ''
          return d === 'period' ? periodLabel(v, activePeriodType) : v
        })
        .filter(Boolean)
        .join(' · ') || '—'
      const paddingLeft = 8 + row.level * 16

      return (
        <Table.Tr key={row.key}>
          <Table.Td colSpan={3} style={{ paddingLeft, color: 'var(--mantine-color-gray-7)' }}>
            <Text size="sm">{label}</Text>
          </Table.Td>
          <Table.Td style={{ textAlign: 'right' }}>{fmt(row.budget)}</Table.Td>
          <Table.Td style={{ textAlign: 'right' }}>{fmt(row.actual)}</Table.Td>
          <Table.Td style={{ textAlign: 'right' }}><VarianceBadge variance={row.variance} /></Table.Td>
          <Table.Td c="dimmed" style={{ maxWidth: 160 }}>
            {row.notes ? <Text size="xs" truncate>{row.notes}</Text> : <VariancePct pct={row.variance_pct} />}
          </Table.Td>
          <Table.Td>{actions}</Table.Td>
        </Table.Tr>
      )
    }

    return (
      <Table.Tr key={row.key}>
        <Table.Td c="dimmed">{row.period ? periodLabel(row.period, activePeriodType) : '—'}</Table.Td>
        <Table.Td fw={500}>{row.department}</Table.Td>
        <Table.Td c="dimmed">{row.category}</Table.Td>
        <Table.Td style={{ textAlign: 'right' }}>{fmt(row.budget)}</Table.Td>
        <Table.Td style={{ textAlign: 'right' }}>{fmt(row.actual)}</Table.Td>
        <Table.Td style={{ textAlign: 'right' }}><VarianceBadge variance={row.variance} /></Table.Td>
        <Table.Td c="dimmed" style={{ maxWidth: 160 }}>
          {row.notes ? <Text size="xs" truncate>{row.notes}</Text> : <VariancePct pct={row.variance_pct} />}
        </Table.Td>
        <Table.Td>{actions}</Table.Td>
      </Table.Tr>
    )
  }

  function renderTableHeader() {
    const groupBy = activeSpec.group_by ?? []
    const dimHeader = groupBy.length === 0 ? (
      <>
        <Table.Th>{PERIOD_TYPE_LABELS[activePeriodType]}</Table.Th>
        <Table.Th>Department</Table.Th>
        <Table.Th>Category</Table.Th>
      </>
    ) : (
      <Table.Th colSpan={3}>
        {groupBy
          .map(f => f === 'period' ? PERIOD_TYPE_LABELS[activePeriodType] : f.charAt(0).toUpperCase() + f.slice(1))
          .join(' / ')}
      </Table.Th>
    )
    return (
      <Table.Thead>
        <Table.Tr>
          {dimHeader}
          <Table.Th style={{ textAlign: 'right' }}>Budget</Table.Th>
          <Table.Th style={{ textAlign: 'right' }}>Actual</Table.Th>
          <Table.Th style={{ textAlign: 'right' }}>Variance</Table.Th>
          <Table.Th>Notes</Table.Th>
          <Table.Th style={{ width: 104 }} />
        </Table.Tr>
      </Table.Thead>
    )
  }

  return (
    <RuntimeProvider scenarioId={selectedId} onFilterSpec={setFilterSpec}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--mantine-color-gray-0)' }}>

        {/* Header */}
        <Box style={{ flexShrink: 0, borderBottom: '1px solid var(--mantine-color-gray-3)', background: 'var(--mantine-color-white)', height: 56 }}>
          <Group h="100%" px="md" gap="md">
            <Text fw={700} size="md" style={{ letterSpacing: -0.5 }}>◈ BudgetAI</Text>
            <ScenarioCombobox
              scenarios={scenarios}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onNewScenario={() => setShowModal(true)}
            />
            <Button ml="auto" size="sm" leftSection={<Plus size={14} />} onClick={() => setShowModal(true)}>
              New Scenario
            </Button>
          </Group>
        </Box>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* Left: table area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {lineItems.length > 0 && <StatsBar items={lineItems} />}
            {lineItems.length > 0 && (
              <FilterBar items={lineItems} spec={filterSpec} onChange={setFilterSpec} periodType={activePeriodType} />
            )}

            <ScrollArea style={{ flex: 1 }} p="md">
              {lineItems.length === 0 ? (
                <Flex direction="column" align="center" justify="center" h={400} gap="sm">
                  <Text size="xl">📊</Text>
                  <Text fw={500}>No line items yet</Text>
                  <Text size="sm" c="dimmed" ta="center" maw={280}>
                    Add budget line items to start analyzing this scenario with the AI assistant.
                  </Text>
                  <Button size="sm" leftSection={<Plus size={14} />} onClick={() => setAddingRow(true)}>
                    Add first item
                  </Button>
                </Flex>
              ) : (
                <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                  <Table striped highlightOnHover>
                    {renderTableHeader()}
                    <Table.Tbody>
                      {visibleRows.map(renderRow)}
                      {addingRow && (
                        <Table.Tr style={{ background: 'var(--mantine-color-blue-0)' }}>
                          <EditRow
                            values={newRow}
                            onChange={setNewRow}
                            onSave={saveNewRow}
                            onCancel={() => { setAddingRow(false); setNewRow({}) }}
                            deptSuggestions={uniqueDepts}
                            catSuggestions={uniqueCats}
                            periodType={activePeriodType}
                          />
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                  {!addingRow && (
                    <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                      <Button variant="subtle" size="xs" color="gray" leftSection={<Plus size={13} />} onClick={() => setAddingRow(true)}>
                        Add line item
                      </Button>
                    </Box>
                  )}
                </Paper>
              )}
            </ScrollArea>
          </div>

          {/* Right: chat */}
          <div style={{
            width: 384, flexShrink: 0, display: 'flex', flexDirection: 'column',
            minHeight: 0, borderLeft: '1px solid var(--mantine-color-gray-3)',
            background: 'var(--mantine-color-white)',
          }}>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <Thread />
            </div>
          </div>
        </div>
      </div>

      <NewScenarioModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={scenario => { setScenarios(prev => [...prev, scenario]); setSelectedId(scenario.id); setShowModal(false) }}
      />
    </RuntimeProvider>
  )
}
