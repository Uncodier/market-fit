"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ShoppingCart } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { SectionCard, SectionCardContent, SectionCardHeader } from "@/app/components/ui/section-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { summarizeCatalogSales, type CatalogSalesHistory } from "@/app/catalog/sales-history-types"

type Props = { catalogItemId: string; siteId: string }
type Result = { key: string; data?: CatalogSalesHistory; error?: string }
const PAGE_SIZE = 10
const DAY_MS = 86_400_000

export function CatalogSalesTab(props: Props) {
  // Remount all local data and filters at the tenant/item boundary, before effects run.
  return <SalesHistory key={JSON.stringify([props.siteId, props.catalogItemId])} {...props} />
}

function SalesHistory({ catalogItemId, siteId }: Props) {
  const { locale } = useLocalization()
  const [days, setDays] = useState(30)
  const [currency, setCurrency] = useState("")
  const [source, setSource] = useState("all")
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const startDate = new Date(Date.parse(today) - (days - 1) * DAY_MS).toISOString().slice(0, 10)
  const params = new URLSearchParams({ siteId, startDate, endDate: today })
  const url = `/api/catalog/${encodeURIComponent(catalogItemId)}/sales?${params}`
  const requestKey = JSON.stringify([url, retry])
  const loading = result?.key !== requestKey
  const data = !loading ? result?.data : undefined
  const error = !loading ? result?.error : undefined

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Unable to load sales history.")
        if (active) setResult({ key: requestKey, data: body as CatalogSalesHistory })
      } catch (cause) {
        if (active) setResult({ key: requestKey, error: cause instanceof Error ? cause.message : "Unable to load sales history." })
      }
    }
    void load()
    return () => { active = false; controller.abort() }
  }, [url, requestKey])

  const currencies = useMemo(() => [...new Set([
    ...(data?.availableCurrencies ?? []), ...(data?.rows.map(row => row.currency) ?? []),
  ])].sort(), [data])
  const selectedCurrency = currencies.includes(currency) ? currency : (currencies[0] ?? "")
  const sources = useMemo(() => [...new Set(data?.rows.map(row => row.source) ?? [])].sort(), [data])
  const selectedSource = source === "all" || sources.includes(source) ? source : "all"
  const rows = useMemo(() => (data?.rows ?? [])
    .filter(row => row.currency === selectedCurrency && (selectedSource === "all" || row.source === selectedSource))
    .sort((a, b) => b.date.localeCompare(a.date)), [data, selectedCurrency, selectedSource])
  const summary = useMemo(() => summarizeCatalogSales(rows), [rows])
  const trend = useMemo(() => {
    const byDay = new Map(summary.trend.map(day => [day.date, day]))
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.parse(startDate) + index * DAY_MS).toISOString().slice(0, 10)
      return byDay.get(date) ?? { date, revenue: 0, units: 0 }
    })
  }, [summary, days, startDate])
  const number = new Intl.NumberFormat(locale)
  const money = (amount: number) => {
    if (!selectedCurrency) return "—"
    if (selectedCurrency === "UNSPECIFIED") return `${number.format(amount)} (currency unspecified)`
    return new Intl.NumberFormat(locale, {
      style: "currency", currency: selectedCurrency, currencyDisplay: "code",
    }).format(amount)
  }
  const dateLabel = (date: string) => new Intl.DateTimeFormat(locale, {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(date))
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <SectionCard>
        <SectionCardHeader title="Sales" description="Paid and completed sales for this item and its direct child variants. Cancelled, refunded and draft orders, and cancelled or refunded lines, are excluded." />
        <SectionCardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium" id="sales-period-label">Period</p>
              <div role="group" aria-labelledby="sales-period-label" className="flex gap-2">
                {[30, 90, 365].map(value => (
                  <Button key={value} size="sm" variant={days === value ? "default" : "outline"}
                    aria-pressed={days === value} onClick={() => { setDays(value); setPage(1) }}>
                    {value} days
                  </Button>
                ))}
              </div>
            </div>
            <div className="w-40 space-y-2">
              <p className="text-sm font-medium">Currency</p>
              <Select value={selectedCurrency} disabled={loading || !currencies.length}
                onValueChange={value => { setCurrency(value); setPage(1) }}>
                <SelectTrigger aria-label="Currency"><SelectValue placeholder="No currency" /></SelectTrigger>
                <SelectContent>{currencies.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-44 space-y-2">
              <p className="text-sm font-medium">Source</p>
              <Select value={selectedSource} disabled={loading || !sources.length}
                onValueChange={value => { setSource(value); setPage(1) }}>
                <SelectTrigger aria-label="Source"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {sources.filter(Boolean).map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {dateLabel(startDate)} – {dateLabel(today)} (UTC). Sale date is used, falling back to creation date.
            {" "}Currencies are shown separately and never combined.
          </p>
          <p className="text-sm text-muted-foreground">
            Item revenue is the stored item subtotal: it includes line discounts, but not order-wide discounts,
            tax, shipping or refund allocations. It is not net collected cash.
          </p>
        </SectionCardContent>
      </SectionCard>

      {loading ? (
        <div role="status" aria-label="Loading sales history" className="space-y-6">
          <span className="sr-only">Loading sales history</span>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[0, 1, 2, 3].map(value => <Skeleton key={value} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : error ? (
        <SectionCard>
          <SectionCardContent className="pt-5">
            <div role="alert" className="space-y-2">
              <h3 className="font-semibold">Unable to load sales history</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={() => setRetry(value => value + 1)}>
              Retry
            </Button>
          </SectionCardContent>
        </SectionCard>
      ) : !rows.length ? (
        <EmptyCard variant="simple" icon={<ShoppingCart />} title="No sales found"
          description="No eligible sales match this period, currency and source. Try another filter or a longer period." />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["Item revenue", money(summary.revenue)], ["Units sold", number.format(summary.units)],
              ["Orders", number.format(summary.orders)], ["Average item price", money(summary.averagePrice)],
            ].map(([label, value]) => (
              <SectionCard key={label} className="p-5">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-2 text-xl font-semibold tabular-nums">{value}</dd>
              </SectionCard>
            ))}
          </dl>
          <SectionCard>
            <SectionCardHeader title="Item revenue trend" description={`Daily item revenue · ${selectedCurrency} · UTC`} />
            <SectionCardContent>
              <div role="img" aria-label={`Daily item revenue trend in ${selectedCurrency}`} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={dateLabel} minTickGap={45} />
                    <YAxis tickFormatter={value => number.format(Number(value))} />
                    <Tooltip labelFormatter={value => dateLabel(String(value))}
                      formatter={value => [money(Number(value)), "Item revenue"]} />
                    <Area type="linear" dataKey="revenue" stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))" fillOpacity={0.12} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCardContent>
          </SectionCard>
          <SectionCard>
            <SectionCardHeader title="Sales history" description="Newest sales first. Each row represents an order item." />
            <SectionCardContent>
              <Table>
                <TableHeader><TableRow>
                  {["Date (UTC)", "Order", "Item / variant", "Source", "Status", "Quantity", "Item revenue"].map(label => (
                    <TableHead key={label} className={label === "Quantity" || label === "Item revenue" ? "text-right" : ""}>{label}</TableHead>
                  ))}
                </TableRow></TableHeader>
                <TableBody>{visibleRows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{dateLabel(row.date)}</TableCell>
                    <TableCell><Link href={`/orders/${encodeURIComponent(row.orderId)}`} className="text-primary underline underline-offset-4">{row.orderNumber || row.orderId}</Link></TableCell>
                    <TableCell>{row.itemName}</TableCell>
                    <TableCell>{row.source || "—"}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="text-right tabular-nums">{number.format(row.quantity)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{money(row.revenue)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Page {number.format(currentPage)} of {number.format(pageCount)} · {number.format(rows.length)} items
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
                </div>
              </div>
            </SectionCardContent>
          </SectionCard>
        </>
      )}
    </div>
  )
}