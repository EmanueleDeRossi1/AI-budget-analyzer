'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Group, Text, Button, Box, Paper, Flex, ScrollArea, Alert,
} from '@mantine/core'
import { Plus, AlertCircle } from 'lucide-react'
import { api, BudgetScenario, BudgetLineItem } from '@/lib/api'
import { FilterSpec, applyFilterSpec } from '@/lib/filterSpec'
import { normalizeAmount } from '@/lib/utils'
import { PeriodType } from '@/lib/periods'
import { useOperations } from '@/lib/operations'
import { RuntimeProvider } from './RuntimeProvider'
import { Thread } from '@/components/assistant-ui/thread'
import ScenarioCombobox from '@/components/ScenarioCombobox'
import FilterBar from '@/components/FilterBar'
import NewScenarioModal from '@/components/NewScenarioModal'
import BudgetTable from '@/components/BudgetTable'
import ChartStrip from '@/components/ChartStrip'

export default function Home() {
  const [scenarios, setScenarios] = useState<BudgetScenario[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [lineItems, setLineItems] = useState<BudgetLineItem[]>([])
  const [addingRow, setAddingRow] = useState(false)
  const [newRow, setNewRow] = useState<Partial<BudgetLineItem>>({})
  const [showModal, setShowModal] = useState(false)
  const [filterSpec, setFilterSpec] = useState<FilterSpec>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getScenarios()
      .then(data => {
        setScenarios(data)
        if (data.length > 0) {
          const saved = localStorage.getItem('selectedScenarioId')
          const savedId = saved ? parseInt(saved, 10) : null
          const match = savedId && data.find(s => s.id === savedId)
          setSelectedId(match ? savedId : data[0].id)
        }
      })
      .catch(() => setError('Failed to load scenarios. Is the backend running?'))
  }, [])

  useEffect(() => {
    if (selectedId) {
      localStorage.setItem('selectedScenarioId', String(selectedId))
      setFilterSpec({})
      api.getLineItems(selectedId)
        .then(setLineItems)
        .catch(() => setError('Failed to load line items.'))
    }
  }, [selectedId])

  const refresh = useCallback(() => {
    if (selectedId) {
      api.getLineItems(selectedId)
        .then(setLineItems)
        .catch(() => setError('Failed to refresh line items.'))
    }
  }, [selectedId])

  // ── Row-level handlers ──────────────────────────────────────────────────

  const deleteItem = async (id: number) => {
    try {
      await api.deleteLineItem(id)
      refresh()
    } catch {
      setError('Failed to delete item.')
    }
  }

  const duplicateItem = async (item: BudgetLineItem) => {
    if (!selectedId) return
    try {
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
    } catch {
      setError('Failed to duplicate item.')
    }
  }

  const saveNewRow = async () => {
    if (!selectedId) return
    const normalized = {
      ...newRow,
      budget_amount: normalizeAmount(newRow.budget_amount ?? ''),
      actual_amount: normalizeAmount(newRow.actual_amount ?? ''),
    }
    try {
      await api.createLineItem({ ...normalized, scenario: selectedId })
      setAddingRow(false)
      setNewRow({})
      refresh()
    } catch {
      setError('Failed to save new item.')
    }
  }

  // ── Operations dispatch ──────────────────────────────────────────────────

  const { dispatch } = useOperations({
    lineItems,
    filterSpec,
    scenarioId: selectedId,
    refresh,
    setFilterSpec,
  })

  // ── Derived state ───────────────────────────────────────────────────────

  const selectedScenario = scenarios.find(s => s.id === selectedId)
  const activePeriodType: PeriodType = selectedScenario?.period_type ?? 'year'
  const activeSpec: FilterSpec = { ...filterSpec, period_type: activePeriodType }
  const visibleRows = applyFilterSpec(lineItems, activeSpec)

  return (
    <RuntimeProvider
      scenarioId={selectedId}
      dispatch={dispatch}
    >
      <div style={{ height: '100vh', display: 'flex', background: 'var(--mantine-color-gray-0)' }}>

        {/* Left column: header + table */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

          {error && (
            <Alert
              icon={<AlertCircle size={16} />}
              color="red"
              withCloseButton
              onClose={() => setError(null)}
              style={{ borderRadius: 0, flexShrink: 0 }}
            >
              {error}
            </Alert>
          )}

          {/* Header */}
          <Box style={{ flexShrink: 0, background: 'var(--mantine-color-white)', height: 56 }}>
            <Group h="100%" px="md" gap="md">
              <Text fw={700} size="md" style={{ letterSpacing: -0.5 }}>◈ BudgetAI</Text>
              <ScenarioCombobox
                scenarios={scenarios}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onNewScenario={() => setShowModal(true)}
              />
            </Group>
          </Box>

          {/* Table area */}
          {lineItems.length > 0 && (
            <ChartStrip lineItems={lineItems} filterSpec={filterSpec} periodType={activePeriodType} />
          )}
          {lineItems.length > 0 && (
            <FilterBar items={lineItems} spec={filterSpec} dispatch={dispatch} periodType={activePeriodType} />
          )}

          <ScrollArea style={{ flex: 1 }} p="md">
            {lineItems.length === 0 && !addingRow ? (
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
                <BudgetTable
                  lineItems={lineItems}
                  visibleRows={visibleRows}
                  activeSpec={activeSpec}
                  activePeriodType={activePeriodType}
                  refresh={refresh}
                  selectedId={selectedId}
                  onDeleteItem={deleteItem}
                  onDuplicateItem={duplicateItem}
                  dispatch={dispatch}
                  addingRow={addingRow}
                  newRow={newRow}
                  onNewRowChange={setNewRow}
                  onNewRowSave={saveNewRow}
                  onNewRowCancel={() => { setAddingRow(false); setNewRow({}) }}
                />
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

        {/* Right column: chat — full height so borderLeft spans top to bottom */}
        <div style={{
          width: 384, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid var(--mantine-color-gray-3)',
          background: 'var(--mantine-color-white)',
        }}>
          <Thread />
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
