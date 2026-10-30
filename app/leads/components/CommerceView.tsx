"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHeader } from "@/app/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { DocumentListHead, DocumentListRow, MoneyCell, StatusDot, documentListShellClassName } from "@/app/components/documents/document-list"
import { getLeadCommerce } from "../commerce-actions"
import { LEAD_COMMERCE_PAGE_SIZE, type LeadCommerceKind, type LeadCommerceResult } from "../commerce-types"

const sections: { value: LeadCommerceKind; label: string; description: string }[] = [
  { value: "quotations", label: "Quotations", description: "Quotes prepared for this customer." },
  { value: "purchases", label: "Purchases", description: "Customer orders placed with this workspace." },
  { value: "payments", label: "Payments", description: "Recorded payments by invoice allocation. Open an invoice to review its history." },
]

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString()
}

export function CommerceView({ leadId }: { leadId: string }) {
  const { currentSite } = useSite()
  const siteId = currentSite?.id
  const [kind, setKind] = useState<LeadCommerceKind>("quotations")
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loaded, setLoaded] = useState<{
    scope: string; result: LeadCommerceResult
  } | null>(null)
  const scope = JSON.stringify([siteId, leadId, kind, page, revision])
  const result = loaded?.scope === scope ? loaded.result : null
  const section = sections.find(item => item.value === kind)!

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ siteId: string; leadId: string }>).detail
      if (detail?.siteId === siteId && detail?.leadId === leadId) setRevision(value => value + 1)
    }
    window.addEventListener("lead:invoice-payment-recorded", refresh)
    return () => window.removeEventListener("lead:invoice-payment-recorded", refresh)
  }, [siteId, leadId])

  useEffect(() => {
    if (!siteId) return
    let cancelled = false
    void getLeadCommerce({ siteId, leadId, kind, page }).then(response => {
      if (!cancelled) setLoaded({ scope, result: response })
    }).catch(() => {
      if (!cancelled) setLoaded({ scope, result: { error: "Unable to load commerce. Please retry." } })
    })
    return () => { cancelled = true }
  }, [siteId, leadId, kind, page, scope])

  return (
    <section className="min-w-0 space-y-4" aria-label="Customer commerce">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Commerce</h2>
        <Button variant="ghost" size="sm" onClick={() => setRevision(value => value + 1)} disabled={!result}>Refresh</Button>
      </div>
      <Tabs value={kind} onValueChange={value => { setKind(value as LeadCommerceKind); setPage(1) }}>
        <TabsList className="h-8 max-w-full justify-start overflow-x-auto rounded-full bg-muted/30 p-0.5">
          {sections.map(item => <TabsTrigger key={item.value} value={item.value} className="h-7 rounded-full px-3 text-xs font-medium">{item.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      <p className="text-xs text-muted-foreground">{section.description}</p>
      {!siteId ? <p className="text-sm text-muted-foreground">Select a workspace to view commerce.</p> : !result ? (
        <div role="status" aria-label={`Loading ${section.label.toLowerCase()}`} className="space-y-3">
          {[0, 1, 2].map(value => <Skeleton key={value} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : result.error ? (
        <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm">
          <p>{result.error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setRevision(value => value + 1)}>Retry</Button>
        </div>
      ) : !result.rows?.length ? (
        <EmptyCard title={`No ${section.label.toLowerCase()} found`} description={`This lead has no ${section.label.toLowerCase()} on this page.`} variant="simple" showShadow={false} contentClassName="min-h-[180px] pb-6" />
      ) : (
        <div className={documentListShellClassName()}>
          <Table>
            <TableHeader><tr>
              <DocumentListHead>{kind === "payments" ? "Invoice" : "Document"}</DocumentListHead>
              <DocumentListHead>Date</DocumentListHead>
              <DocumentListHead align="right">Amount</DocumentListHead>
              <DocumentListHead>{kind === "payments" ? "Method" : "Status"}</DocumentListHead>
            </tr></TableHeader>
            <TableBody>{result.rows.map(row => (
              <DocumentListRow key={row.id} accent={row.amountDue ? "due" : "none"}>
                <TableCell className="px-4 py-3.5"><Link href={row.href} className="text-sm font-medium hover:underline focus-visible:underline">{row.title}</Link></TableCell>
                <TableCell className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">{dateLabel(row.date)}</TableCell>
                <TableCell className="px-4 py-3.5"><MoneyCell amountLabel={money(row.amount, row.currency)} dueLabel={row.amountDue ? `${money(row.amountDue, row.currency)} due` : null} /></TableCell>
                <TableCell className="px-4 py-3.5">{kind === "payments" ? <span className="text-xs text-muted-foreground capitalize">{row.method?.replaceAll("_", " ") || "Not specified"}</span> : <StatusDot status={row.status} label={row.status.replaceAll("_", " ")} />}</TableCell>
              </DocumentListRow>
            ))}</TableBody>
          </Table>
        </div>
      )}
      {result && !result.error && ((result.count || 0) > LEAD_COMMERCE_PAGE_SIZE || page > 1) && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{result.count} {section.label.toLowerCase()} · Page {page}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page * LEAD_COMMERCE_PAGE_SIZE >= (result.count || 0)} onClick={() => setPage(value => value + 1)}>Next</Button>
          </div>
        </div>
      )}
    </section>
  )
}