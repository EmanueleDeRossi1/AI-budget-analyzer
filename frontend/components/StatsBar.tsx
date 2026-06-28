'use client'

import { Box, SimpleGrid, Paper, Text, Group } from '@mantine/core'
import { BarChart } from '@mantine/charts'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { BudgetLineItem } from '@/lib/api'
import { fmt } from '@/lib/utils'

export default function StatsBar({ items }: { items: BudgetLineItem[] }) {
  const totalBudget = items.reduce((s, i) => s + Number(i.budget_amount), 0)
  const totalActual = items.reduce((s, i) => s + Number(i.actual_amount), 0)
  const delta = totalBudget - totalActual
  const favorable = delta >= 0

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
            {favorable
              ? <TrendingDown size={12} color="var(--mantine-color-green-6)" />
              : <TrendingUp size={12} color="var(--mantine-color-red-6)" />}
            <Text size="xs" c={favorable ? 'green' : 'red'}>{favorable ? '+' : ''}{fmt(delta)} vs plan</Text>
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
