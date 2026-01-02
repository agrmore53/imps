'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DashboardChartsProps {
  data: Array<{
    data: string
    valor: number
  }>
}

export function DashboardCharts({ data }: DashboardChartsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-sm text-primary font-bold">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      )
    }
    return null
  }

  const hasData = data.some(d => d.valor > 0)

  if (!hasData) {
    return (
      <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
        Nenhuma venda registrada no período
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="data"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          className="text-muted-foreground"
        />
        <YAxis
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatCurrency(value)}
          className="text-muted-foreground"
          width={80}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="valor"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
