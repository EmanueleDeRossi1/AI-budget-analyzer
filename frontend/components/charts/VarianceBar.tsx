'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { ChartRow } from '@/lib/chartData'
import { fmt } from '@/lib/utils'

function shortFmt(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(Math.round(v))
}

function truncate(s: string, max = 12) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

export default function VarianceBar({ data }: { data: ChartRow[] }) {
  // worst over-budget first
  const sorted = [...data].sort((a, b) => a.variance - b.variance)

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={sorted} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <XAxis
          dataKey="name"
          tickFormatter={s => truncate(s)}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={shortFmt}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          formatter={(v: number) => [fmt(v), 'Variance']}
          labelStyle={{ fontWeight: 600, fontSize: 12 }}
          contentStyle={{ fontSize: 12 }}
        />
        <ReferenceLine y={0} stroke="var(--mantine-color-gray-4)" strokeWidth={1} />
        <Bar dataKey="variance" radius={[3, 3, 0, 0]} maxBarSize={48}>
          {sorted.map((row, i) => (
            <Cell
              key={i}
              fill={row.variance >= 0
                ? 'var(--mantine-color-green-5)'
                : 'var(--mantine-color-red-5)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
