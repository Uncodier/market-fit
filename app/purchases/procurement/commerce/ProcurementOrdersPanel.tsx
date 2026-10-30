"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { DialogForm, DialogBody, DialogFooter } from "@/app/components/ui/dialog"
import { DocumentDialog } from "./document-ui"
import { ProcurementOrdersList, ProcurementOrdersToolbar, acceptanceStatus, orderReference } from "./procurement-orders-list"
import { useMobileView } from '@/app/hooks/use-mobile-view'
import type { ProcurementOrder } from "./contracts"
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { isProcurementDemo as isDemoSiteId } from '../ui/is-demo'
import { demoProcurementOrders } from '@/lib/demo-data/procurement-commerce'
import { ProcurementDemoNotice } from '../ui/demo-notice'

export function ProcurementOrdersPanel({ siteId, navigation }: { siteId: string; navigation?: ReactNode }) {
  return <OrdersContent key={siteId} siteId={siteId} navigation={navigation} />
}

function OrdersContent({ siteId, navigation }: { siteId: string; navigation?: ReactNode }) {
  const { t, message } = useProcurementI18n()
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('newest')
  const [view, setView] = useMobileView('kanban')
  const [orders, setOrders] = useState<ProcurementOrder[]>(() => isDemoSiteId(siteId) ? demoProcurementOrders : [])
  const [error, setError] = useState("")
  const [isLoading, setLoading] = useState(true)
  const loading = !isDemoSiteId(siteId) && isLoading
  const [generation, setGeneration] = useState(0)
  useEffect(() => {
    if (isDemoSiteId(siteId)) return
    const controller = new AbortController()
    fetch(`/api/procurement/commerce/orders?site_id=${encodeURIComponent(siteId)}`, { signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Orders could not be loaded"); return body.data })
      .then(data => { if (!controller.signal.aborted) { setOrders(data ?? []); setError("") } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, generation])
  const rows = orders.filter(order => `${order.supplier_name} ${orderReference(order, siteId)}`.toLowerCase().includes(search.trim().toLowerCase())
    && (status === 'all' || acceptanceStatus(order) === status))
    .sort((a, b) => (Date.parse(a.created_at) - Date.parse(b.created_at)) * (sort === 'oldest' ? 1 : -1))
  return <section className="flex flex-1 min-h-0 min-w-0 flex-col" aria-label={t('procurement.partners.orders.title')}>
    <ProcurementOrdersToolbar navigation={navigation} search={search} onSearch={setSearch} status={status} onStatus={setStatus}
      sort={sort} onSort={setSort} view={view} onView={setView} loading={loading}
      onRefresh={() => { setLoading(true); setError(""); setGeneration(value => value + 1) }} />
    <div className="bg-muted/30 flex-1 min-h-0 min-w-0 overflow-y-auto p-4 md:p-8 space-y-4">
      {isDemoSiteId(siteId) && <ProcurementDemoNotice />}
      <p className="text-xs text-muted-foreground">{t('procurement.partners.orders.description')}</p>
      {error ? <p role="alert" className="text-destructive">{error === 'Orders could not be loaded' ? t('procurement.partners.errors.ordersLoad') : message(error)}</p>
        : <ProcurementOrdersList key={`${search}-${status}-${sort}-${view}`} orders={rows} siteId={siteId} view={view} loading={loading} onSelect={setSelected} />}
    </div>
    {orders.map(order => <OrderCard key={`${siteId}-${order.id}`} order={order} siteId={siteId} open={selected === order.id}
      onClose={() => setSelected(null)} onReceived={() => setGeneration(value => value + 1)} />)}
  </section>
}

function OrderCard({ order, siteId, onReceived, open, onClose }: { order: ProcurementOrder; siteId: string; onReceived: () => void; open: boolean; onClose: () => void }) {
  const { t, message, formatMoney, formatNumber } = useProcurementI18n()
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [retryKey, setRetryKey] = useState<string | null>(null)
  async function receive() {
    if (isDemoSiteId(siteId)) return
    const lines = order.lines.filter(line => quantities[line.id] && quantities[line.id] !== "0")
      .map(line => ({ item_id: line.id, quantity: Number(quantities[line.id]) }))
    if (!lines.length || lines.some(line => !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000000)) {
      setError("Enter whole quantities between 1 and 1,000,000."); return
    }
    setBusy(true); setError("")
    const key = retryKey ?? crypto.randomUUID(); setRetryKey(key)
    try {
      const response = await fetch(`/api/procurement/commerce/receipts?site_id=${encodeURIComponent(siteId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, note, lines, idempotency_key: key }),
      })
      const body = await response.json()
      if (!response.ok) {
        // Only an initial, definitive validation rejection releases the draft.
        // A prior ambiguous attempt may have committed: preserve its identity.
        if (!retryKey && [400, 409, 422].includes(response.status)) setRetryKey(null)
        throw new Error(body.error || "Receipt could not be recorded")
      }
      setQuantities({}); setNote(""); setRetryKey(null)
      onClose(); onReceived()
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Receipt could not be recorded") }
    finally { setBusy(false) }
  }
  return <DocumentDialog open={open} onClose={onClose} busy={busy} title={t('procurement.partners.orders.numbered', { id: order.id.slice(0, 8) })} description={t('procurement.partners.orders.dialogHint', { name: order.supplier_name, amount: formatMoney(order.net_amount_minor, order.currency) })}>
    <DialogForm onSubmit={event => { event.preventDefault(); if (!busy && note.trim()) void receive() }}><DialogBody className="space-y-3">
      {isDemoSiteId(siteId) && <ProcurementDemoNotice />}
      {order.lines.map(line => <div key={line.id}>
        <Label htmlFor={`receipt-${line.id}`}>{t('procurement.partners.orders.acceptedLine', { name: line.name, received: formatNumber(line.received_quantity ?? 0), quantity: formatNumber(line.quantity) })}</Label>
        <Input id={`receipt-${line.id}`} inputMode="numeric" placeholder={t('procurement.partners.orders.quantityPlaceholder')} value={quantities[line.id] ?? ""} disabled={busy || !!retryKey}
          onChange={event => setQuantities(current => ({ ...current, [line.id]: event.target.value }))} />
      </div>)}
      <Label htmlFor={`note-${order.id}`}>{t('procurement.partners.orders.note')}</Label>
      <Input id={`note-${order.id}`} maxLength={1000} value={note} disabled={busy || !!retryKey} onChange={event => setNote(event.target.value)} />
      {error && <p role="alert" className="text-destructive">{error === 'Enter whole quantities between 1 and 1,000,000.' ? t('procurement.partners.orders.quantityError') : error === 'Receipt could not be recorded' ? t('procurement.partners.errors.receiptRecord') : message(error)}</p>}

      {retryKey && <p className="text-sm">{t('procurement.partners.orders.retryHint')}</p>}
    </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t('procurement.partners.actions.closeDraft')}</Button><Button type="submit" disabled={isDemoSiteId(siteId) || busy || !note.trim()}>{t(busy ? 'procurement.partners.actions.recording' : retryKey ? 'procurement.partners.orders.retry' : 'procurement.partners.orders.record')}</Button></DialogFooter></DialogForm>
    </DocumentDialog>
}