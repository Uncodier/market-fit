"use client"

import { useState, type ReactNode } from "react"
import { format } from "date-fns"
import { useSite } from "@/app/context/SiteContext"
import { useDashboardOverview } from "@/app/hooks/use-dashboard-batches"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { ReportDataProvider, useReportDataContext } from "./ReportDataContext"

type Filters = { startDate: Date; endDate: Date; segmentId: string }

function CurrencySelector({ filters, currency, onChange }: {
  filters: Filters
  currency?: string
  onChange: (currency: string) => void
}) {
  const { data, error, isLoading, isValidating } = useDashboardOverview(filters.startDate, filters.endDate, filters.segmentId)
  if (isLoading || isValidating) return null
  const errorCurrencies = (error as Error & { availableCurrencies?: string[] } | undefined)?.availableCurrencies
  const available = data?.revenue?.availableCurrencies ?? errorCurrencies
  const currencies = Array.isArray(available) ? available.filter((value): value is string => typeof value === "string") : []
  if (currencies.length < 2) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-4">
      <label htmlFor="overview-currency" className="text-sm font-medium">Reporting currency</label>
      <Select value={currency ?? ""} onValueChange={onChange}>
        <SelectTrigger id="overview-currency" className="w-48"><SelectValue placeholder="Select a currency" /></SelectTrigger>
        <SelectContent>
          {currencies.map(value => <SelectItem key={value} value={value}>{value === "UNSPECIFIED" ? "Unspecified currency" : value}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">Sales totals are never combined across currencies. No exchange-rate conversion is applied.</p>
    </div>
  )
}

export function OverviewCurrencyScope({ enabled, children, ...filters }: Filters & { enabled: boolean; children: ReactNode }) {
  const { currentSite } = useSite()
  const groups = useReportDataContext()
  const scope = `${currentSite?.id}:${filters.segmentId}:${format(filters.startDate, "yyyy-MM-dd")}:${format(filters.endDate, "yyyy-MM-dd")}`
  const [selection, setSelection] = useState<{ scope: string; currency: string }>()
  const currency = selection?.scope === scope ? selection.currency : undefined
  if (!enabled) return <>{children}</>
  return (
    <ReportDataProvider value={{ ...groups, currency }}>
      <CurrencySelector filters={filters} currency={currency} onChange={(value) => setSelection({ scope, currency: value })} />
      {children}
    </ReportDataProvider>
  )
}