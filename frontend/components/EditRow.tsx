'use client'

import { useRef } from 'react'
import { Table, TextInput, ActionIcon, Group, Select } from '@mantine/core'
import { Check, X } from 'lucide-react'
import { BudgetLineItem } from '@/lib/api'
import { PeriodType, periodOptions } from '@/lib/periods'
import { filterNumericInput } from '@/lib/utils'
import SuggestInput from './SuggestInput'

export default function EditRow({
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
        <Select
          data={opts}
          value={values.period ?? null}
          onChange={v => onChange({ ...values, period: v ?? '' })}
          placeholder="Period"
          size="xs"
          autoFocus
          styles={{ input: { fontSize: 'var(--mantine-font-size-sm)' } }}
        />
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
          placeholder="0"
          value={values.budget_amount ?? ''}
          onChange={e => onChange({ ...values, budget_amount: filterNumericInput(e.target.value) })}
          onKeyDown={e => { if (e.key === 'Enter') actualRef.current?.focus() }}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          ref={actualRef}
          styles={{ input: { textAlign: 'right' } }}
          placeholder="0"
          value={values.actual_amount ?? ''}
          onChange={e => onChange({ ...values, actual_amount: filterNumericInput(e.target.value) })}
          onKeyDown={e => { if (e.key === 'Enter') notesRef.current?.focus() }}
        />
      </Table.Td>
      <Table.Td />
      <Table.Td>
        <TextInput
          ref={notesRef}
          placeholder="Notes"
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
