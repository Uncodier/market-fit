"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { OrderReceiptDialog, type ReceiptDraft } from './order-receipt-dialog'
import { useProcurementScopeKey } from '../components/use-procurement-scope-key'
import { ProcurementOrdersList, ProcurementOrdersToolbar, acceptanceStatus, orderReference } from "./procurement-orders-list"
import { useMobileView } from '@/app/hooks/use-mobile-view'
import type { ProcurementOrder } from "./contracts"
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { isProcurementDemo as isDemoSiteId } from '../ui/is-demo'
import { demoProcurementOrders } from '@/lib/demo-data/procurement-commerce'
import { ProcurementDemoNotice } from '../ui/demo-notice'

export function ProcurementOrdersPanel({ siteId, navigation }: { siteId: string; navigation?: ReactNode }) {
  const demo = isDemoSiteId(siteId)
  const scope = useProcurementScopeKey(siteId)
  return <OrdersContent key={scope} siteId={siteId} demo={demo} navigation={navigation} />
}

function OrdersContent({ siteId, demo, navigation }: { siteId: string; demo: boolean; navigation?: ReactNode }) {
  const { t, message } = useProcurementI18n()
  const drafts = useRef(new Map<string, ReceiptDraft>())
  const [selected, setSelected] = useState<{ id: string; draft?: ReceiptDraft } | null>(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('newest')
  const [view, setView] = useMobileView('kanban')
  const [orders, setOrders] = useState<ProcurementOrder[]>(() => demo ? demoProcurementOrders : [])
  const [error, setError] = useState("")
  const [isLoading, setLoading] = useState(true)
  const loading = !demo && isLoading
  const [generation, setGeneration] = useState(0)
  useEffect(() => {
    if (demo) return
    const controller = new AbortController()
    fetch(`/api/procurement/commerce/orders?site_id=${encodeURIComponent(siteId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Orders could not be loaded"); return body.data })
      .then((data: ProcurementOrder[]) => {
        if (controller.signal.aborted) return
        const ids = new Set((data ?? []).map(order => order.id))
        for (const id of drafts.current.keys()) if (!ids.has(id)) drafts.current.delete(id)
        setSelected(current => current && ids.has(current.id) ? current : null)
        setOrders(data ?? []); setError("")
      })
      .catch(reason => { if (!controller.signal.aborted) { setError(reason.message); setOrders([]); setSelected(null) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, demo, generation])
  const order = selected && orders.find(item => item.id === selected.id)
  const rows = orders.filter(order => `${order.supplier_name} ${orderReference(order, siteId)}`.toLowerCase().includes(search.trim().toLowerCase())
    && (status === 'all' || acceptanceStatus(order) === status))
    .sort((a, b) => (Date.parse(a.created_at) - Date.parse(b.created_at)) * (sort === 'oldest' ? 1 : -1))
  return <section className="flex flex-1 min-h-0 min-w-0 flex-col" aria-label={t('procurement.partners.orders.title')}>
    <ProcurementOrdersToolbar navigation={navigation} search={search} onSearch={setSearch} status={status} onStatus={setStatus}
      sort={sort} onSort={setSort} view={view} onView={setView} loading={loading}
      onRefresh={() => { setLoading(true); setError(""); setGeneration(value => value + 1) }} />
    <div className="bg-muted/30 flex-1 min-h-0 min-w-0 overflow-y-auto p-4 md:p-8 space-y-4">
      {demo && <ProcurementDemoNotice />}
      <p className="text-xs text-muted-foreground">{t('procurement.partners.orders.description')}</p>
      {error ? <p role="alert" className="text-destructive">{error === 'Orders could not be loaded' ? t('procurement.partners.errors.ordersLoad') : message(error)}</p>
        : <ProcurementOrdersList key={`${search}-${status}-${sort}-${view}`} orders={rows} siteId={siteId} view={view} loading={loading}
            onSelect={id => setSelected({ id, draft: drafts.current.get(id) })} />}
    </div>
    {order && selected && <OrderReceiptDialog key={order.id} order={order} siteId={siteId} initial={selected.draft}
      onClose={draft => {
        if (draft.note || Object.values(draft.quantities).some(Boolean) || draft.retryBody) drafts.current.set(order.id, draft)
        else drafts.current.delete(order.id)
        setSelected(null)
      }} onReceived={() => { drafts.current.delete(order.id); setSelected(null); setLoading(true); setGeneration(value => value + 1) }} />}
  </section>
}