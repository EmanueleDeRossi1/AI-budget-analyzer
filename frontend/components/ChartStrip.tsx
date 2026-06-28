'use client'

import { useState } from 'react'
import { Box, Group, SegmentedControl, ActionIcon, Text } from '@mantine/core'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { BudgetLineItem } from '@/lib/api'
import { FilterSpec, applyFilters } from '@/lib/filterSpec'
import { PeriodType } from '@/lib/periods'
import { aggregateByDimension, aggregateByPeriod } from '@/lib/chartData'
import VarianceBar from './charts/VarianceBar'
import GroupedBar from './charts/GroupedBar'
import TrendLine from './charts/TrendLine'

type ChartType = 'variance' | 'grouped' | 'trend'

export default function ChartStrip({
  lineItems,
  filterSpec,
  periodType,
}: {
  lineItems: BudgetLineItem[]
  filterSpec: FilterSpec
  periodType: PeriodType
}) {
  const [chartType, setChartType] = useState<ChartType>('variance')
  const [collapsed, setCollapsed] = useState(false)

  const filtered = applyFilters(lineItems, filterSpec)

  // Bar charts default to department; switch to category if the table is grouped by it
  const dimension = filterSpec.group_by?.[0] === 'category' ? 'category' : 'department'
  const dimData = aggregateByDimension(filtered, dimension)
  const periodData = aggregateByPeriod(filtered, periodType)

  return (
    <Box
      style={{
        borderBottom: '1px solid var(--mantine-color-gray-3)',
        background: 'var(--mantine-color-white)',
        flexShrink: 0,
      }}
    >
      <Group px="md" py="xs" justify="space-between" wrap="nowrap">
        <Group gap="xs" align="center">
          <SegmentedControl
            size="xs"
            value={chartType}
            onChange={v => setChartType(v as ChartType)}
            data={[
              { label: 'Variance', value: 'variance' },
              { label: 'Budget vs Actual', value: 'grouped' },
              { label: 'Trend', value: 'trend' },
            ]}
          />
          {(chartType === 'variance' || chartType === 'grouped') && (
            <Text size="xs" c="dimmed">
              by {dimension}
            </Text>
          )}
        </Group>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand chart' : 'Collapse chart'}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </ActionIcon>
      </Group>

      {!collapsed && (
        <Box px="md" pb="md">
          {chartType === 'variance' && <VarianceBar data={dimData} />}
          {chartType === 'grouped' && <GroupedBar data={dimData} />}
          {chartType === 'trend' && <TrendLine data={periodData} periodType={periodType} />}
        </Box>
      )}
    </Box>
  )
}
