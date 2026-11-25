'use client'

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

type FinanceRow = Record<string, unknown>

const comparisonConfig = {
  sales: { label: 'Beneficio generado', color: 'var(--chart-1)' },
  purchases: { label: 'Gasto final', color: 'var(--destructive)' },
} satisfies ChartConfig

const commerceConfig = {
  amount: { label: 'Importe', color: 'var(--chart-1)' },
  name: { label: 'Comercio' },
} satisfies ChartConfig

function numericAmount(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  let normalized = String(value ?? '').trim().replace(/\s|€|EUR/gi, '').replace(/[^\d,.-]/g, '')
  if (!normalized) return 0
  const comma = normalized.lastIndexOf(',')
  const dot = normalized.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) normalized = comma > dot ? normalized.replace(/\./g, '').replace(',', '.') : normalized.replace(/,/g, '')
  else if (comma >= 0) normalized = normalized.replace(/,/g, '.')
  else if (dot >= 0 && normalized.split('.').at(-1)?.length === 3) normalized = normalized.replace(/\./g, '')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : 0
}

function euros(value: unknown) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(numericAmount(value))
}

export function SalesVsPurchasesChart({ salesValue, purchasesValue }: { salesValue: number; purchasesValue: number }) {
  const data = [{ category: 'Total acumulado', sales: salesValue, purchases: purchasesValue }]

  return <ChartContainer config={comparisonConfig} className="analytics-chart">
    <BarChart data={data} accessibilityLayer margin={{ top: 12, right: 14, left: 4, bottom: 4 }}>
      <CartesianGrid vertical={false} strokeDasharray="3 4" />
      <XAxis dataKey="category" axisLine={false} tickLine={false} tickMargin={10} />
      <YAxis axisLine={false} tickLine={false} width={66} tickFormatter={(value) => `${Number(value).toLocaleString('es-ES')} €`} />
      <Tooltip content={<ChartTooltipContent formatter={(value) => euros(value)} />} />
      <Bar dataKey="sales" fill="var(--color-sales)" radius={[5, 5, 0, 0]} maxBarSize={76} />
      <Bar dataKey="purchases" fill="var(--color-purchases)" radius={[5, 5, 0, 0]} maxBarSize={76} />
    </BarChart>
  </ChartContainer>
}

export function TopCommerceChart({ title, rows, valueKey, valueLabel }: { title: string; rows: FinanceRow[]; valueKey: string; valueLabel: string }) {
  const [open, setOpen] = useState(false)
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const name = String(row.COMERCIO ?? '').trim()
    if (name) grouped.set(name, (grouped.get(name) ?? 0) + numericAmount(row[valueKey]))
  }
  const chartData = [...grouped].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5)
  const chartConfig = { ...commerceConfig, amount: { label: valueLabel, color: 'var(--chart-1)' } } satisfies ChartConfig

  return <section className="panel commerce-chart-panel" aria-label={title}>
    <div className="panel-heading"><div><span className="panel-kicker">TOP 5 · {valueLabel}</span><h2>{title}</h2></div><button className="button-outline commerce-chart-toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{open ? 'Ocultar gráfica' : 'Ver gráfica'}{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button></div>
    {open && (chartData.length ? <ChartContainer config={chartConfig} className="commerce-chart">
      <BarChart data={chartData} layout="vertical" accessibilityLayer margin={{ top: 4, right: 20, left: 2, bottom: 4 }}>
        <XAxis type="number" axisLine={false} tickLine={false} tick={false} />
        <YAxis type="category" dataKey="name" width={132} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#657267' }} />
        <Tooltip content={<ChartTooltipContent labelKey="name" formatter={(value) => euros(value)} />} />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 8, 8, 0]} maxBarSize={18} activeBar={{ fill: '#77977b' }} />
      </BarChart>
    </ChartContainer> : <p className="chart-empty">Aún no hay importes para comparar.</p>)}
  </section>
}
