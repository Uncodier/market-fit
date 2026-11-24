import { useRef, useState } from 'react'
import { DialogForm, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { RelationSelect } from '@/app/components/ui/relation-select'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { FileText } from '@/app/components/ui/icons'
import { demoImportOptions } from '@/lib/demo-data/procurement-commerce'
import { useProcurementOptions } from '../components/use-procurement-options'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { ProcurementDemoNotice } from '../ui/demo-notice'
import { isProcurementDemo } from '../ui/is-demo'
import { ProcurementState } from '../ui/workspace'
import type { ImportOption } from './contracts'
import { DocumentDialog } from './document-ui'

export type QuotationDraft = {
  tender: string; publication: string; supplier: string; reference: string; prices: Record<string, string>
  retryBody: string | null; error: string
}
const emptyDraft: QuotationDraft = { tender: '', publication: '', supplier: '', reference: '', prices: {}, retryBody: null, error: '' }

async function readOptions(url: string, signal: AbortSignal): Promise<ImportOption[]> {
  const response = await fetch(url, { signal, cache: 'no-store' })
  const body = await response.json()
  if (!response.ok || !Array.isArray(body.data)) throw new Error(body.error || 'Procurement could not be loaded')
  return body.data
}

export function RecordQuotationDialog({ siteId, tenderId, initial, onClose, onRecorded }: {
  siteId: string; tenderId?: string; initial?: QuotationDraft; onClose: (draft: QuotationDraft) => void; onRecorded: () => void
}) {
  const demo = isProcurementDemo(siteId)
  const { t, message, formatNumber } = useProcurementI18n()
  const { data, error, loading, retry } = useProcurementOptions(demo ? null : `/api/procurement/commerce/options?site_id=${encodeURIComponent(siteId)}`, readOptions)
  const options = (demo ? demoImportOptions : data ?? []).filter(item => !tenderId || item.tender_id === tenderId)
  const [draft, setDraft] = useState<QuotationDraft>(() => initial ?? { ...emptyDraft, tender: tenderId ?? '' })
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const locked = !!draft.retryBody
  const option = options.find(item => item.tender_id === draft.tender && (!draft.publication || item.publication_id === draft.publication))
  const supplier = option?.suppliers.find(item => item.id === draft.supplier)
  const canRecord = !demo && !!option && !!supplier && !!draft.reference.trim()
  const patch = (changes: Partial<QuotationDraft>) => setDraft(current => ({ ...current, ...changes }))
  const close = () => { if (!sending.current) onClose(draft) }

  async function record() {
    if (isProcurementDemo(siteId) || !canRecord || !option || !supplier || sending.current) return
    let payload = draft.retryBody
    if (!payload) {
      const lines = option.requirements.map(line => ({ requirement_id: line.id, unit_net_minor: Number(draft.prices[line.id]) }))
      if (option.requirements.some(line => !/^\d+$/.test(draft.prices[line.id] ?? '')) || lines.some(line => !Number.isSafeInteger(line.unit_net_minor))) {
        patch({ error: 'procurement.partners.quotes.priceError' }); return
      }
      payload = JSON.stringify({ supplier_id: supplier.id, tender_id: option.tender_id, publication_id: option.publication_id,
        reference: draft.reference, lines, idempotency_key: crypto.randomUUID() })
    }
    sending.current = true; setBusy(true); patch({ retryBody: payload, publication: option.publication_id, error: '' })
    try {
      const response = await fetch(`/api/procurement/commerce/quotes?site_id=${encodeURIComponent(siteId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Quotation could not be recorded')
      onRecorded()
    } catch (reason) { patch({ error: reason instanceof Error ? reason.message : 'Quotation could not be recorded' }) }
    finally { sending.current = false; setBusy(false) }
  }
  const fieldProps = { allowCreate: false, disabled: busy || locked, searchPlaceholder: t('procurement.common.search'),
    clearLabel: t('procurement.common.clearSelection'), loadingLabel: t('procurement.common.loadingSelection') }
  return <DocumentDialog open onClose={close} busy={busy} title={t('procurement.partners.quotes.recordTitle')} description={t('procurement.partners.quotes.recordHint')}>
    <DialogForm onSubmit={event => { event.preventDefault(); void record() }}><DialogBody>
      {demo && <ProcurementDemoNotice />}
      <p className="my-3 text-sm">{t('procurement.partners.quotes.eligibleHint')}</p>
      {loading || error ? <ProcurementState loading={loading} error={error === 'Procurement could not be loaded' ? t('procurement.partners.errors.procurementLoad') : message(error)} errorIsLocalized onRetry={retry} />
        : options.length === 0 ? <EmptyCard title={t('procurement.partners.quotes.noTender')} description="" icon={<FileText size={24} />}
          showShadow={false} showHint={false} contentClassName="min-h-[180px] py-6" /> : <div className="space-y-3 pt-3">
          <RelationSelect {...fieldProps} label={t('procurement.partners.quotes.tender')}
            placeholder={t('procurement.partners.quotes.searchTender')} emptyMessage={t('procurement.partners.quotes.noTender')}
            options={options.map(item => ({ id: item.tender_id, label: item.title }))}
            value={option ? { mode: 'existing', id: option.tender_id, label: option.title } : null}
            onValueChange={value => { const tender = value?.mode === 'existing' ? value.id : ''; patch({ tender, publication: options.find(item => item.tender_id === tender)?.publication_id ?? '', supplier: '', prices: {}, error: '' }) }} />
          {option && <>
            <RelationSelect {...fieldProps} label={t('procurement.partners.quotes.invitedSupplier')}
              placeholder={t('procurement.partners.suppliers.search')} emptyMessage={t('procurement.partners.suppliers.empty')}
              options={option.suppliers.map(item => ({ id: item.id, label: item.name }))}
              value={supplier ? { mode: 'existing', id: supplier.id, label: supplier.name } : null}
              onValueChange={value => patch({ publication: option.publication_id, supplier: value?.mode === 'existing' ? value.id : '' })} />
            <Label htmlFor="commerce-reference">{t('procurement.partners.quotes.reference')}</Label>
            <Input id="commerce-reference" value={draft.reference} maxLength={120} disabled={busy || locked} onChange={event => patch({ publication: option.publication_id, reference: event.target.value })} />
            {option.requirements.map(line => <div key={line.id}>
              <Label htmlFor={`price-${line.id}`}>{t('procurement.partners.quotes.priceLabel', { description: line.description, quantity: formatNumber(line.quantity), unit: line.unit, currency: option.currency })}</Label>
              <Input id={`price-${line.id}`} inputMode="numeric" value={draft.prices[line.id] ?? ''} disabled={busy || locked}
                onChange={event => patch({ publication: option.publication_id, prices: { ...draft.prices, [line.id]: event.target.value } })} />
            </div>)}
          </>}
        </div>}
      {locked && <p className="text-sm">{t('procurement.partners.quotes.retryHint')}</p>}
      {draft.error && <p role="alert" className="text-destructive">{draft.error === 'procurement.partners.quotes.priceError' ? t(draft.error) : draft.error === 'Quotation could not be recorded' ? t('procurement.partners.errors.quoteRecord') : message(draft.error)}</p>}
    </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={close}>{t('procurement.partners.actions.closeDraft')}</Button><Button type="submit" disabled={busy || !canRecord}>{t(busy ? 'procurement.partners.actions.recording' : locked ? 'procurement.partners.quotes.retry' : 'procurement.partners.quotes.record')}</Button></DialogFooter></DialogForm>
  </DocumentDialog>
}