"use client"

import { BaseKpiWidget } from "./base-kpi-widget"
import { ReportDetails, ReportKpiGrid } from "./report-layout"
import { formatSalesChange, formatSalesMoney } from "@/lib/sales/report-format"
import type { SalesMetric, SalesReportData } from "@/lib/sales/report-types"

const paymentStatuses = [
  ["paid", "Paid"], ["partial", "Partially paid"], ["unpaid", "Unpaid"], ["unknown", "Unknown"],
] as const

function comparison(metric: SalesMetric) {
  return metric.percentChange === null ? formatSalesChange(null) : `${formatSalesChange(metric.percentChange)} from previous period`
}

function salesCount(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "sale" : "sales"}`
}

export function SalesFinancialSummary({ data }: { data: SalesReportData }) {
  const summary = data.financialSummary
  const money = (value: number) => formatSalesMoney(value, data.currency)
  const cash = (metric: SalesMetric | null | undefined) => metric == null ? "Unavailable" : money(metric.actual)
  const netCollected = summary?.netCollected

  return <>
    <ReportKpiGrid columns={3} aria-label="Sales financial summary">
      <BaseKpiWidget title="Net collected" value={cash(netCollected)} isLoading={false}
        tooltipText="Receipts minus refunds by each UTC movement date, including cash from older and cancelled sales."
        changeText={netCollected ? comparison(netCollected) : "Cash history unavailable"}
        customStatus={<div className="space-y-1">
          <p>{netCollected ? comparison(netCollected) : "Cash history unavailable"}</p>
          <p>Received: {cash(summary?.receipts)} · Refunded: {cash(summary?.refunds)}</p>
        </div>} />
      <BaseKpiWidget title="Active sales" value={money(data.totalSales.actual)} isLoading={false}
        tooltipText="Eligible pending and completed sale amounts, not cash received."
        changeText={comparison(data.totalSales)}
        customStatus={<div className="space-y-1">
          <p>{comparison(data.totalSales)}</p>
          <p>{salesCount(data.transactions.actual)} · Average sale: {money(data.averageOrderValue.actual)}</p>
        </div>} />
      <BaseKpiWidget title="Outstanding balance" value={summary?.outstanding.amount == null ? "Unavailable" : money(summary.outstanding.amount)}
        isLoading={false} changeText="Current balance; no period comparison"
        tooltipText="Current outstanding on active sales dated in the selected period, not a historical balance at the end date."
        customStatus={<div className="space-y-1">
          <p>Current balance; no period comparison</p>
          {summary ? <>
            <p>Selected-period active sales: {summary.outstanding.saleCount.toLocaleString("en-US")}</p>
            {summary.outstanding.unknownSaleCount > 0 && <p>{salesCount(summary.outstanding.unknownSaleCount)} with unknown balance</p>}
          </> : <p>Balance data unavailable</p>}
        </div>} />
    </ReportKpiGrid>
    <p className="text-sm text-muted-foreground">
      Cash received and refunded follow each UTC movement date in the selected period, including older and cancelled sales.
      Outstanding balance and payment status are current for active sales dated in the selected period, not a historical end-date balance.
    </p>
    {(!summary || !summary.receipts || !summary.refunds || !summary.netCollected || summary.cashIssues > 0) &&
      <p role="status" className="text-sm text-muted-foreground">
        {summary ? "Unavailable cash figures indicate incomplete history, not zero cash." : "Cash and balance data are unavailable in this response; sale amounts are not a substitute."}
        {summary && summary.cashIssues > 0 && ` Cash history issues: ${summary.cashIssues.toLocaleString("en-US")}.`}
      </p>}
    {summary?.outstanding.amount === null && <p className="text-sm text-muted-foreground">
      The full outstanding balance is unavailable because some sale balances are unknown; it is not zero.
    </p>}
    <ReportDetails summary="Current payment status and excluded sales">
      {summary ? <>
        <p>Payment status is current for active sales dated in the selected period. Amounts below are full sale amounts, not receipts or outstanding balances.</p>
        <dl aria-label="Current payment status" className="grid gap-2 sm:grid-cols-2">
          {paymentStatuses.map(([key, label]) => <div key={key}>
            <dt className="font-medium text-foreground">{label}</dt>
            <dd>{salesCount(summary.paymentStatus[key].count)} · {money(summary.paymentStatus[key].amount)}</dd>
          </div>)}
        </dl>
        <p>Excluded sales: {summary.excluded.count.toLocaleString("en-US")} · {money(summary.excluded.amount)} in sale amounts dated in the selected period.</p>
        <p>Cancelled, refunded and otherwise ineligible sales are excluded from active sales. Any linked cancelled order excludes the entire sale, even when other linked orders are active. Cash movements from excluded sales are still included on their movement dates.</p>
      </> : <p>Payment status and exclusion totals are unavailable in this response.</p>}
    </ReportDetails>
  </>
}