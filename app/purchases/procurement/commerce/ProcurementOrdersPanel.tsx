"use client"

import { useEffect, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { DialogForm, DialogBody, DialogFooter } from "@/app/components/ui/dialog"
import { DocumentToolbar, DocumentTable, DocumentDialog } from "./document-ui"
import { RotateCw } from "@/app/components/ui/icons"
import type { ProcurementOrder } from "./contracts"

export function ProcurementOrdersPanel({ siteId }: { siteId: string }) {
  return <OrdersContent key={siteId} siteId={siteId} />
}

function OrdersContent({ siteId }: { siteId: string }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [orders, setOrders] = useState<ProcurementOrder[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [generation, setGeneration] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/procurement/commerce/orders?site_id=${encodeURIComponent(siteId)}`, { signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Orders could not be loaded"); return body.data })
      .then(data => setOrders(data ?? []))
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, generation])
  return <section className="space-y-4 border-b p-6" aria-label="Procurement purchase orders">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Procurement purchase orders</h2>
      </div>
    <p className="text-sm text-muted-foreground">Approved procurement commitments. No automatic payment, Bill creation or inventory movement. Receipts here record non-stock acceptance only.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <DocumentToolbar workspace tabs={[{ value: 'all', label: 'Purchase orders' }]} value="all" onChange={() => {}} search={search} onSearch={setSearch}
      actions={<Button variant="ghost" size="icon" aria-label="Refresh" title="Refresh orders" disabled={loading} onClick={() => setGeneration(value => value + 1)}><RotateCw className="h-4 w-4" /></Button>} />
    {!error && <DocumentTable loading={loading} empty="No approved procurement orders." rows={orders.filter(order => `${order.supplier_name} ${order.id}`.toLowerCase().includes(search.toLowerCase()))} columns={[
      { label: 'Supplier', render: order => order.supplier_name },
      { label: 'Order', render: order => order.id.slice(0, 8) },
      { label: 'Net amount', render: order => `${order.currency} ${(order.net_amount_minor / 100).toFixed(2)}` },
      { label: 'Created', render: order => new Date(order.created_at).toLocaleString() },
      { label: 'Acceptance', render: order => <Button variant="outline" onClick={() => setSelected(order.id)}>Items and acceptance</Button> },
    ]} />}
    {orders.map(order => <OrderCard key={`${siteId}-${order.id}`} order={order} siteId={siteId} open={selected === order.id}
      onClose={() => setSelected(null)} onReceived={() => setGeneration(value => value + 1)} />)}
  </section>
}

function OrderCard({ order, siteId, onReceived, open, onClose }: { order: ProcurementOrder; siteId: string; onReceived: () => void; open: boolean; onClose: () => void }) {
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [retryKey, setRetryKey] = useState<string | null>(null)
  async function receive() {
    const lines = order.lines.filter(line => quantities[line.id] && quantities[line.id] !== "0")
      .map(line => ({ item_id: line.id, quantity: Number(quantities[line.id]) }))
    if (!lines.length || lines.some(line => !Number.isSafeInteger(line.quantity) || line.quantity < 1)) { setError("Enter at least one positive whole quantity."); return }
    setBusy(true); setError("")
    const key = retryKey ?? crypto.randomUUID(); setRetryKey(key)
    try {
      const response = await fetch(`/api/procurement/commerce/receipts?site_id=${encodeURIComponent(siteId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, note, lines, idempotency_key: key }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Receipt could not be recorded")
      setQuantities({}); setNote(""); setRetryKey(null)
      onClose(); onReceived()
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Receipt could not be recorded") }
    finally { setBusy(false) }
  }
  return <DocumentDialog open={open} onClose={onClose} busy={busy} title={`Order ${order.id.slice(0, 8)}`} description={`${order.supplier_name} · ${order.currency} ${(order.net_amount_minor / 100).toFixed(2)} net. Non-stock acceptance only.`}>
    <DialogForm onSubmit={event => { event.preventDefault(); if (!busy && note.trim()) void receive() }}><DialogBody className="space-y-3">
      {order.lines.map(line => <div key={line.id}>
        <Label htmlFor={`receipt-${line.id}`}>{line.name} — {line.received_quantity ?? 0} / {line.quantity} accepted</Label>
        <Input id={`receipt-${line.id}`} inputMode="numeric" placeholder="Quantity to accept" value={quantities[line.id] ?? ""} disabled={busy || !!retryKey}
          onChange={event => setQuantities(current => ({ ...current, [line.id]: event.target.value }))} />
      </div>)}
      <Label htmlFor={`note-${order.id}`}>Acceptance note</Label>
      <Input id={`note-${order.id}`} maxLength={1000} value={note} disabled={busy || !!retryKey} onChange={event => setNote(event.target.value)} />
      {error && <p role="alert" className="text-destructive">{error}</p>}

      {retryKey && <p className="text-sm">Attempted receipt fields remain locked for safe retry. Retrying uses the same receipt identity.</p>}
    </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close and keep draft</Button><Button type="submit" disabled={busy || !note.trim()}>{busy ? 'Recording…' : retryKey ? 'Retry identical receipt' : 'Record non-stock acceptance'}</Button></DialogFooter></DialogForm>
    </DocumentDialog>
}