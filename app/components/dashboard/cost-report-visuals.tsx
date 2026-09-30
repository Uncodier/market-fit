"use client"

import type { ReactNode } from "react"
import { format, isValid, startOfMonth, subMonths } from "date-fns"
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Skeleton } from "@/app/components/ui/skeleton"
import { costCurrency, formatCost, percentChange, type CostData } from "./cost-report-data"
import { ReportDetails } from "./report-layout"
import { ReportChartFrame } from "./report-chart-frame"

type VisualProps = { currency?: string | null; isLoading: boolean; dataReady: boolean }
const colors = ["#6366f1", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6"]

function CostPanel({ title, description, isLoading, empty, children, context, chartHeight = "h-56", chart = false }: {
  title: string; description: string; isLoading: boolean; empty?: string; children: ReactNode
  context?: ReactNode; chartHeight?: string; chart?: boolean
}) {
  return <Card className="flex h-full min-w-0 flex-col" data-report-panel={title}>
    <CardHeader className="space-y-1 p-4 pb-3 sm:p-5 sm:pb-3">
      <CardTitle className="text-base">{title}</CardTitle><CardDescription className="text-xs">{description}</CardDescription>
      {context}
    </CardHeader>
    <CardContent className="min-w-0 flex-1 p-4 pt-0 sm:p-5 sm:pt-0">
      {isLoading ? <ReportChartFrame enabled={chart} role="status" aria-label={`Loading ${title}`} className={chartHeight}><Skeleton className="h-full w-full" /></ReportChartFrame>
        : empty ? <ReportChartFrame enabled={chart} className={`flex items-center justify-center ${chartHeight}`}><p className="text-center text-sm text-muted-foreground">{empty}</p></ReportChartFrame> : children}
    </CardContent>
  </Card>
}

function currencyLabel(currency?: string | null) {
  return costCurrency(currency) ?? "currency unspecified"
}

export function CostReportDistribution({ data, currency, isLoading, dataReady }: VisualProps & { data: CostData["costDistribution"] }) {
  const positive = data.filter((row) => row.amount > 0)
  return <CostPanel title="Cost Distribution by Category" description={`Reported costs by category (${currencyLabel(currency)}).`}
    isLoading={isLoading || !dataReady} empty={positive.length ? undefined : "No cost distribution data for the selected period."}
    chart chartHeight="h-56 xl:h-80">
    <ReportChartFrame className="h-56 min-w-0 xl:h-80" aria-label="Cost distribution chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart>
          <Pie data={positive} dataKey="amount" nameKey="category" innerRadius="45%" outerRadius="75%" isAnimationActive={false}>
            {positive.map((row, index) => <Cell key={row.category} fill={colors[index % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(value: number) => formatCost(value, currency)} />
        </PieChart>
      </ResponsiveContainer>
    </ReportChartFrame>
    <ul className="space-y-2 text-sm">
      {data.map((row) => <li key={row.category} className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-b border-border/50 pb-2 last:border-0">
        <span className="flex min-w-0 items-center gap-2 break-words">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-muted" style={row.amount > 0 ? { backgroundColor: colors[positive.indexOf(row) % colors.length] } : undefined} />
          {row.category}
        </span><span className="tabular-nums">{formatCost(row.amount, currency)} · {row.percentage.toFixed(1)}%</span>
      </li>)}
    </ul>
  </CostPanel>
}

export function CostReportTrend({ data, currency, isLoading, dataReady, startDate, endDate }: VisualProps & {
  data: CostData["monthlyData"]; startDate?: Date; endDate?: Date
}) {
  // The API supplies six monthly buckets ending at the selected end, independently of the selected start.
  const anchor = endDate && isValid(endDate) ? startOfMonth(endDate) : undefined
  const months = anchor ? Array.from({ length: 6 }, (_, index) => subMonths(anchor, 5 - index)) : []
  const rows = data.map(row => {
    const month = months.find(date => row.month === format(date, "MMM") || row.month === format(date, "yyyy-MM"))
    return { ...row, label: month ? format(month, "MMM yy") : row.month }
  })
  const context = anchor && endDate ? `${format(months[0], "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}` : "Six-month context supplied by the source"
  const compactMoney = (value: number) => new Intl.NumberFormat("en-US", {
    ...(costCurrency(currency) ? { style: "currency", currency: costCurrency(currency)! } : {}),
    notation: "compact", maximumFractionDigits: 1,
  }).format(value)
  return <CostPanel title="Monthly Cost Evolution" description={`${context} · ${currencyLabel(currency)}`}
    isLoading={isLoading || !dataReady} empty={data.length ? undefined : "No monthly cost data in the six-month context window."}
    chart chartHeight="h-72 sm:h-80"
    context={<p className="pt-2 text-xs text-muted-foreground">Six-month context ending on the selected end date; not the selected-period total.</p>}>
    <ReportChartFrame className="h-72 min-w-0 sm:h-80" aria-label="Monthly cost chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.15} />
          <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 11 }} minTickGap={16} axisLine={false} tickLine={false} />
          <YAxis width={54} tick={{ fill: "currentColor", fontSize: 11 }} axisLine={false} tickLine={false}
            tickFormatter={compactMoney} />
          <Tooltip formatter={(value: number) => formatCost(value, currency)} />
          <Legend />
          <Bar dataKey="fixedCosts" name="Fixed Costs" fill={colors[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="variableCosts" name="Variable Costs" fill={colors[1]} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ReportChartFrame>
    <ReportDetails summary="How this cost trend is scoped">
      <p>Fixed and variable costs are aggregated monthly across the six calendar months ending on the selected end date. The final month includes only dates through that day. Changing the selected start date does not change this context window.</p>
      {startDate && isValid(startDate) && endDate && isValid(endDate) && <p>KPIs, distribution and category totals use the selected range: {format(startDate, "MMM d, yyyy")} – {format(endDate, "MMM d, yyyy")}.</p>}
      <p>Daily costs are not supplied by this report. Monthly values are not interpolated into daily points.</p>
    </ReportDetails>
  </CostPanel>
}

export function CostReportCategories({ data, currency, isLoading, dataReady }: VisualProps & { data: CostData["costCategories"] }) {
  const total = data.reduce((sum, row) => sum + row.amount, 0)
  return <CostPanel title="Cost Breakdown" description={`Costs by category compared with the previous period (${currencyLabel(currency)}).`}
    isLoading={isLoading || !dataReady} empty={data.length ? undefined : "No cost categories data for the selected period."}>
    <Table className="min-w-[620px]">
      <TableHeader><TableRow>
        <TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead>
        <TableHead className="text-right">Previous</TableHead><TableHead className="text-right">% of Total</TableHead>
        <TableHead className="text-right">Period Change</TableHead>
      </TableRow></TableHeader>
      <TableBody>{data.map((row) => {
        const change = percentChange(row.amount, row.prevAmount)
        return <TableRow key={row.name}>
          <TableCell className="font-medium">{row.name}</TableCell>
          <TableCell className="text-right tabular-nums">{formatCost(row.amount, currency)}</TableCell>
          <TableCell className="text-right tabular-nums">{formatCost(row.prevAmount, currency)}</TableCell>
          <TableCell className="text-right tabular-nums">{total > 0 ? `${(row.amount / total * 100).toFixed(1)}%` : "—"}</TableCell>
          <TableCell className="text-right tabular-nums">
            <span className={change === null || change === 0 ? "text-muted-foreground" : change > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
              {change === null ? "No previous baseline" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
            </span>
          </TableCell>
        </TableRow>
      })}</TableBody>
    </Table>
  </CostPanel>
}