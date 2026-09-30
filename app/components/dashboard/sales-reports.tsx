"use client"

import { useState } from "react"
import { startOfDay, subDays } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { ReportLoading } from "@/app/dashboard/ReportLoading"
import { ReportDetails, ReportKpiGrid, ReportSection } from "./report-layout"
import { BaseKpiWidget } from "./base-kpi-widget"
import { SalesDistributionChart } from "./sales-distribution-chart"
import { MonthlySalesEvolutionChart } from "./monthly-sales-evolution-chart"
import { SalesBreakdownReport } from "./sales-breakdown-report"
import { useSalesReport } from "./sales/use-sales-report"
import { formatSalesChange, formatSalesMoney } from "@/lib/sales/report-format"
import type { SalesMetric, SalesReportSection } from "@/lib/sales/report-types"

export interface SalesReportsProps {
  startDate?: Date
  endDate?: Date
  segmentId?: string
  section?: SalesReportSection
  embedded?: boolean
}

export function SalesReports({ startDate, endDate, segmentId = "all", section, embedded = false }: SalesReportsProps) {
  const [fallback] = useState(() => ({ start: startOfDay(subDays(new Date(), 30)), end: new Date() }))
  const [currency, setCurrency] = useState("")
  const { data, error, isLoading, isValidating, mutate, enabled, invalidDates } = useSalesReport(
    startDate ?? fallback.start, endDate ?? fallback.end, segmentId, currency,
    section === undefined || section === "categories",
  )
  const availableCurrencies = error?.availableCurrencies?.length ? error.availableCurrencies : data?.availableCurrencies || []
  const currencyPicker = availableCurrencies.length > 1 || currency ? (
    <label className="flex items-center gap-2 text-sm">
      Currency
      <select aria-label="Sales currency" className="rounded-md border bg-background px-3 py-2" value={currency || data?.currency || ""}
        onChange={(event) => setCurrency(event.target.value)}>
        <option value="">Choose currency</option>
        {Array.from(new Set([...availableCurrencies, ...(currency ? [currency] : [])])).map((code) => (
          <option key={code} value={code}>{code === "UNSPECIFIED" ? "Currency unspecified" : code}</option>
        ))}
      </select>
    </label>
  ) : null

  // SWR retains the last error while a retry is in flight; pending takes precedence.
  if (isLoading || isValidating) return <ReportLoading report="sales" section={section} />
  if (invalidDates || !enabled) {
    return <Card><CardHeader><CardTitle>Sales report unavailable</CardTitle>
      <CardDescription>{invalidDates ? "Select a valid date range." : "Select a site and enable reports to view sales data."}</CardDescription>
    </CardHeader></Card>
  }
  // Never render a failed refresh as a successful empty report or silently show stale figures.
  if (error) {
    return <Card><CardHeader>
      <CardTitle>{error.status === 422 ? "Choose a sales currency" : "Sales report could not be loaded"}</CardTitle>
      <CardDescription role="alert">{error.message}</CardDescription>
    </CardHeader><CardContent className="flex flex-wrap items-center gap-3">
      {currencyPicker}
      <Button variant="outline" onClick={() => void mutate()} disabled={isValidating}>Retry</Button>
    </CardContent></Card>
  }
  if (!data) return <ReportLoading report="sales" section={section} />

  const money = (value: number) => formatSalesMoney(value, data.currency)
  const kpi = (title: string, value: SalesMetric, monetary = true) => (
    <BaseKpiWidget key={title} title={title} value={monetary ? money(value.actual) : value.actual}
      changeText={`${formatSalesChange(value.percentChange)} · previous period`}
      isPositiveChange={value.percentChange == null || value.percentChange === 0 ? undefined : value.percentChange > 0}
      isLoading={false} />
  )
  const showSummary = !section || section === "summary"
  const showChannels = !section || section === "channels"
  const showCategories = !section || section === "categories"

  return <ReportSection
    embedded={embedded}
    title={section === "channels" ? "Sales channels" : section === "categories" ? "Sales categories" : "Sales summary"}
    description={`${data.metadata.startDate} – ${data.metadata.endDate} · ${data.currency === "UNSPECIFIED" ? "Currency unspecified" : data.currency} · Confirmed sales, not cash received`}
    action={currencyPicker}>
    {data.noData && <div role="status" className="rounded-lg border border-dashed px-4 py-3 text-sm">
      <p className="font-medium">No sales in this period</p>
      <p className="mt-1 text-muted-foreground">No confirmed sales match this site, segment, date range and currency. Previous-period figures remain visible for comparison.</p>
    </div>}

    {showSummary && <ReportKpiGrid columns={3}>
      {kpi("Confirmed sales", data.totalSales)}
      {kpi("Transactions", data.transactions, false)}
      {kpi("Average sale value", data.averageOrderValue)}
    </ReportKpiGrid>}
    {showChannels && <>
      <ReportKpiGrid columns={3}>
        {Object.entries(data.channelSales).map(([key, value]) => kpi(
          key === "other" ? "Other / unassigned" : key === "online" ? "Online sales" : "Retail sales",
          { actual: value.amount, previous: value.prevAmount, percentChange: value.percentChange },
        ))}
      </ReportKpiGrid>
    </>}
    {(showSummary || showChannels) && <div className={showChannels
      ? "grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:[&>*]:row-span-2 xl:[&>*]:grid xl:[&>*]:grid-rows-subgrid xl:[&>*]:gap-y-0 [&>*]:min-w-0"
      : "min-w-0"}>
      <MonthlySalesEvolutionChart data={data.monthlyData} dailyData={data.dailyData}
        startDate={startDate ?? data.metadata.startDate} endDate={endDate ?? data.metadata.endDate}
        coverage={data.metadata.trendCoverage} currency={data.currency} byChannel={showChannels}
        showPeriod={!embedded} isLoading={false} dataReady />
      {showChannels && <SalesDistributionChart data={data.salesDistribution} currency={data.currency} isLoading={false} dataReady />}
    </div>}
    {showCategories && <>
      <p className="text-sm text-muted-foreground">{data.transactions.actual} transactions · {money(data.totalSales.actual)} this period · {money(data.totalSales.previous)} in the previous period.</p>
      <SalesBreakdownReport data={data.salesCategories} currency={data.currency} isLoading={false} dataReady />
    </>}
    <ReportDetails summary="Sales basis and comparisons">
      <p>{data.metadata.startDate} – {data.metadata.endDate}; compared with {data.metadata.prevStartDate} – {data.metadata.prevEndDate} (equal-length period).</p>
      <p>{data.metadata.basis}</p>
      <p>{data.metadata.dateBasis} Amounts: {data.currency === "UNSPECIFIED" ? "currency unspecified" : data.currency}; no currency conversion.</p>
      {showChannels && <p>Online includes online, shop and marketplace sources. Retail includes retail and POS; all other sources remain unassigned. Total: {money(data.totalSales.actual)} across {data.transactions.actual} transactions.</p>}
      {showCategories && <p>Category totals allocate sale amounts proportionally to top-level order item subtotals; sales without items use their product type or Uncategorized.</p>}
    </ReportDetails>
  </ReportSection>
}