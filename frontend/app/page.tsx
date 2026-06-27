'use client'

import { useEffect, useRef, useState, useCallback, forwardRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Group, Stack, Text, Button, ActionIcon,
  TextInput, SimpleGrid, Paper, Badge,
  Modal, Table, Combobox, useCombobox, InputBase,
  ScrollArea, Box, Flex, Divider, MultiSelect, Select,
} from '@mantine/core'
import { BarChart } from '@mantine/charts'
import {
  Pencil, Trash2, Plus, X, Check, CopyPlus,
  ChevronDown, Search, TrendingUp, TrendingDown,
} from 'lucide-react'
import { api, BudgetScenario, BudgetLineItem } from '@/lib/api'
import { FilterSpec, FilteredRow, GroupByField, applyFilterSpec, isEmptySpec, toggleGroupBy } from '@/lib/filterSpec'
import { PeriodType, PERIOD_TYPE_LABELS, periodOptions, periodLabel } from '@/lib/periods'
import { RuntimeProvider } from './RuntimeProvider'
import { Thread } from '@/components/assistant-ui/thread'

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(value: number | string) {
  return Number(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

function computeStats(items: BudgetLineItem[]) {
  const totalBudget = items.reduce((s, i) => s + Number(i.budget_amount), 0)
  const totalActual = items.reduce((s, i) => s + Number(i.actual_amount), 0)
  return { totalBudget, totalActual }
}

// ── Demo seed data ────────────────────────────────────────────────────────────

function buildDemoItems(periodType: PeriodType) {
  // Pick two sensible demo periods based on the period type
  const opts = periodOptions(periodType)
  const p1 = opts[0]?.value ?? ''
  const p2 = opts[1]?.value ?? opts[0]?.value ?? ''
  return [
    { period: p1, department: 'Marketing',   category: 'Paid Ads',   budget_amount: '50000', actual_amount: '65000', notes: '' },
    { period: p1, department: 'Sales',       category: 'Travel',      budget_amount: '20000', actual_amount: '27500', notes: '' },
    { period: p1, department: 'Engineering', category: 'Tools',       budget_amount: '30000', actual_amount: '28500', notes: '' },
    { period: p2, department: 'HR',          category: 'Recruiting',  budget_amount: '45000', actual_amount: '41200', notes: '' },
    { period: p2, department: 'Operations',  category: 'Contractors', budget_amount: '60000', actual_amount: '71000', notes: '' },
  ]
}

// ── SuggestInput (portal dropdown, arrow nav, Enter chaining) ─────────────────

const SuggestInput = forwardRef<HTMLInputElement, {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
  autoFocus?: boolean
  onEnter?: () => void
}>(({ value, onChange, suggestions, placeholder, autoFocus, onEnter }, forwardedRef) => {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
  const showAddNew = value.trim() !== '' && !suggestions.some(s => s.toLowerCase() === value.trim().toLowerCase())
  const totalOptions = filtered.length + (showAddNew ? 1 : 0)
  const hasOptions = totalOptions > 0

  function updateCoords() {
    const el = containerRef.current?.querySelector('input')
    if (el) {
      const rect = el.getBoundingClientRect()
      setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }

  function selectOption(idx: number) {
    if (showAddNew && idx === 0) onChange(value.trim())
    else onChange(filtered[showAddNew ? idx - 1 : idx])
    setOpen(false)
    setHighlighted(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !hasOptions) {
      if (e.key === 'Enter') { e.preventDefault(); onEnter?.() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => { const next = (h + 1) % totalOptions; scrollIntoView(next); return next })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => { const next = (h - 1 + totalOptions) % totalOptions; scrollIntoView(next); return next })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted >= 0) selectOption(highlighted)
      else if (filtered.length > 0) selectOption(0)
      else { onChange(value.trim()); setOpen(false) }
      onEnter?.()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function scrollIntoView(idx: number) {
    if (!listRef.current) return
    const item = listRef.current.children[idx] as HTMLElement
    item?.scrollIntoView({ block: 'nearest' })
  }

  useEffect(() => { setHighlighted(-1) }, [value])

  useLayoutEffect(() => {
    if (autoFocus) { updateCoords(); setOpen(true) }
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef}>
      <input
        ref={forwardedRef}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); updateCoords() }}
        onFocus={() => { updateCoords(); setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          display: 'flex',
          height: 36,
          width: '100%',
          borderRadius: 'var(--mantine-radius-sm)',
          border: '1px solid var(--mantine-color-gray-4)',
          background: 'var(--mantine-color-white)',
          padding: '0 12px',
          fontSize: 'var(--mantine-font-size-sm)',
          color: 'var(--mantine-color-text)',
          outline: 'none',
          transition: 'border-color 0.1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--mantine-color-gray-5)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--mantine-color-gray-4)')}
        onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--mantine-color-blue-5)')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--mantine-color-gray-4)')}
      />
      {open && hasOptions && createPortal(
        <div style={{
          position: 'fixed', top: coords.top, left: coords.left,
          width: Math.max(coords.width, 160), zIndex: 9999,
          background: 'var(--mantine-color-white)',
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-sm)',
          boxShadow: 'var(--mantine-shadow-md)',
          overflow: 'hidden',
        }}>
          <div ref={listRef} style={{ maxHeight: 176, overflowY: 'auto' }}>
            {showAddNew && (
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); selectOption(0) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 12px',
                  fontSize: 'var(--mantine-font-size-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: highlighted === 0 ? 'var(--mantine-color-blue-0)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                }}
              >
                <span>{value.trim()}</span>
                <Badge size="xs" variant="light" color="blue" ml="xs">new</Badge>
              </button>
            )}
            {showAddNew && filtered.length > 0 && <Divider />}
            {filtered.map((s, i) => {
              const idx = showAddNew ? i + 1 : i
              return (
                <button
                  key={s}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selectOption(idx) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 12px',
                    fontSize: 'var(--mantine-font-size-sm)',
                    background: idx === highlighted ? 'var(--mantine-color-blue-0)' : 'transparent',
                    color: idx === highlighted ? 'var(--mantine-color-blue-7)' : 'inherit',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
})
SuggestInput.displayName = 'SuggestInput'

// ── Variance badge ────────────────────────────────────────────────────────────

function VarianceBadge({ variance }: { variance: number }) {
  if (variance > 0) return <Badge color="red" variant="light">+{fmt(variance)}</Badge>
  return <Badge color="green" variant="light">{fmt(variance)}</Badge>
}

// ── Scenario combobox ─────────────────────────────────────────────────────────

function ScenarioCombobox({
  scenarios, selectedId, onSelect, onNewScenario,
}: {
  scenarios: BudgetScenario[]
  selectedId: number | null
  onSelect: (id: number) => void
  onNewScenario: () => void
}) {
  const [search, setSearch] = useState('')
  const combobox = useCombobox({
    onDropdownClose: () => { combobox.resetSelectedOption(); setSearch('') },
  })
  const selected = scenarios.find(s => s.id === selectedId)
  const filtered = scenarios.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        if (val === '__new__') { onNewScenario(); combobox.closeDropdown(); return }
        onSelect(Number(val))
        combobox.closeDropdown()
      }}
      width={260}
    >
      <Combobox.Target>
        <InputBase
          component="button"
          type="button"
          pointer
          rightSection={<ChevronDown size={14} />}
          rightSectionPointerEvents="none"
          onClick={() => combobox.toggleDropdown()}
          style={{ minWidth: 200 }}
        >
          {selected ? (
            <Group gap="xs" wrap="nowrap">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mantine-color-green-6)', flexShrink: 0 }} />
              <Text size="sm" fw={500} style={{ lineHeight: 1 }}>{selected.name}</Text>
            </Group>
          ) : (
            <Text size="sm" c="dimmed">Select scenario</Text>
          )}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search scenarios…"
          leftSection={<Search size={13} />}
        />
        <Combobox.Options>
          <ScrollArea.Autosize mah={220}>
            {filtered.length === 0 ? (
              <Combobox.Empty>No scenarios found</Combobox.Empty>
            ) : (
              filtered.map(s => (
                <Combobox.Option key={s.id} value={String(s.id)} active={s.id === selectedId}>
                  <Group gap="xs" wrap="nowrap">
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: s.id === selectedId ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-gray-4)',
                    }} />
                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={s.id === selectedId ? 600 : 400} truncate>{s.name}</Text>
                    </Stack>
                    {s.id === selectedId && <Check size={14} color="var(--mantine-color-green-6)" />}
                  </Group>
                </Combobox.Option>
              ))
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
        <Combobox.Footer>
          <Combobox.Option value="__new__">
            <Group gap="xs">
              <Plus size={14} />
              <Text size="sm" fw={500} c="blue">New Scenario</Text>
            </Group>
          </Combobox.Option>
        </Combobox.Footer>
      </Combobox.Dropdown>
    </Combobox>
  )
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ items }: { items: BudgetLineItem[] }) {
  const { totalBudget, totalActual } = computeStats(items)
  const delta = totalActual - totalBudget
  const over = delta > 0

  const chartData = Array.from(new Set(items.map(i => i.department))).map(dept => {
    const deptItems = items.filter(i => i.department === dept)
    return {
      department: dept,
      Budget: deptItems.reduce((s, i) => s + Number(i.budget_amount), 0),
      Actual: deptItems.reduce((s, i) => s + Number(i.actual_amount), 0),
    }
  })

  return (
    <Box style={{ borderBottom: '1px solid var(--mantine-color-gray-3)', background: 'var(--mantine-color-white)', flexShrink: 0 }}>
      <SimpleGrid cols={2} spacing="sm" p="md" pb={0}>
        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>Total Budget</Text>
          <Text size="xl" fw={700} mt={4}>{fmt(totalBudget)}</Text>
          <Text size="xs" c="dimmed" mt={2}>{items.length} line items</Text>
        </Paper>

        <Paper withBorder p="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>Actual Spend</Text>
          <Text size="xl" fw={700} mt={4}>{fmt(totalActual)}</Text>
          <Group gap={4} mt={2}>
            {over ? <TrendingUp size={12} color="var(--mantine-color-red-6)" /> : <TrendingDown size={12} color="var(--mantine-color-green-6)" />}
            <Text size="xs" c={over ? 'red' : 'green'}>{over ? '+' : ''}{fmt(delta)} vs plan</Text>
          </Group>
        </Paper>
      </SimpleGrid>

      {chartData.length > 1 && (
        <Box px="md" pt="sm" pb="md">
          <BarChart
            h={120}
            data={chartData}
            dataKey="department"
            series={[
              { name: 'Budget', color: 'blue.4' },
              { name: 'Actual', color: 'red.4' },
            ]}
            tickLine="none"
            gridAxis="none"
            withTooltip
            withLegend={false}
            barProps={{ radius: 2 }}
          />
        </Box>
      )}
    </Box>
  )
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({
  items, spec, onChange, periodType,
}: {
  items: BudgetLineItem[]
  spec: FilterSpec
  onChange: (s: FilterSpec) => void
  periodType: PeriodType
}) {
  const rawPeriods = Array.from(new Set(items.map(i => i.period).filter(Boolean)))
  // For the MultiSelect, use display labels but keep stored values as the actual values
  const periodSelectData = rawPeriods.map(v => ({ value: v, label: periodLabel(v, periodType) }))
  const depts   = Array.from(new Set(items.map(i => i.department))).sort()
  const cats    = Array.from(new Set(items.map(i => i.category))).sort()
  const empty   = isEmptySpec(spec)
  const groupBy = spec.group_by ?? []

  const ALL_GROUP_OPTS: { value: GroupByField; label: string }[] = [
    { value: 'period',     label: 'Period' },
    { value: 'department', label: 'Dept' },
    { value: 'category',   label: 'Category' },
  ]

  const SORT_OPTS: { value: FilterSpec['sort_by']; label: string }[] = [
    { value: 'variance', label: 'Variance' },
    { value: 'budget',   label: 'Budget' },
    { value: 'actual',   label: 'Actual' },
  ]

  function setSortBy(s: FilterSpec['sort_by']) {
    if ((spec.sort_by ?? 'variance') === s) {
      onChange({ ...spec, sort_dir: spec.sort_dir === 'asc' ? 'desc' : 'asc' })
    } else {
      onChange({ ...spec, sort_by: s, sort_dir: 'desc' })
    }
  }

  const segStyle = (active: boolean): React.CSSProperties => ({
    border: '1px solid',
    borderColor: active ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-gray-4)',
    background: active ? 'var(--mantine-color-blue-0)' : 'transparent',
    color: active ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-gray-6)',
    borderRadius: 'var(--mantine-radius-sm)',
    padding: '3px 10px',
    fontSize: 'var(--mantine-font-size-xs)',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    lineHeight: 1.5,
  })

  const activePillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: '1px solid var(--mantine-color-blue-4)',
    background: 'var(--mantine-color-blue-0)',
    color: 'var(--mantine-color-blue-7)',
    borderRadius: 'var(--mantine-radius-sm)',
    padding: '3px 6px 3px 8px',
    fontSize: 'var(--mantine-font-size-xs)',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    lineHeight: 1.5,
  }

  const xBtnStyle: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: 'var(--mantine-color-blue-5)',
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: 12,
    lineHeight: 1,
    opacity: 0.7,
  }

  return (
    <Box
      px="md" py="xs"
      style={{
        borderBottom: '1px solid var(--mantine-color-gray-3)',
        background: 'var(--mantine-color-white)',
        flexShrink: 0,
      }}
    >
      <Group gap="sm" wrap="nowrap" align="center">

        {/* Period MultiSelect (only show if there are periods in the data) */}
        {periodSelectData.length > 0 && (
          <MultiSelect
            data={periodSelectData}
            value={spec.periods ?? []}
            onChange={v => onChange({ ...spec, periods: v.length ? v : undefined })}
            placeholder={`All ${PERIOD_TYPE_LABELS[periodType].toLowerCase()}s`}
            size="xs"
            clearable
            searchable
            style={{ minWidth: 120, maxWidth: 180 }}
            styles={{ input: { fontSize: 'var(--mantine-font-size-xs)' } }}
          />
        )}

        {/* Dept MultiSelect */}
        <MultiSelect
          data={depts}
          value={spec.departments ?? []}
          onChange={v => onChange({ ...spec, departments: v.length ? v : undefined })}
          placeholder="All departments"
          size="xs"
          clearable
          searchable
          style={{ minWidth: 150, maxWidth: 220 }}
          styles={{ input: { fontSize: 'var(--mantine-font-size-xs)' } }}
        />

        {/* Category MultiSelect */}
        <MultiSelect
          data={cats}
          value={spec.categories ?? []}
          onChange={v => onChange({ ...spec, categories: v.length ? v : undefined })}
          placeholder="All categories"
          size="xs"
          clearable
          searchable
          style={{ minWidth: 150, maxWidth: 220 }}
          styles={{ input: { fontSize: 'var(--mantine-font-size-xs)' } }}
        />

        <Divider orientation="vertical" h={20} />

        {/* Group by — ordered pills */}
        <Group gap={4} wrap="nowrap" align="center">
          <Text size="xs" c="dimmed" fw={500} style={{ whiteSpace: 'nowrap' }}>Group by</Text>

          {/* Active dimensions in order */}
          {groupBy.map((field, idx) => (
            <span key={field} style={activePillStyle}>
              {groupBy.length > 1 && (
                <span style={{ opacity: 0.5, fontSize: 10, marginRight: 2 }}>{idx + 1}</span>
              )}
              {ALL_GROUP_OPTS.find(o => o.value === field)?.label}
              <button style={xBtnStyle} onClick={() => onChange(toggleGroupBy(spec, field))}>×</button>
            </span>
          ))}

          {/* Available (not yet active) dimensions */}
          {ALL_GROUP_OPTS.filter(o => !groupBy.includes(o.value)).map(o => (
            <button
              key={o.value}
              style={segStyle(false)}
              onClick={() => onChange(toggleGroupBy(spec, o.value))}
            >
              + {o.label}
            </button>
          ))}
        </Group>

        <Divider orientation="vertical" h={20} />

        {/* Sort */}
        <Group gap={4} wrap="nowrap">
          <Text size="xs" c="dimmed" fw={500} style={{ whiteSpace: 'nowrap' }}>Sort</Text>
          {SORT_OPTS.map(o => {
            const active = (spec.sort_by ?? 'variance') === o.value
            const dir = spec.sort_dir ?? 'desc'
            return (
              <button key={o.value!} style={segStyle(active)} onClick={() => setSortBy(o.value)}>
                {o.label}{active ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}
              </button>
            )
          })}
        </Group>

        {/* Clear */}
        {!empty && (
          <>
            <Divider orientation="vertical" h={20} />
            <Button size="xs" variant="subtle" color="gray" leftSection={<X size={11} />} onClick={() => onChange({})}>
              Clear
            </Button>
          </>
        )}
      </Group>
    </Box>
  )
}

// ── New Scenario Modal ────────────────────────────────────────────────────────

type Template = 'blank' | 'demo' | 'csv' | 'copy'

function NewScenarioModal({
  open, onClose, onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (scenario: BudgetScenario) => void
}) {
  const [name, setName] = useState('')
  const [periodType, setPeriodType] = useState<PeriodType>('quarter')
  const [description, setDescription] = useState('')
  const [template, setTemplate] = useState<Template>('blank')
  const [loading, setLoading] = useState(false)

  function reset() {
    setName(''); setPeriodType('quarter'); setDescription(''); setTemplate('blank'); setLoading(false)
  }

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    try {
      const scenario = await api.createScenario({ name: name.trim(), period_type: periodType, description })
      if (template === 'demo') {
        await Promise.all(buildDemoItems(periodType).map(item => api.createLineItem({ ...item, scenario: scenario.id })))
      }
      onCreated(scenario)
      reset()
    } catch {
      setLoading(false)
    }
  }

  const templates: { key: Template; label: string; desc: string }[] = [
    { key: 'blank', label: 'Blank',        desc: 'Start from scratch' },
    { key: 'demo',  label: 'Demo Data',     desc: '5 departments, seeded actuals' },
    { key: 'csv',   label: 'Import CSV',    desc: 'Upload a spreadsheet' },
    { key: 'copy',  label: 'Copy Scenario', desc: 'Duplicate an existing one' },
  ]

  return (
    <Modal
      opened={open}
      onClose={() => { onClose(); reset() }}
      title={
        <Stack gap={2}>
          <Text fw={600} size="sm">New Scenario</Text>
          <Text size="xs" c="dimmed">Set up a budget scenario to start analyzing</Text>
        </Stack>
      }
      size="md"
      radius="lg"
    >
      <Stack gap="md">
        <SimpleGrid cols={2} spacing="sm">
          <TextInput
            label="Name"
            placeholder="e.g. FY2026 Budget"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            styles={{ label: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 } }}
          />
          <Box>
            <Text size="xs" fw={600} tt="uppercase" lts={0.5} c="dimmed" mb={6}>Period type</Text>
            <Group gap={4} wrap="wrap">
              {(Object.keys(PERIOD_TYPE_LABELS) as PeriodType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setPeriodType(t)}
                  style={{
                    border: '1px solid',
                    borderColor: periodType === t ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-gray-4)',
                    background: periodType === t ? 'var(--mantine-color-blue-0)' : 'transparent',
                    color: periodType === t ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-gray-6)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    padding: '3px 10px',
                    fontSize: 'var(--mantine-font-size-xs)',
                    fontWeight: periodType === t ? 600 : 400,
                    cursor: 'pointer',
                    lineHeight: 1.5,
                  }}
                >
                  {PERIOD_TYPE_LABELS[t]}
                </button>
              ))}
            </Group>
          </Box>
        </SimpleGrid>

        <TextInput
          label={<Group gap={4}><span>Description</span><Text size="xs" c="dimmed">· optional</Text></Group>}
          placeholder="What is this scenario for?"
          value={description}
          onChange={e => setDescription(e.target.value)}
          styles={{ label: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 } }}
        />

        <Box>
          <Text size="xs" fw={600} tt="uppercase" lts={0.5} c="dimmed" mb="sm">Start with</Text>
          <SimpleGrid cols={2} spacing="xs">
            {templates.map(t => (
              <Paper
                key={t.key}
                withBorder
                p="sm"
                radius="md"
                style={{
                  cursor: 'pointer',
                  borderColor: template === t.key ? 'var(--mantine-color-blue-5)' : undefined,
                  background: template === t.key ? 'var(--mantine-color-blue-0)' : undefined,
                }}
                onClick={() => setTemplate(t.key)}
              >
                <Text size="sm" fw={500}>{t.label}</Text>
                <Text size="xs" c="dimmed" mt={2}>{t.desc}</Text>
              </Paper>
            ))}
          </SimpleGrid>
          {(template === 'csv' || template === 'copy') && (
            <Text size="xs" c="dimmed" mt="xs">
              {template === 'csv' ? 'CSV import' : 'Copy scenario'} coming soon — will start blank.
            </Text>
          )}
        </Box>

        <Group justify="flex-end" gap="sm" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          <Button variant="default" onClick={() => { onClose(); reset() }}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            loading={loading}
          >
            Create Scenario →
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

// ── Edit row ──────────────────────────────────────────────────────────────────

function EditRow({
  values, onChange, onSave, onCancel, deptSuggestions, catSuggestions, periodType,
}: {
  values: Partial<BudgetLineItem>
  onChange: (v: Partial<BudgetLineItem>) => void
  onSave: () => void
  onCancel: () => void
  deptSuggestions: string[]
  catSuggestions: string[]
  periodType: PeriodType
}) {
  const deptRef   = useRef<HTMLInputElement>(null)
  const catRef    = useRef<HTMLInputElement>(null)
  const budgetRef = useRef<HTMLInputElement>(null)
  const actualRef = useRef<HTMLInputElement>(null)
  const notesRef  = useRef<HTMLInputElement>(null)

  const opts = periodOptions(periodType)

  return (
    <>
      <Table.Td>
        {periodType === 'custom' ? (
          <SuggestInput
            value={values.period ?? ''}
            onChange={v => onChange({ ...values, period: v })}
            suggestions={[]}
            placeholder="Period"
            autoFocus
            onEnter={() => deptRef.current?.focus()}
          />
        ) : (
          <Select
            data={opts}
            value={values.period ?? null}
            onChange={v => onChange({ ...values, period: v ?? '' })}
            placeholder="Period"
            size="xs"
            autoFocus
            styles={{ input: { fontSize: 'var(--mantine-font-size-sm)' } }}
          />
        )}
      </Table.Td>
      <Table.Td>
        <SuggestInput
          ref={deptRef}
          value={values.department ?? ''}
          onChange={v => onChange({ ...values, department: v })}
          suggestions={deptSuggestions}
          placeholder="Department"
          onEnter={() => catRef.current?.focus()}
        />
      </Table.Td>
      <Table.Td>
        <SuggestInput
          ref={catRef}
          value={values.category ?? ''}
          onChange={v => onChange({ ...values, category: v })}
          suggestions={catSuggestions}
          placeholder="Category"
          onEnter={() => budgetRef.current?.focus()}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          ref={budgetRef}
          styles={{ input: { textAlign: 'right' } }}
          value={values.budget_amount ?? ''}
          onChange={e => onChange({ ...values, budget_amount: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') actualRef.current?.focus() }}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          ref={actualRef}
          styles={{ input: { textAlign: 'right' } }}
          value={values.actual_amount ?? ''}
          onChange={e => onChange({ ...values, actual_amount: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') notesRef.current?.focus() }}
        />
      </Table.Td>
      <Table.Td />
      <Table.Td>
        <TextInput
          ref={notesRef}
          value={values.notes ?? ''}
          onChange={e => onChange({ ...values, notes: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') onSave() }}
        />
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          <ActionIcon variant="subtle" size="sm" onClick={onSave}><Check size={14} /></ActionIcon>
          <ActionIcon variant="subtle" size="sm" color="gray" onClick={onCancel}><X size={14} /></ActionIcon>
        </Group>
      </Table.Td>
    </>
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

  const handleScenarioCreated = (scenario: BudgetScenario) => {
    setScenarios(prev => [...prev, scenario])
    setSelectedId(scenario.id)
    setShowModal(false)
  }

  const uniquePeriods = Array.from(new Set(lineItems.map(i => i.period).filter(Boolean)))
  const uniqueDepts   = Array.from(new Set(lineItems.map(i => i.department)))
  const uniqueCats    = Array.from(new Set(lineItems.map(i => i.category)))

  const newDeptRef = useRef<HTMLInputElement>(null)
  const catRef     = useRef<HTMLInputElement>(null)
  const budgetRef = useRef<HTMLInputElement>(null)
  const actualRef = useRef<HTMLInputElement>(null)
  const notesRef  = useRef<HTMLInputElement>(null)

  const selectedScenario = scenarios.find(s => s.id === selectedId)
  const activePeriodType: PeriodType = selectedScenario?.period_type ?? 'custom'

  // Always include period_type in filterSpec so filterSpec.ts can sort periods correctly
  const activeFilterSpec: FilterSpec = { ...filterSpec, period_type: activePeriodType }
  const visibleRows = applyFilterSpec(lineItems, activeFilterSpec)

  return (
    <RuntimeProvider scenarioId={selectedId} onFilterSpec={setFilterSpec}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--mantine-color-gray-0)' }}>

        {/* Header */}
        <Box
          style={{
            flexShrink: 0,
            borderBottom: '1px solid var(--mantine-color-gray-3)',
            background: 'var(--mantine-color-white)',
            height: 56,
          }}
        >
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

            {lineItems.length > 0 && (
              <StatsBar items={lineItems} />
            )}

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
                    <Table.Thead>
                      <Table.Tr>
                        {(() => {
                          const groupBy = activeFilterSpec.group_by ?? []
                          if (groupBy.length === 0) return (
                            <>
                              <Table.Th>{PERIOD_TYPE_LABELS[activePeriodType]}</Table.Th>
                              <Table.Th>Department</Table.Th>
                              <Table.Th>Category</Table.Th>
                            </>
                          )
                          const label = groupBy
                            .map(f => f === 'period' ? PERIOD_TYPE_LABELS[activePeriodType] : f.charAt(0).toUpperCase() + f.slice(1))
                            .join(' / ')
                          return <Table.Th colSpan={3}>{label}</Table.Th>
                        })()}
                        <Table.Th style={{ textAlign: 'right' }}>Budget</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Actual</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Variance</Table.Th>
                        <Table.Th>Notes</Table.Th>
                        <Table.Th style={{ width: 104 }} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {visibleRows.map(row => {
                        const isGrouped = (activeFilterSpec.group_by ?? []).length > 0
                        const originalItem = lineItems.find(i => String(i.id) === row.key)

                        // ── Group header row ──────────────────────────────────
                        if (row.isGroupRow) {
                          const paddingLeft = 8 + row.level * 16
                          const bg = row.level === 0
                            ? 'var(--mantine-color-gray-1)'
                            : 'var(--mantine-color-gray-0)'
                          // Map stored period values to display labels in group headers
                          const displayValue = row.groupField === 'period'
                            ? periodLabel(row.groupValue ?? '', activePeriodType)
                            : row.groupValue
                          return (
                            <Table.Tr key={row.key} style={{ background: bg }}>
                              <Table.Td colSpan={3} style={{ paddingLeft, paddingTop: 8, paddingBottom: 8 }}>
                                <Group gap={6}>
                                  <Text size="sm" fw={row.level === 0 ? 700 : 600}>{displayValue}</Text>
                                  <Text size="xs" c="dimmed">
                                    ({row.item_count} {row.item_count === 1 ? 'item' : 'items'})
                                  </Text>
                                </Group>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" fw={600}>{fmt(row.budget)}</Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" fw={600}>{fmt(row.actual)}</Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <VarianceBadge variance={row.variance} />
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" c={row.variance_pct > 0 ? 'red' : 'green'}>
                                  {row.variance_pct > 0 ? '+' : ''}{row.variance_pct.toFixed(1)}%
                                </Text>
                              </Table.Td>
                              <Table.Td />
                            </Table.Tr>
                          )
                        }

                        // ── Leaf item row ─────────────────────────────────────
                        return (
                          <Table.Tr key={row.key}>
                            {originalItem && editingId === originalItem.id ? (
                              <EditRow
                                values={editValues}
                                onChange={setEditValues}
                                onSave={saveEdit}
                                onCancel={() => setEditingId(null)}
                                deptSuggestions={uniqueDepts}
                                catSuggestions={uniqueCats}
                                periodType={activePeriodType}
                              />
                            ) : isGrouped ? (
                              // In a grouped view: collapse dim columns into one
                              (() => {
                                const groupBy = activeFilterSpec.group_by ?? []
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
                                  <>
                                    <Table.Td
                                      colSpan={3}
                                      style={{ paddingLeft, color: 'var(--mantine-color-gray-7)' }}
                                    >
                                      <Text size="sm">{label}</Text>
                                    </Table.Td>
                                    <Table.Td style={{ textAlign: 'right' }}>{fmt(row.budget)}</Table.Td>
                                    <Table.Td style={{ textAlign: 'right' }}>{fmt(row.actual)}</Table.Td>
                                    <Table.Td style={{ textAlign: 'right' }}><VarianceBadge variance={row.variance} /></Table.Td>
                                    <Table.Td c="dimmed" style={{ maxWidth: 160 }}>
                                      {row.notes
                                        ? <Text size="xs" truncate>{row.notes}</Text>
                                        : <Text size="xs" c={row.variance_pct > 0 ? 'red' : 'green'}>
                                            {row.variance_pct !== 0 ? `${row.variance_pct > 0 ? '+' : ''}${row.variance_pct.toFixed(1)}%` : ''}
                                          </Text>
                                      }
                                    </Table.Td>
                                    <Table.Td>
                                      {originalItem && (
                                        <Group gap={4} wrap="nowrap" style={{ opacity: 0 }} className="row-actions">
                                          <ActionIcon variant="subtle" size="sm" onClick={() => { setEditingId(originalItem.id); setEditValues(originalItem) }} title="Edit">
                                            <Pencil size={13} />
                                          </ActionIcon>
                                          <ActionIcon variant="subtle" size="sm" color="gray" onClick={() => duplicateItem(originalItem)} title="Duplicate">
                                            <CopyPlus size={13} />
                                          </ActionIcon>
                                          <ActionIcon variant="subtle" size="sm" color="red" onClick={() => deleteItem(originalItem.id)} title="Delete">
                                            <Trash2 size={13} />
                                          </ActionIcon>
                                        </Group>
                                      )}
                                    </Table.Td>
                                  </>
                                )
                              })()
                            ) : (
                              // Flat view: all 3 dimension columns
                              <>
                                <Table.Td c="dimmed">{row.period ? periodLabel(row.period, activePeriodType) : '—'}</Table.Td>
                                <Table.Td fw={500}>{row.department}</Table.Td>
                                <Table.Td c="dimmed">{row.category}</Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>{fmt(row.budget)}</Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}>{fmt(row.actual)}</Table.Td>
                                <Table.Td style={{ textAlign: 'right' }}><VarianceBadge variance={row.variance} /></Table.Td>
                                <Table.Td c="dimmed" style={{ maxWidth: 160 }}>
                                  {row.notes
                                    ? <Text size="xs" truncate>{row.notes}</Text>
                                    : <Text size="xs" c={row.variance_pct > 0 ? 'red' : 'green'}>
                                        {row.variance_pct !== 0 ? `${row.variance_pct > 0 ? '+' : ''}${row.variance_pct.toFixed(1)}%` : ''}
                                      </Text>
                                  }
                                </Table.Td>
                                <Table.Td>
                                  {originalItem && (
                                    <Group gap={4} wrap="nowrap" style={{ opacity: 0 }} className="row-actions">
                                      <ActionIcon variant="subtle" size="sm" onClick={() => { setEditingId(originalItem.id); setEditValues(originalItem) }} title="Edit">
                                        <Pencil size={13} />
                                      </ActionIcon>
                                      <ActionIcon variant="subtle" size="sm" color="gray" onClick={() => duplicateItem(originalItem)} title="Duplicate">
                                        <CopyPlus size={13} />
                                      </ActionIcon>
                                      <ActionIcon variant="subtle" size="sm" color="red" onClick={() => deleteItem(originalItem.id)} title="Delete">
                                        <Trash2 size={13} />
                                      </ActionIcon>
                                    </Group>
                                  )}
                                </Table.Td>
                              </>
                            )}
                          </Table.Tr>
                        )
                      })}

                      {addingRow && (
                        <Table.Tr style={{ background: 'var(--mantine-color-blue-0)' }}>
                          <Table.Td>
                            {activePeriodType === 'custom' ? (
                              <SuggestInput
                                value={newRow.period ?? ''}
                                onChange={v => setNewRow(p => ({ ...p, period: v }))}
                                suggestions={uniquePeriods}
                                placeholder="Period"
                                autoFocus
                                onEnter={() => newDeptRef.current?.focus()}
                              />
                            ) : (
                              <Select
                                data={periodOptions(activePeriodType)}
                                value={newRow.period ?? null}
                                onChange={v => setNewRow(p => ({ ...p, period: v ?? '' }))}
                                placeholder="Period"
                                size="xs"
                                autoFocus
                                styles={{ input: { fontSize: 'var(--mantine-font-size-sm)' } }}
                              />
                            )}
                          </Table.Td>
                          <Table.Td>
                            <SuggestInput
                              ref={newDeptRef}
                              value={newRow.department ?? ''}
                              onChange={v => setNewRow(p => ({ ...p, department: v }))}
                              suggestions={uniqueDepts}
                              placeholder="Department"
                              onEnter={() => catRef.current?.focus()}
                            />
                          </Table.Td>
                          <Table.Td>
                            <SuggestInput
                              ref={catRef}
                              value={newRow.category ?? ''}
                              onChange={v => setNewRow(p => ({ ...p, category: v }))}
                              suggestions={uniqueCats}
                              placeholder="Category"
                              onEnter={() => budgetRef.current?.focus()}
                            />
                          </Table.Td>
                          <Table.Td>
                            <TextInput
                              ref={budgetRef}
                              styles={{ input: { textAlign: 'right' } }}
                              placeholder="0"
                              value={newRow.budget_amount ?? ''}
                              onChange={e => setNewRow(p => ({ ...p, budget_amount: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') actualRef.current?.focus() }}
                            />
                          </Table.Td>
                          <Table.Td>
                            <TextInput
                              ref={actualRef}
                              styles={{ input: { textAlign: 'right' } }}
                              placeholder="0"
                              value={newRow.actual_amount ?? ''}
                              onChange={e => setNewRow(p => ({ ...p, actual_amount: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') notesRef.current?.focus() }}
                            />
                          </Table.Td>
                          <Table.Td />
                          <Table.Td>
                            <TextInput
                              ref={notesRef}
                              placeholder="Notes"
                              value={newRow.notes ?? ''}
                              onChange={e => setNewRow(p => ({ ...p, notes: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') saveNewRow() }}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <ActionIcon variant="subtle" size="sm" onClick={saveNewRow}><Check size={14} /></ActionIcon>
                              <ActionIcon variant="subtle" size="sm" color="gray" onClick={() => { setAddingRow(false); setNewRow({}) }}><X size={14} /></ActionIcon>
                            </Group>
                          </Table.Td>
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

          {/* Right: chat — always visible */}
          <div style={{
            width: 384,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderLeft: '1px solid var(--mantine-color-gray-3)',
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
        onCreated={handleScenarioCreated}
      />
    </RuntimeProvider>
  )
}
