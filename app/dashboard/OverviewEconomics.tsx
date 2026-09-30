"use client"

import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { useDashboardOverview } from "@/app/hooks/use-dashboard-batches"
import { buildOverviewEconomics } from "./overview-economics-data"
import { OverviewEconomicsCharts, economicsAmount } from "./OverviewEconomicsCharts"
import { ReportLoading } from "./ReportLoading"
import { ReportDetails, ReportKpiGrid } from "@/app/components/dashboard/report-layout"

export function OverviewEconomics({ startDate, endDate, segmentId }: {
  startDate: Date; endDate: Date; segmentId: string
}) {
  const { data, isLoading } = useDashboardOverview(startDate, endDate, segmentId)
  const model = buildOverviewEconomics(data)
  if (isLoading || !data) return <ReportLoading />

  return <div className="space-y-5">
    <ReportKpiGrid aria-label="Unit economics summary">
      {([
        ["Customer value", model.ltv], ["Acquisition cost", model.cac], ["Cost per lead", model.cpl],
      ] as const).map(([title, metric]) => <BaseKpiWidget key={title} title={title}
        value={metric.value === null ? null : economicsAmount(metric.value, metric.currency)}
        changeText={metric.value === null ? "Insufficient observations" : metric.currency === "UNSPECIFIED" ? `${metric.note} · currency unspecified` : metric.note}
        tooltipText={metric.currency === "UNSPECIFIED" ? "The source does not report a currency. Amounts are shown as recorded." : `Source labels amounts ${metric.currency}; no currency conversion is applied.`}
        isLoading={false} className="shadow-none" />)}
      <BaseKpiWidget title="Return on recorded cost" value={model.roi === null ? null : `${model.roi.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`}
        changeText={model.returnNote} isLoading={false} className="shadow-none"
        tooltipText="(Recorded revenue − cost baseline) ÷ cost baseline. No return is inferred when costs are missing." />
    </ReportKpiGrid>
    <OverviewEconomicsCharts model={model} />
    <ReportDetails summary="Sources, formulas & limitations">
      <div className="mt-3 grid gap-4 leading-relaxed md:grid-cols-2">
        <div className="space-y-2">
          <p>Customer value is the legacy LTV endpoint&apos;s purchase/revenue-per-customer estimate, not an observed lifetime forecast. That source can expand the requested dates to calendar periods and use average sale value when customer identity is missing.</p>
          <p>Acquisition cost uses recorded transaction costs or a campaign-budget fallback. Cost per lead uses recorded costs divided by created leads; no leads means unavailable, not zero cost per lead.</p>
        </div>
        <div className="space-y-2">
          <p>The return chart uses the revenue and cost totals supplied by the ROI source. Its sales basis includes all statuses, unlike the active-sales total in Summary, and does not represent cash received.</p>
          <p>LTV and CAC label amounts USD without validating the underlying record currencies. These sources do not provide an auditable historical series or normalized currency basis. Charts show reported snapshots only. No history, currency conversion or cross-metric ratio is fabricated.</p>
        </div>
      </div>
    </ReportDetails>
  </div>
}