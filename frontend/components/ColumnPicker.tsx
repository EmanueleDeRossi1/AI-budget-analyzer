'use client'

import { useState } from 'react'
import { Popover, Switch, Text, Stack, Group, ActionIcon } from '@mantine/core'
import { Plus } from 'lucide-react'
import { getAllDerivedColumns } from '@/lib/operations'

export default function ColumnPicker({
  activeColumns,
  onToggle,
}: {
  activeColumns: string[]
  onToggle: (columnId: string) => void
}) {
  const [opened, setOpened] = useState(false)
  const allColumns = getAllDerivedColumns()

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-end" shadow="md" width={240}>
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          size="sm"
          color="blue"
          onClick={() => setOpened(o => !o)}
          title="Add computed column"
        >
          <Plus size={14} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs" style={{ letterSpacing: 0.6 }}>
          Computed Columns
        </Text>
        <Stack gap="sm">
          {allColumns.map(col => (
            <Group key={col.id} justify="space-between" wrap="nowrap">
              <div>
                <Text size="sm" fw={500}>{col.label}</Text>
                <Text size="xs" c="dimmed">{col.description}</Text>
              </div>
              <Switch
                size="sm"
                checked={activeColumns.includes(col.id)}
                onChange={() => onToggle(col.id)}
              />
            </Group>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
