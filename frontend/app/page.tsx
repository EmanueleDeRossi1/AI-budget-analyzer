'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Group, Text, Button, Box, Paper, Flex, ScrollArea,
} from '@mantine/core'
import { Plus } from 'lucide-react'
import { api, BudgetScenario, BudgetLineItem } from '@/lib/api'
import { FilterSpec, applyFilterSpec } from '@/lib/filterSpec'
import { PeriodType } from '@/lib/periods'
import { useOperations } from '@/lib/operations'
import { RuntimeProvider } from './RuntimeProvider'
import { Thread } from '@/components/assistant-ui/thread'
import ScenarioCombobox from '@/components/ScenarioCombobox'
import StatsBar from '@/components/StatsBar'
import FilterBar from '@/components/FilterBar'
import NewScenarioModal from '@/components/NewScenarioModal'
import BudgetTable from '@/components/BudgetTable'

export default function Home() {
  const [scenarios, setScenarios] = useState<BudgetScenario[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [lineItems, setLineItems] = useState<BudgetLineItem[]>([])
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

  // ── Row-level handlers ──────────────────────────────────────────────────

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
  const activePeriodType: PeriodType = selectedScenario?.period_type ?? 'custom'
  const activeSpec: FilterSpec = { ...filterSpec, period_type: activePeriodType }
  const visibleRows = applyFilterSpec(lineItems, activeSpec)

  return (
    <RuntimeProvider
      scenarioId={selectedId}
      dispatch={dispatch}
    >
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
