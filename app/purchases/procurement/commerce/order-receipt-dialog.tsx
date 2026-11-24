import { useRef, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { DialogForm, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import { DocumentDialog } from './document-ui'
import type { ProcurementOrder } from './contracts'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { isProcurementDemo } from '../ui/is-demo'
import { ProcurementDemoNotice } from '../ui/demo-notice'

export type ReceiptDraft = { quantities: Record<string, string>; note: string; retryBody: string | null; error: string }

export function OrderReceiptDialog({ order, siteId, initial, onReceived, onClose }: {
  order: ProcurementOrder; siteId: string; initial?: ReceiptDraft; onReceived: () => void; onClose: (draft: ReceiptDraft) => void
}) {
  const { t, message, formatMoney, formatNumber } = useProcurementI18n()
  const [quantities, setQuantities] = useState<Record<string, string>>(initial?.quantities ?? {})
  const [note, setNote] = useState(initial?.note ?? '')
  const [retryBody, setRetryBody] = useState(initial?.retryBody ?? null)
  const [error, setError] = useState(initial?.error ?? '')
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const close = () => { if (!sending.current) onClose({ quantities, note, retryBody, error }) }
  async function receive() {
    if (isProcurementDemo(siteId) || sending.current || !note.trim()) return
    let payload = retryBody
    if (!payload) {
      const lines = order.lines.filter(line => quantities[line.id] && quantities[line.id] !== '0')
        .map(line => ({ item_id: line.id, quantity: Number(quantities[line.id]) }))
      if (!lines.length || lines.some(line => !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000000)) {
        setError('Enter whole quantities between 1 and 1,000,000.'); return
      }
      payload = JSON.stringify({ order_id: order.id, note, lines, idempotency_key: crypto.randomUUID() })
      setRetryBody(payload)
    }
    sending.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(`/api/procurement/commerce/receipts?site_id=${encodeURIComponent(siteId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
      })
      const body = await response.json()
      if (!response.ok) {
        // Only an initial, definitive validation rejection releases the draft.
        if (!retryBody && [400, 409, 422].includes(response.status)) setRetryBody(null)
        throw new Error(body.error || 'Receipt could not be recorded')
      }
      onReceived()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Receipt could not be recorded') }
    finally { sending.current = false; setBusy(false) }
  }
  return <DocumentDialog open onClose={close} busy={busy} title={t('procurement.partners.orders.numbered', { id: order.id.slice(0, 8) })} description={t('procurement.partners.orders.dialogHint', { name: order.supplier_name, amount: formatMoney(order.net_amount_minor, order.currency) })}>
    <DialogForm onSubmit={event => { event.preventDefault(); void receive() }}><DialogBody className="space-y-3">
      {isProcurementDemo(siteId) && <ProcurementDemoNotice />}
      {order.lines.map(line => <div key={line.id}>
        <Label htmlFor={`receipt-${line.id}`}>{t('procurement.partners.orders.acceptedLine', { name: line.name, received: formatNumber(line.received_quantity ?? 0), quantity: formatNumber(line.quantity) })}</Label>
        <Input id={`receipt-${line.id}`} inputMode="numeric" placeholder={t('procurement.partners.orders.quantityPlaceholder')} value={quantities[line.id] ?? ''} disabled={busy || !!retryBody}
          onChange={event => setQuantities(current => ({ ...current, [line.id]: event.target.value }))} />
      </div>)}
      <Label htmlFor={`note-${order.id}`}>{t('procurement.partners.orders.note')}</Label>
      <Input id={`note-${order.id}`} maxLength={1000} value={note} disabled={busy || !!retryBody} onChange={event => setNote(event.target.value)} />
      {error && <p role="alert" className="text-destructive">{error === 'Enter whole quantities between 1 and 1,000,000.' ? t('procurement.partners.orders.quantityError') : error === 'Receipt could not be recorded' ? t('procurement.partners.errors.receiptRecord') : message(error)}</p>}
      {retryBody && <p className="text-sm">{t('procurement.partners.orders.retryHint')}</p>}
    </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={close}>{t('procurement.partners.actions.closeDraft')}</Button><Button type="submit" disabled={isProcurementDemo(siteId) || busy || !note.trim()}>{t(busy ? 'procurement.partners.actions.recording' : retryBody ? 'procurement.partners.orders.retry' : 'procurement.partners.orders.record')}</Button></DialogFooter></DialogForm>
  </DocumentDialog>
}