'use client'

import { useState } from 'react'
import {
  Combobox, useCombobox, InputBase, Group, Text,
  ScrollArea, Stack,
} from '@mantine/core'
import { ChevronDown, Search, Plus, Check } from 'lucide-react'
import { BudgetScenario } from '@/lib/api'

export default function ScenarioCombobox({
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
