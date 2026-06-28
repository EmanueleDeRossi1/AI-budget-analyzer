'use client'

import { useState } from 'react'
import {
  Modal, Stack, SimpleGrid, TextInput, Box, Text, Group, Button, Paper,
} from '@mantine/core'
import { api, BudgetScenario } from '@/lib/api'
import { PeriodType, PERIOD_TYPE_LABELS, periodOptions } from '@/lib/periods'
import SegmentButton from '@/components/SegmentButton'

type Template = 'blank' | 'demo' | 'csv' | 'copy'

function buildDemoItems(periodType: PeriodType) {
  const opts = periodOptions(periodType)
  const p1 = opts[0]?.value ?? ''
  const p2 = opts[1]?.value ?? opts[0]?.value ?? ''
  return [
    { period: p1, department: 'Marketing',   category: 'Paid Ads',    budget_amount: '50000', actual_amount: '65000', notes: '' },
    { period: p1, department: 'Sales',       category: 'Travel',       budget_amount: '20000', actual_amount: '27500', notes: '' },
    { period: p1, department: 'Engineering', category: 'Tools',        budget_amount: '30000', actual_amount: '28500', notes: '' },
    { period: p2, department: 'HR',          category: 'Recruiting',   budget_amount: '45000', actual_amount: '41200', notes: '' },
    { period: p2, department: 'Operations',  category: 'Contractors',  budget_amount: '60000', actual_amount: '71000', notes: '' },
  ]
}

const TEMPLATES: { key: Template; label: string; desc: string }[] = [
  { key: 'blank', label: 'Blank',        desc: 'Start from scratch' },
  { key: 'demo',  label: 'Demo Data',    desc: '5 departments, seeded actuals' },
  { key: 'csv',   label: 'Import CSV',   desc: 'Upload a spreadsheet' },
  { key: 'copy',  label: 'Copy Scenario',desc: 'Duplicate an existing one' },
]

export default function NewScenarioModal({
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
                <SegmentButton key={t} active={periodType === t} onClick={() => setPeriodType(t)}>
                  {PERIOD_TYPE_LABELS[t]}
                </SegmentButton>
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
            {TEMPLATES.map(t => (
              <Paper
                key={t.key}
                withBorder p="sm" radius="md"
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
          <Button onClick={handleCreate} disabled={!name.trim() || loading} loading={loading}>
            Create Scenario →
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
