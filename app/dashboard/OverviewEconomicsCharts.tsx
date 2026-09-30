"use client"

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { formatSalesMoney } from "@/lib/sales/report-format"
import type { buildOverviewEconomics, EconomicsBar } from "./overview-economics-data"
import { ReportChartFrame } from "@/app/components/dashboard/report-chart-frame"

export function economicsAmount(value: number, currency: string, compact = false) {
  return currency === "UNSPECIFIED"
    ? value.toLocaleString("en-US", { maximumFractionDigits: compact ? 1 : 2, ...(compact ? { notation: "compact" } : {}) })
    : formatSalesMoney(value, currency, compact)
}

function ComparisonChart({ rows, currency, label }: { rows: EconomicsBar[]; currency: string; label: string }) {
  return <>
    <ReportChartFrame className="h-56 min-w-0 sm:h-64" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 12, bottom: 8, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="currentColor" opacity={0.1} strokeDasharray="3 3" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "currentColor" }} tickMargin={12} />
          <YAxis axisLine={false} tickLine={false} width={64} tick={{ fontSize: 11, fill: "currentColor" }}
            tickFormatter={value => economicsAmount(Number(value), currency, true)} />
          <Tooltip cursor={{ fill: "currentColor", opacity: 0.05 }}
            formatter={(value: number) => [economicsAmount(value, currency), "Amount"]}
            contentStyle={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))", borderRadius: 8 }} />
          <Bar dataKey="value" maxBarSize={88} radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {rows.map(row => <Cell key={row.name} fill={row.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ReportChartFrame>
    <dl className="mt-3 grid grid-cols-2 gap-3 border-t pt-4">
      {rows.map(row => <div key={row.name} className="min-w-0">
        <dt className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />{row.name}
        </dt>
        <dd className="mt-1 text-base font-semibold tabular-nums break-words">{economicsAmount(row.value, currency)}</dd>
      </div>)}
    </dl>
  </>
}

export function OverviewEconomicsCharts({ model }: { model: ReturnType<typeof buildOverviewEconomics> }) {
  return <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" data-testid="economics-analysis">
    <Card className="min-w-0 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Customer value & acquisition cost</CardTitle>
        <CardDescription>Compare the reported estimates, not a lifetime forecast.</CardDescription>
      </CardHeader>
      <CardContent>
        {model.valueBars.length ? <ComparisonChart rows={model.valueBars} currency={model.valueCurrency}
          label="Reported customer value and acquisition cost comparison" />
          : <ReportChartFrame minimumHeight={256} className="flex min-h-64 items-center justify-center text-center text-sm text-muted-foreground">
            {!model.matchingCurrency ? "A comparison needs matching reported currencies." : "Customer value and acquisition cost are not available for this selection."}
          </ReportChartFrame>}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Source currency labels are unverified. Periods and customer populations may differ; no LTV:CAC ratio is inferred.</p>
      </CardContent>
    </Card>
    <Card className="min-w-0 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">What drives the return?</CardTitle>
        <CardDescription>Revenue and the cost baseline used for the return calculation.</CardDescription>
      </CardHeader>
      <CardContent>
        {model.returnBars.length ? <ComparisonChart rows={model.returnBars} currency={model.returnCurrency}
          label="Recorded revenue and return cost baseline comparison" />
          : <ReportChartFrame minimumHeight={256} className="flex min-h-64 items-center justify-center text-center text-sm text-muted-foreground">
            A return cannot be measured without revenue and a positive cost baseline.
          </ReportChartFrame>}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {model.costLabel === "Campaign budget" ? "Budget is a planning estimate, not verified spend. " : "Uses the source's transaction-cost total. "}
          {model.returnCurrency === "UNSPECIFIED" ? "Currency is unspecified by this source; amounts are not converted." : `Reported in ${model.returnCurrency}; no currency conversion.`}
        </p>
      </CardContent>
    </Card>
  </div>
}