'use client'

import { LineChart } from '@mantine/charts'
import { Text } from '@mantine/core'
import { PeriodChartData } from '@/lib/chartData'
import { PeriodType } from '@/lib/periods'

function shortFmt(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${Math.round(v)}`
}

export default function TrendLine({ data }: { data: PeriodChartData; periodType: PeriodType }) {
  const { rows, excluded } = data

  if (rows.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        No period data to display.
        {excluded > 0 && ` ${excluded} item${excluded !== 1 ? 's' : ''} have no period set.`}
      </Text>
    )
  }

  const chartData = rows.map(r => ({
    name: r.name,
    Budget: Math.round(r.budget),
    Actual: Math.round(r.actual),
  }))

  return (
    <div>
      <LineChart
        h={160}
        data={chartData}
        dataKey="name"
        series={[
          { name: 'Budget', color: 'blue.5' },
          { name: 'Actual', color: 'orange.5' },
        ]}
        withLegend
        legendProps={{ verticalAlign: 'top', height: 28 }}
        curveType="linear"
        tickLine="none"
        gridAxis="y"
        valueFormatter={shortFmt}
        withDots
      />
      {excluded > 0 && (
        <Text size="xs" c="dimmed" ta="right" mt={4}>
          {excluded} item{excluded !== 1 ? 's' : ''} without a period excluded
        </Text>
      )}
    </div>
  )
}
