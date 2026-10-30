"use client"

import { useEffect, useState } from "react"
import { useRouter } from 'next/navigation'
import { QuotesTable, QuotesTableSkeleton } from '@/app/components/documents/quotes-table'
import { receivedQuotationRows } from './received-quotations'
import { QuotationEnvelopes, type QuotationEnvelope } from './QuotationEnvelopes'
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import type { ImportOption, ProcurementQuotation } from "./contracts"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { DialogForm, DialogBody, DialogFooter } from "@/app/components/ui/dialog"
import { DocumentDialog } from "./document-ui"
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { ProcurementToolbar } from '../ui/workspace'
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import { FileText, Plus } from "@/app/components/ui/icons"
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { isProcurementDemo as isDemoSiteId } from '../ui/is-demo'
import { demoProcurementQuotes, demoImportOptions, demoQuotationEnvelopes } from '@/lib/demo-data/procurement-commerce'
import { ProcurementDemoNotice } from '../ui/demo-notice'

const base = "/api/procurement/commerce"
type QuotesPanelProps = { siteId: string; tenderId?: string; embedded?: boolean }
export function ProcurementQuotesPanel(props: QuotesPanelProps) {
  return <QuotesContent key={`${props.siteId}:${props.tenderId ?? ''}`} {...props} />
}

function QuotesContent({ siteId, tenderId, embedded = false }: QuotesPanelProps) {
  const demo = isDemoSiteId(siteId)
  const { t, message, formatNumber } = useProcurementI18n()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState("all")
  const [search, setSearch] = useState("")
  const [quotes, setQuotes] = useState<ProcurementQuotation[]>(() => demo ? demoProcurementQuotes.filter(quote => !tenderId || quote.tender_id === tenderId) : [])
  const [envelopes, setEnvelopes] = useState<QuotationEnvelope[]>(() => demo ? demoQuotationEnvelopes.filter(envelope => !tenderId || envelope.tender_id === tenderId) : [])
  const [options, setOptions] = useState<ImportOption[]>(() => demo ? demoImportOptions.filter(option => !tenderId || option.tender_id === tenderId) : [])
  const [tender, setTender] = useState("")
  const [supplier, setSupplier] = useState("")
  const [reference, setReference] = useState("")
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!demo)
  const [generation, setGeneration] = useState(0)
  const [retryKey, setRetryKey] = useState<string | null>(null)
  const option = options.find(item => item.tender_id === tender)

  useEffect(() => {
    if (demo) return
    const controller = new AbortController()
    // Personal buyer quotations have no buyer-site association and do not belong in this workspace.
    Promise.all(["quotes", "options"].map(async path => {
      const response = await fetch(`${base}/${path}?site_id=${encodeURIComponent(siteId)}`, { signal: controller.signal, cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Procurement could not be loaded")
      return body
    })).then(([quotationResult, optionResult]) => {
      if (controller.signal.aborted) return
      const rows = quotationResult.data
      const choices = optionResult.data
      setQuotes((rows ?? []).filter((quote: ProcurementQuotation) => !tenderId || quote.tender_id === tenderId))
      setEnvelopes((quotationResult.envelopes ?? []).filter((envelope: QuotationEnvelope) => !tenderId || envelope.tender_id === tenderId))
      const eligible = (choices ?? []).filter((item: ImportOption) => !tenderId || item.tender_id === tenderId)
      setOptions(eligible)
      if (tenderId) setTender(tenderId)
    })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, tenderId, generation, demo])

  async function record() {
    if (demo) return
    if (!option) return
    const lines = option.requirements.map(line => ({ requirement_id: line.id, unit_net_minor: Number(prices[line.id]) }))
    if (option.requirements.some(line => !/^\d+$/.test(prices[line.id] ?? "")) || lines.some(line => !Number.isSafeInteger(line.unit_net_minor))) {
      setError("Enter each unit price as a whole number of minor currency units (for example, 1234 for 12.34).")
      return
    }
    setBusy(true); setError("")
    const key = retryKey ?? crypto.randomUUID()
    setRetryKey(key)
    try {
      const response = await fetch(`${base}/quotes?site_id=${encodeURIComponent(siteId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: supplier, tender_id: tender, publication_id: option.publication_id,
          reference, lines, idempotency_key: key }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Quotation could not be recorded")
      setTender(""); setSupplier(""); setReference(""); setPrices({}); setRetryKey(null)
      setEditing(false); setGeneration(value => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Quotation could not be recorded") }
    finally { setBusy(false) }
  }

  const shownError = error === 'Enter each unit price as a whole number of minor currency units (for example, 1234 for 12.34).' ? t('procurement.partners.quotes.priceError')
    : error === 'Quotation could not be recorded' ? t('procurement.partners.errors.quoteRecord')
    : error === 'Procurement could not be loaded' ? t('procurement.partners.errors.procurementLoad') : message(error)
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
      onPageChange={setPage} onRowClick={id => router.push(`/purchases/quotes/${encodeURIComponent(id)}`)} />)}
    </div>
    <DocumentDialog open={editing} onClose={() => setEditing(false)} busy={busy} title={t('procurement.partners.quotes.recordTitle')} description={t('procurement.partners.quotes.recordHint')}>
      <DialogForm onSubmit={event => { event.preventDefault(); if (!busy && supplier && reference.trim()) void record() }}><DialogBody>
        {demo && <ProcurementDemoNotice />}
        <p className="my-3 text-sm">{t('procurement.partners.quotes.eligibleHint')}</p>
        {options.length === 0 ? <EmptyCard title={t('procurement.partners.quotes.noTender')} description="" icon={<FileText size={24} />}
          showShadow={false} showHint={false} contentClassName="min-h-[180px] py-6" /> : <div className="space-y-3 pt-3">
          <RelationSelect label={t('procurement.partners.quotes.tender')} allowCreate={false} disabled={busy || !!retryKey}
            searchPlaceholder={t('procurement.common.search')}
            clearLabel={t('procurement.common.clearSelection')} loadingLabel={t('procurement.common.loadingSelection')}
            placeholder={t('procurement.partners.quotes.searchTender')} emptyMessage={t('procurement.partners.quotes.noTender')}
            options={options.map(item => ({ id: item.tender_id, label: item.title }))}
            value={option ? { mode: 'existing', id: tender, label: option.title } : null}
            onValueChange={value => { setTender(value?.mode === 'existing' ? value.id : ''); setSupplier(''); setPrices({}) }} />
          {option && <>
            <RelationSelect label={t('procurement.partners.quotes.invitedSupplier')} allowCreate={false} disabled={busy || !!retryKey}
              searchPlaceholder={t('procurement.common.search')}
              clearLabel={t('procurement.common.clearSelection')} loadingLabel={t('procurement.common.loadingSelection')}
              placeholder={t('procurement.partners.suppliers.search')} emptyMessage={t('procurement.partners.suppliers.empty')}
              options={option.suppliers.map(item => ({ id: item.id, label: item.name }))}
              value={supplier ? { mode: 'existing', id: supplier, label: option.suppliers.find(item => item.id === supplier)?.name ?? supplier } : null}
              onValueChange={value => setSupplier(value?.mode === 'existing' ? value.id : '')} />
            <Label htmlFor="commerce-reference">{t('procurement.partners.quotes.reference')}</Label>
            <Input id="commerce-reference" value={reference} maxLength={120} disabled={busy || !!retryKey} onChange={event => setReference(event.target.value)} />
            {option.requirements.map(line => <div key={line.id}>
              <Label htmlFor={`price-${line.id}`}>{t('procurement.partners.quotes.priceLabel', { description: line.description, quantity: formatNumber(line.quantity), unit: line.unit, currency: option.currency })}</Label>
              <Input id={`price-${line.id}`} inputMode="numeric" value={prices[line.id] ?? ""} disabled={busy || !!retryKey}
                onChange={event => setPrices(current => ({ ...current, [line.id]: event.target.value }))} />
            </div>)}

            {retryKey && <p className="text-sm">{t('procurement.partners.quotes.retryHint')}</p>}
          </>}
        </div>}
      {error && <p role="alert" className="text-destructive">{shownError}</p>}
      </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(false)}>{t('procurement.partners.actions.closeDraft')}</Button><Button type="submit" disabled={demo || busy || !supplier || !reference.trim()}>{t(busy ? 'procurement.partners.actions.recording' : retryKey ? 'procurement.partners.quotes.retry' : 'procurement.partners.quotes.record')}</Button></DialogFooter></DialogForm>
    </DocumentDialog>
  </section>
}