'use client'

import { BarChart } from '@mantine/charts'
import { ChartRow } from '@/lib/chartData'

function shortFmt(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${Math.round(v)}`
}

export default function GroupedBar({ data }: { data: ChartRow[] }) {
  const chartData = data.map(d => ({
    name: d.name,
    Budget: Math.round(d.budget),
    Actual: Math.round(d.actual),
  }))

  return (
    <BarChart
      h={160}
      data={chartData}
      dataKey="name"
      series={[
        { name: 'Budget', color: 'blue.5' },
        { name: 'Actual', color: 'orange.5' },
      ]}
      type="default"
      withLegend
      legendProps={{ verticalAlign: 'top', height: 28 }}
      tickLine="none"
      gridAxis="y"
      valueFormatter={shortFmt}
      barProps={{ maxBarSize: 32 }}
    />
  )
}
