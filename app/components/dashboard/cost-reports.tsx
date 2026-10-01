"use client"

import { useSite } from "@/app/context/SiteContext"
import { useState } from "react"
import { format, isValid } from "date-fns"
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { CostReportCategories, CostReportDistribution, CostReportTrend } from "./cost-report-visuals"
import { marketingFromCategories, overheadFromCategories } from "@/lib/costs/aggregate-costs"
import { costCurrency, costEfficiency, formatCost, percentChange } from "./cost-report-data"
import { ReportRequestError, SocialCostReportScope } from "./social-cost-report-state"
import { useCostReport } from "./use-cost-report"
import { ReportCurrencySelect } from "./report-currency-select"
import { ReportLoading } from "@/app/dashboard/ReportLoading"
import { ReportDetails, ReportKpiGrid, ReportSection } from "./report-layout"

interface CostReportsProps {
  startDate?: Date
  endDate?: Date
  segmentId?: string
  campaignId?: string
  section?: "summary" | "categories"
  embedded?: boolean
}

function comparison(change: number | null) {
  return change === null ? "No previous baseline" : `${change.toFixed(1)}% from previous period`
}

export function CostReports(props: CostReportsProps) {
  return <SocialCostReportScope><CostReportContent {...props} /></SocialCostReportScope>
}

function CostReportContent({ startDate: start, endDate: end, segmentId = "all", campaignId = "all", section = "summary", embedded = false }: CostReportsProps) {
  const { currentSite } = useSite()
  const showSummary = section === "summary"
  const showCategories = section === "categories"
  const day = (value?: Date) => value && isValid(value) ? format(value, "yyyy-MM-dd") : "default"
  const scope = `${currentSite?.id}:${segmentId}:${campaignId}:${day(start)}:${day(end)}`
  const [selection, setSelection] = useState<{ scope: string; currency: string }>()
  const currency = selection?.scope === scope ? selection.currency : ""
  const { costs, revenue, enabled, invalidDates, startDate, endDate } = useCostReport(
    currentSite?.id, start, end, segmentId, campaignId, showSummary, currency,
  )
  const data = costs.error ? undefined : costs.data
  const sales = revenue.error ? undefined : revenue.data
  const categories = data?.costCategories ?? []
  const marketing = marketingFromCategories(categories)
  const overhead = overheadFromCategories(categories)
  const efficiency = costEfficiency(data, sales, campaignId)
  const totalChange = data ? percentChange(data.totalCosts.actual, data.totalCosts.previous) : null
  const marketingChange = data ? percentChange(marketing.amount, marketing.prevAmount) : null
  const overheadChange = data ? percentChange(overhead.amount, overhead.prevAmount) : null
  const isLoading = costs.isLoading || costs.isValidating
  const isEfficiencyLoading = isLoading || revenue.isLoading || revenue.isValidating
  const dates = { startDate, endDate }
  const currencies = costs.error?.availableCurrencies ?? data?.availableCurrencies ?? []
  const currencyPicker = currencies.length > 1 || currency ? <ReportCurrencySelect label="Cost currency"
    value={currency || data?.currency || ""} currencies={Array.from(new Set([...currencies, ...(currency ? [currency] : [])]))}
    onChange={value => setSelection({ scope, currency: value })} /> : null

  if (isLoading) return <ReportLoading report="costs" section={section} />
  if (invalidDates) return <p role="alert">Select a valid date range to view cost reports.</p>
  if (!enabled) return <p className="text-sm text-muted-foreground">Select a site to view cost reports.</p>
  if (costs.error?.status === 422 && currencies.length) return (
    <div role="status" className="rounded-lg border bg-background p-6 space-y-3">
      <h2 className="font-semibold">Choose a cost currency</h2>
      <p className="text-sm text-muted-foreground">Costs have different currency labels. Choose one to view totals and comparisons without mixing amounts.</p>
      {currencyPicker}
    </div>
  )
  if (costs.error) return (
    <ReportRequestError title="Unable to load cost report"
      description={costs.error.message || "Cost data could not be loaded. Missing costs are not zero costs."}
      retry={() => { void costs.mutate() }} retryLabel="Retry cost report" retrying={costs.isValidating} />
  )
  if (!data) return <ReportLoading report="costs" section={section} />

  return (
    <ReportSection embedded={embedded} title={section === "categories" ? "Cost categories" : "Cost summary"}
      description={`${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")} · ${costCurrency(data.currency) ?? "Currency unspecified"} · Recorded costs`}
      action={currencyPicker}>
      {data.noData && <p role="status" className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        No costs match the selected period and filters. Previous-period figures and the six-month context remain available.
      </p>}
      {showSummary && <>
        <ReportKpiGrid>
          <BaseKpiWidget title="Total Costs" value={data ? formatCost(data.totalCosts.actual, data.currency) : null}
            changeText={comparison(totalChange)} isPositiveChange={totalChange === null ? undefined : totalChange < 0}
            isLoading={isLoading} {...dates} />
          <BaseKpiWidget title="Marketing Costs" value={data ? formatCost(marketing.amount, data.currency) : null}
            changeText={comparison(marketingChange)} isPositiveChange={marketingChange === null ? undefined : marketingChange < 0}
            isLoading={isLoading} {...dates} />
          <BaseKpiWidget title="Efficiency Ratio" value={efficiency.ratio === null ? "Unavailable" : `${efficiency.ratio.toFixed(1)}:1`}
            tooltipText="Active sales (eligible pending and completed amounts), not cash received, divided by costs. Cancelled/refunded sales and sales linked to any cancelled order are excluded. Requires matching currency and filter scopes."
            changeText={efficiency.ratio === null ? efficiency.reason : comparison(efficiency.change)}
            isPositiveChange={efficiency.change === null ? undefined : efficiency.change > 0}
            isLoading={isEfficiencyLoading} {...dates} />
          <BaseKpiWidget title="Overhead Costs" value={data ? formatCost(overhead.amount, data.currency) : null}
            changeText={comparison(overheadChange)} isPositiveChange={overheadChange === null ? undefined : overheadChange < 0}
            isLoading={isLoading} {...dates} />
        </ReportKpiGrid>
        <div className="grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:[&>*]:row-span-2 xl:[&>*]:grid xl:[&>*]:grid-rows-subgrid xl:[&>*]:gap-y-0 [&>*]:min-w-0">
          <CostReportTrend data={data.monthlyData} currency={data.currency} isLoading={false} dataReady
            startDate={startDate} endDate={endDate} />
          <CostReportDistribution data={data.costDistribution} currency={data.currency} isLoading={false} dataReady />
        </div>
        {revenue.error && !isEfficiencyLoading && <ReportRequestError title="Unable to load sales for the efficiency ratio"
          description={revenue.error.status === 422
            ? "Sales use multiple currencies. The efficiency ratio is unavailable; cost data remains available."
            : "Sales data could not be loaded. The efficiency ratio is unavailable; cost data remains available."}
          retry={() => { void revenue.mutate() }} retryLabel="Retry sales data" retrying={revenue.isValidating} />}
      </>}
      {showCategories && <CostReportCategories data={categories} currency={data?.currency} isLoading={isLoading} dataReady={!!data} />}
      <ReportDetails summary="Cost basis and comparisons">
        {data.metadata?.prevStartDate && data.metadata.prevEndDate && <p>
          Compared with {data.metadata.prevStartDate.slice(0, 10)} – {data.metadata.prevEndDate.slice(0, 10)}
          {data.metadata.days ? ` (${data.metadata.days} calendar days)` : ""}. No currency conversion is applied.
        </p>}
        {!costCurrency(data.currency) ? <p>
          Cost currency is not supplied by the source. Amounts are shown as recorded, without currency conversion; cross-currency comparisons are unavailable.
        </p> : <p>Amounts are recorded in {data.currency}; no currency conversion is applied.</p>}
        {showSummary && <p>Efficiency is active sales (eligible pending and completed amounts), not cash received, divided by costs. Cancelled/refunded sales and sales linked to any cancelled order are excluded. It requires matching currency and filter scopes. Marketing includes grouped marketing categories; overhead includes Administration and Operations.</p>}
      </ReportDetails>
    </ReportSection>
  )
}