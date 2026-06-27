'use client'

import { Box, Group, Text, Button, MultiSelect, Divider } from '@mantine/core'
import { X } from 'lucide-react'
import { FilterSpec, GroupByField, isEmptySpec, toggleGroupBy } from '@/lib/filterSpec'
import { PeriodType, PERIOD_TYPE_LABELS, periodLabel } from '@/lib/periods'

export default function FilterBar({
  items, spec, onChange, periodType,
}: {
  items: { period: string; department: string; category: string }[]
  spec: FilterSpec
  onChange: (s: FilterSpec) => void
  periodType: PeriodType
}) {
  const rawPeriods = Array.from(new Set(items.map(i => i.period).filter(Boolean)))
  const periodSelectData = rawPeriods.map(v => ({ value: v, label: periodLabel(v, periodType) }))
  const depts = Array.from(new Set(items.map(i => i.department))).sort()
  const cats  = Array.from(new Set(items.map(i => i.category))).sort()
  const empty  = isEmptySpec(spec)
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
    display: 'inline-flex', alignItems: 'center', gap: 4,
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
    border: 'none', background: 'transparent',
    color: 'var(--mantine-color-blue-5)',
    cursor: 'pointer', padding: '0 2px', fontSize: 12, lineHeight: 1, opacity: 0.7,
  }

  return (
    <Box px="md" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)', background: 'var(--mantine-color-white)', flexShrink: 0 }}>
      <Group gap="sm" wrap="nowrap" align="center">

        {periodSelectData.length > 0 && (
          <MultiSelect
            data={periodSelectData}
            value={spec.periods ?? []}
            onChange={v => onChange({ ...spec, periods: v.length ? v : undefined })}
            placeholder={`All ${PERIOD_TYPE_LABELS[periodType].toLowerCase()}s`}
            size="xs" clearable searchable
            style={{ minWidth: 120, maxWidth: 180 }}
            styles={{ input: { fontSize: 'var(--mantine-font-size-xs)' } }}
          />
        )}

        <MultiSelect
          data={depts}
          value={spec.departments ?? []}
          onChange={v => onChange({ ...spec, departments: v.length ? v : undefined })}
          placeholder="All departments"
          size="xs" clearable searchable
          style={{ minWidth: 150, maxWidth: 220 }}
          styles={{ input: { fontSize: 'var(--mantine-font-size-xs)' } }}
        />

        <MultiSelect
          data={cats}
          value={spec.categories ?? []}
          onChange={v => onChange({ ...spec, categories: v.length ? v : undefined })}
          placeholder="All categories"
          size="xs" clearable searchable
          style={{ minWidth: 150, maxWidth: 220 }}
          styles={{ input: { fontSize: 'var(--mantine-font-size-xs)' } }}
        />

        <Divider orientation="vertical" h={20} />

        <Group gap={4} wrap="nowrap" align="center">
          <Text size="xs" c="dimmed" fw={500} style={{ whiteSpace: 'nowrap' }}>Group by</Text>
          {groupBy.map((field, idx) => (
            <span key={field} style={activePillStyle}>
              {groupBy.length > 1 && (
                <span style={{ opacity: 0.5, fontSize: 10, marginRight: 2 }}>{idx + 1}</span>
              )}
              {ALL_GROUP_OPTS.find(o => o.value === field)?.label}
              <button style={xBtnStyle} onClick={() => onChange(toggleGroupBy(spec, field))}>×</button>
            </span>
          ))}
          {ALL_GROUP_OPTS.filter(o => !groupBy.includes(o.value)).map(o => (
            <button key={o.value} style={segStyle(false)} onClick={() => onChange(toggleGroupBy(spec, o.value))}>
              + {o.label}
            </button>
          ))}
        </Group>

        <Divider orientation="vertical" h={20} />

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
