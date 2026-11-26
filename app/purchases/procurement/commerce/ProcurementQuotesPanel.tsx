"use client"

import { detailViewHref } from "@/lib/navigation/detail-view-navigation"
import { useEffect, useState } from "react"
import { useRouter } from 'next/navigation'
import { QuotesTable, QuotesTableSkeleton } from '@/app/components/documents/quotes-table'
import { receivedQuotationRows } from './received-quotations'
import { QuotationEnvelopes, type QuotationEnvelope } from './QuotationEnvelopes'
import { Button } from "@/app/components/ui/button"
import type { ProcurementQuotation } from "./contracts"
import { RecordQuotationDialog, type QuotationDraft } from './record-quotation-dialog'
import { useProcurementScopeKey } from '../components/use-procurement-scope-key'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { ProcurementToolbar } from '../ui/workspace'
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import { Plus } from "@/app/components/ui/icons"
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { isProcurementDemo as isDemoSiteId } from '../ui/is-demo'
import { demoProcurementQuotes, demoQuotationEnvelopes } from '@/lib/demo-data/procurement-commerce'
import { ProcurementDemoNotice } from '../ui/demo-notice'

const base = "/api/procurement/commerce"
type QuotesPanelProps = { siteId: string; tenderId?: string; embedded?: boolean }
export function ProcurementQuotesPanel(props: QuotesPanelProps) {
  const demo = isDemoSiteId(props.siteId)
  const scope = useProcurementScopeKey(props.siteId)
  return <QuotesContent key={`${scope}:${props.tenderId ?? ''}`} {...props} demo={demo} />
}

function QuotesContent({ siteId, tenderId, embedded = false, demo }: QuotesPanelProps & { demo: boolean }) {
  const { t, message } = useProcurementI18n()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<QuotationDraft>()
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [quotes, setQuotes] = useState<ProcurementQuotation[]>(() => demo ? demoProcurementQuotes.filter(quote => !tenderId || quote.tender_id === tenderId) : [])
  const [envelopes, setEnvelopes] = useState<QuotationEnvelope[]>(() => demo ? demoQuotationEnvelopes.filter(envelope => !tenderId || envelope.tender_id === tenderId) : [])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(!demo)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    if (demo) return
    const controller = new AbortController()
    // Personal buyer quotations have no buyer-site association and do not belong in this workspace.
    fetch(`${base}/quotes?site_id=${encodeURIComponent(siteId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || "Procurement could not be loaded")
        return body
      }).then(quotationResult => {
        if (controller.signal.aborted) return
        setQuotes((quotationResult.data ?? []).filter((quote: ProcurementQuotation) => !tenderId || quote.tender_id === tenderId))
        setEnvelopes((quotationResult.envelopes ?? []).filter((envelope: QuotationEnvelope) => !tenderId || envelope.tender_id === tenderId))
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, tenderId, generation, demo])

  const shownError = error === 'Procurement could not be loaded' ? t('procurement.partners.errors.procurementLoad') : message(error)
  const rows = receivedQuotationRows(quotes, [], t).filter(row =>
    (status === 'all' || row.status === status) && `${row.entityName} ${row.reference ?? row.id} ${row.tenderTitle ?? ''} ${row.sourceLabel ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  const recordButton = <Button variant={embedded ? 'outline' : 'default'} size={embedded ? 'sm' : 'default'} disabled={loading || !!error} onClick={() => setEditing(true)}>{embedded && <Plus className="mr-2 h-4 w-4" aria-hidden={true} />}{t('procurement.partners.quotes.external')}</Button>
  const toolbar = <ProcurementToolbar statuses={[{ value: 'all', label: t('procurement.partners.quotes.all') }, { value: 'sent', label: t('procurement.partners.quotes.pending') }, { value: 'accepted', label: t('buyer.quotes.filters.accepted') }]}
    status={status} onStatus={value => { setStatus(value); setPage(1) }} search={search} onSearch={embedded ? undefined : value => { setSearch(value); setPage(1) }} placeholder={t('procurement.partners.commerce.search')} />
  return <section className={embedded ? 'space-y-4' : 'flex h-[calc(100dvh-var(--topbar-height,64px))] w-full min-w-0 flex-1 flex-col bg-muted/30'} aria-label={t('procurement.workflow.tender.receivedQuotes')}>
    {embedded ? <header className="flex w-full flex-wrap items-center gap-3">
      <h3 className="text-lg font-semibold">{t('procurement.workflow.tender.receivedQuotes')}</h3><div className="ml-auto shrink-0">{recordButton}</div>
    </header> : <TopBarPrimaryActions>{recordButton}</TopBarPrimaryActions>}
    {!embedded && <StickyHeader>{toolbar}</StickyHeader>}
    <div className={embedded ? 'space-y-4' : 'min-h-0 min-w-0 flex-1 space-y-6 overflow-auto p-4 md:p-6 lg:p-8'}>
    {demo && <ProcurementDemoNotice />}
    {error && <p role="alert" className="text-destructive">{shownError}</p>}
    {!error && !loading && <QuotationEnvelopes envelopes={envelopes} />}
    {!error && (loading ? <QuotesTableSkeleton /> : (embedded || rows.length > 0 || envelopes.length === 0) && <QuotesTable rows={rows.slice((page - 1) * 50, page * 50)} page={page} pageSize={50} totalCount={rows.length}
      keepEmptyTable={embedded} showTenderBadge={!tenderId} toolbar={embedded ? toolbar : undefined}
      entityColumnLabel={t('procurement.workflow.common.supplier')} emptyTitle={t(envelopes.length ? 'procurement.partners.quotes.noOpened' : 'procurement.partners.quotes.empty')} emptyDescription=""
      onPageChange={setPage} onRowClick={id => router.push(detailViewHref(siteId, "/purchases/quotes", id, rows))} />)}
    </div>
    {editing && <RecordQuotationDialog siteId={siteId} tenderId={tenderId} initial={draft}
      onClose={next => { setDraft(next); setEditing(false) }}
      onRecorded={() => { setDraft(undefined); setEditing(false); setLoading(true); setGeneration(value => value + 1) }} />}
  </section>
}