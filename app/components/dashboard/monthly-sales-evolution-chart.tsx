"use client"

import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useTheme } from "@/app/context/ThemeContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { BarChart as BarChartIcon } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { formatSalesMoney } from "@/lib/sales/report-format"
import { buildSalesTrend, salesTrendRange, type SalesTrendInput, type SalesTrendBucket } from "./sales-trend-data"

interface MonthlySalesEvolutionChartProps extends SalesTrendInput {
  isLoading: boolean
  dataReady: boolean
  currency?: string
  byChannel?: boolean
  showPeriod?: boolean
}

const series = [
  { key: "onlineSales", name: "Online", color: "#10B981" },
  { key: "retailSales", name: "Retail", color: "#3B82F6" },
  { key: "otherSales", name: "Other / unassigned", color: "#A78BFA" },
] as const

/** The legacy component name/`data` prop remains supported; daily rows enable adaptive periods. */
export function MonthlySalesEvolutionChart({ data, dailyData, startDate, endDate, coverage,
  isLoading, dataReady, currency = "UNSPECIFIED", byChannel = true, showPeriod = true }: MonthlySalesEvolutionChartProps) {
  const { isDarkMode } = useTheme()
  const trend = useMemo(() => buildSalesTrend({ data, dailyData, startDate, endDate, coverage }),
    [data, dailyData, startDate, endDate, coverage])
  const loading = isLoading || !dataReady
  const observed = trend.points.filter(point => point.totalSales !== null)
  const hasAmounts = observed.some(point => point.totalSales !== 0 || point.onlineSales !== 0 || point.retailSales !== 0 || point.otherSales !== 0)
  const period = salesTrendRange(trend.startDate, trend.endDate)
  const unit = { daily: "day", weekly: "week", monthly: "month" }[trend.granularity]
  const tickCount = Math.min(6, trend.points.length)
  const ticks = Array.from({ length: tickCount }, (_, index) =>
    trend.points[Math.round(index * (trend.points.length - 1) / Math.max(1, tickCount - 1))].date)
  const money = (value: number) => formatSalesMoney(value, currency)
  const compactMoney = (value: number) => currency === "UNSPECIFIED"
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
    : formatSalesMoney(value, currency, true)
  const activeSeries = byChannel ? series : [{ key: "totalSales", name: "Confirmed sales", color: "#10B981" }] as const
  const title = byChannel ? "Sales trend by channel" : "Sales trend"

  return <Card className="min-w-0 overflow-hidden">
    <CardHeader className="space-y-2 p-4 pb-3 sm:p-5 sm:pb-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {showPeriod && <CardDescription>{period}</CardDescription>}
        </div>
        {!loading && <span className="rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium capitalize">
          {trend.granularity} totals
        </span>}
      </div>
      <CardDescription className="text-xs">
        {loading ? "Loading confirmed sales for the selected period." : `Confirmed sale amounts by ${unit}, not cash collected.`}
        {!loading && trend.legacy && " Monthly data only; daily detail is unavailable. Edge months may be partial."}
        {!loading && !trend.legacy && trend.granularity === "weekly" && " Weeks are seven-day groups from the selected start date; the last may be shorter."}
        {!loading && !trend.legacy && trend.granularity === "monthly" && " First and last months may be partial."}
      </CardDescription>
    </CardHeader>
    <CardContent className="px-3 pb-4 sm:px-5">
      <div className="h-[300px] min-w-0 w-full sm:h-[340px]"
        role={loading || !hasAmounts ? "status" : "img"} aria-busy={loading}
        aria-label={loading ? "Loading sales trend" : `${title}, ${trend.granularity} totals. ${period}${trend.hasGaps ? ". Incomplete data; gaps are unavailable." : ""}`}>
        {loading ? <div className="flex h-full items-end gap-3 border-b border-l px-4 pb-2 pt-6" aria-hidden="true">
          {["h-1/3", "h-2/3", "h-1/2", "h-3/4", "h-2/3", "h-5/6", "h-1/2"].map((height, index) => (
            <Skeleton key={index} className={`min-w-0 flex-1 ${height}`} />
          ))}
        </div> : !hasAmounts ? <div className="flex h-full items-center justify-center">
          <EmptyCard icon={<BarChartIcon className="h-8 w-8 text-muted-foreground" />}
            showShadow={false} variant="simple" contentClassName="min-h-0 py-6"
            title={observed.length && !trend.hasGaps ? "No sales amount in this period" : "Sales trend unavailable"}
            description={observed.length && !trend.hasGaps
              ? "Confirmed sales total zero for this period. Try another date range or segment."
              : "Dated sales amounts are not available for the full selected period. Missing data is not zero sales."} />
        </div> : <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={trend.points} margin={{ top: 12, right: 8, left: 0, bottom: 8 }} barGap={1} maxBarSize={44}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#e5e7eb"} />
              <XAxis dataKey="date" ticks={ticks} axisLine={false} tickLine={false} minTickGap={28} interval="preserveStartEnd"
                tick={{ fontSize: 11, fill: isDarkMode ? "#CBD5E1" : "#6B7280" }} tickMargin={10}
                tickFormatter={date => trend.points.find(point => point.date === date)?.label ?? date} />
              <YAxis axisLine={false} tickLine={false} width={72} tickCount={5}
                tick={{ fontSize: 11, fill: isDarkMode ? "#CBD5E1" : "#6B7280" }} tickFormatter={compactMoney} />
              <Tooltip cursor={{ fill: isDarkMode ? "#ffffff08" : "#00000004" }}
                content={({ active, payload }) => {
                  const point = payload?.[0]?.payload as SalesTrendBucket | undefined
                  if (!active || !point) return null
                  const date = /^\d{4}-\d{2}-\d{2}$/.test(point.date)
                    ? salesTrendRange(point.date, point.endDate) : point.label
                  return <div className="max-w-[260px] rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                    <p className="mb-2 font-medium">{date}</p>
                    {activeSeries.map(item => <div key={item.key} className="flex justify-between gap-4 py-0.5">
                      <span>{item.name}</span><span className="font-medium tabular-nums">{point[item.key] === null ? "Unavailable" : money(point[item.key]!)}</span>
                    </div>)}
                    {byChannel && point.totalSales !== null && <div className="mt-2 flex justify-between gap-4 border-t pt-2 font-medium">
                      <span>Total</span><span className="tabular-nums">{money(point.totalSales)}</span>
                    </div>}
                  </div>
                }} />
              {activeSeries.map(item => <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color}
                stackId={byChannel ? "channels" : undefined} radius={byChannel ? 0 : [3, 3, 0, 0]} isAnimationActive={false} />)}
            </BarChart>
          </ResponsiveContainer>}
      </div>
      {loading ? <Skeleton className="mx-auto mt-3 h-4 w-36" /> : hasAmounts && (
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Chart legend">
          {activeSeries.map(item => <span key={item.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />{item.name}
          </span>)}
        </div>
      )}
      {!loading && <p className="mt-3 text-xs text-muted-foreground">
        {currency === "UNSPECIFIED" ? "Currency unspecified; amounts shown as recorded." : `Amounts in ${currency}.`}
        {trend.hasGaps && " Gaps are unavailable, not zero; incomplete buckets are not totaled."}
      </p>}
    </CardContent>
  </Card>
}