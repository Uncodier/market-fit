'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Textarea } from '@/app/components/ui/textarea'
import { RelationSelect } from '@/app/components/ui/relation-select'
import { DateOnlyField } from '@/app/purchases/procurement/components/form-fields'
import { DocumentDialog } from '@/app/purchases/procurement/commerce/document-ui'
import { DialogForm, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import { sourcingOfferSchema } from './schema'
import type { ZodIssue } from 'zod'

export function OfferForm({ siteId, endpoint, onSaved, disabled = false }: { siteId: string; endpoint: string; onSaved: () => void; disabled?: boolean }) {
  const { t, message } = useProcurementI18n()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  const [dates, setDates] = useState({ valid_from: '', valid_until: '' })
  const [attempted, setAttempted] = useState(false)
  const [search, setSearch] = useState(''), [offset, setOffset] = useState(0)
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [total, setTotal] = useState(0), [supplier, setSupplier] = useState('')
  const [error, setError] = useState(''), [saving, setSaving] = useState(false)
  const [issues, setIssues] = useState<ZodIssue[]>([])
  const fieldLabels: Record<string, string> = { supplier_id: 'procurement.portal.catalog.supplier', purchase_unit: 'procurement.portal.offer.purchaseUnit',
    units_per_purchase_unit: 'procurement.portal.offer.conversion', minimum_quantity: 'procurement.portal.offer.minimum',
    lead_time_days: 'procurement.portal.offer.leadTime', currency: 'procurement.portal.offer.currency', unit_price_minor: 'procurement.portal.offer.netPrice',
    valid_from: 'procurement.portal.offer.validFrom', valid_until: 'procurement.portal.offer.validUntil', terms: 'procurement.portal.offer.terms' }
  const [loading, setLoading] = useState(true)
  const attemptedPayload = useRef<ReturnType<typeof sourcingOfferSchema.parse> | null>(null)
  const submissionKey = useRef<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/procurement/suppliers?site_id=${siteId}&status=approved&q=${encodeURIComponent(search)}&offset=${offset}`, {
      cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load approved suppliers')
      if (!controller.signal.aborted) { setSuppliers(result.suppliers); setTotal(result.total); setError('') }
    }).catch(reason => { if (!controller.signal.aborted) { setError(reason.message); setSuppliers([]) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, search, offset])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled || saving) return
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))
    const parsed = sourcingOfferSchema.safeParse(attemptedPayload.current ?? { ...data, ...dates, supplier_id: supplier,
      units_per_purchase_unit: Number(data.units_per_purchase_unit), minimum_quantity: Number(data.minimum_quantity),
      unit_price_minor: Number(data.unit_price_minor), lead_time_days: Number(data.lead_time_days),
    })
    if (!parsed.success) { setIssues(parsed.error.issues); setError(''); return }
    setIssues([])
    if (saving) return
    attemptedPayload.current = parsed.data
    setSaving(true); setAttempted(true); setError('')
    try {
      submissionKey.current ??= crypto.randomUUID()
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submissionKey.current }, body: JSON.stringify(parsed.data) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to save offer')
      submissionKey.current = null; attemptedPayload.current = null; form.reset(); setSupplier(''); setDates({ valid_from: '', valid_until: '' }); setDraft({}); setAttempted(false); setOpen(false); onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save offer') }
    finally { setSaving(false) }
  }

  return <><TopBarPrimaryActions><Button disabled={disabled} onClick={() => setOpen(true)}>{t('procurement.portal.offer.add')}</Button></TopBarPrimaryActions>
    <DocumentDialog open={open} onClose={() => setOpen(false)} busy={saving} title={t('procurement.portal.offer.title')} description={t('procurement.portal.offer.description')}>
    <DialogForm onSubmit={submit}><DialogBody className="space-y-4">
    {!!issues.length && <ul role="alert" className="space-y-1 text-sm text-destructive">{issues.map((issue, index) => <li key={index}>
      {t(fieldLabels[String(issue.path[0])] ?? 'procurement.portal.offer.title')}: {message(issue.message)}
    </li>)}</ul>}
    <fieldset disabled={disabled || saving || attempted} className="space-y-4">
    <p className="text-sm text-muted-foreground">{t('procurement.portal.offer.hint')}</p>
    <div className="space-y-2"><Label htmlFor="supplier-search">{t('procurement.portal.offer.findSupplier')}</Label>
      <Input id="supplier-search" value={search} maxLength={100} onChange={event => { setLoading(true); setSupplier(''); setSearch(event.target.value); setOffset(0) }} />
      <RelationSelect label={t('procurement.portal.catalog.supplier')} allowCreate={false} disabled={disabled || loading || saving || attempted}
        placeholder={t('procurement.portal.offer.selectSupplier')} searchPlaceholder={t('procurement.portal.offer.findSupplier')} emptyMessage={t('procurement.common.noChoices')}
        clearLabel={t('procurement.common.clearSelection')} loadingLabel={t('procurement.common.loadingSelection')}
        options={suppliers.map(row => ({ id: row.id, label: row.name }))}
        value={supplier ? { mode: 'existing', id: supplier, label: suppliers.find(row => row.id === supplier)?.name ?? supplier } : null}
        onValueChange={value => setSupplier(value?.mode === 'existing' ? value.id : '')} />
      <div className="flex gap-2"><Button type="button" variant="outline" disabled={offset === 0 || loading} onClick={() => { setLoading(true); setSupplier(''); setOffset(value => value - 50) }}>{t('procurement.portal.offer.previousSuppliers')}</Button>
        <Button type="button" variant="outline" disabled={offset + 50 >= total || loading} onClick={() => { setLoading(true); setSupplier(''); setOffset(value => value + 50) }}>{t('procurement.portal.offer.nextSuppliers')}</Button></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field draft={draft} onDraftChange={(name, value) => setDraft(current => ({ ...current, [name]: value }))} name="purchase_unit" label={t('procurement.portal.offer.purchaseUnit')} maxLength={80} />
      <Field draft={draft} onDraftChange={(name, value) => setDraft(current => ({ ...current, [name]: value }))} name="units_per_purchase_unit" label={t('procurement.portal.offer.conversion')} type="number" min="0.000001" max="1000000000" step="0.000001" defaultValue="1" />
      <Field draft={draft} onDraftChange={(name, value) => setDraft(current => ({ ...current, [name]: value }))} name="minimum_quantity" label={t('procurement.portal.offer.minimum')} type="number" min="0.000001" max="1000000000" step="0.000001" defaultValue="1" />
      <Field draft={draft} onDraftChange={(name, value) => setDraft(current => ({ ...current, [name]: value }))} name="lead_time_days" label={t('procurement.portal.offer.leadTime')} type="number" min="0" max="3650" step="1" defaultValue="0" />
      <Field draft={draft} onDraftChange={(name, value) => setDraft(current => ({ ...current, [name]: value }))} name="currency" label={t('procurement.portal.offer.currency')} maxLength={3} pattern="[A-Z]{3}" defaultValue="USD" />
      <Field draft={draft} onDraftChange={(name, value) => setDraft(current => ({ ...current, [name]: value }))} name="unit_price_minor" label={t('procurement.portal.offer.netPrice')} type="number" min="0" max="9007199254740991" step="1" />
      <DateOnlyField label={t('procurement.portal.offer.validFrom')} value={dates.valid_from} disabled={disabled || saving || attempted} onChange={valid_from => setDates({ ...dates, valid_from })} />
      <DateOnlyField label={t('procurement.portal.offer.validUntil')} value={dates.valid_until} disabled={disabled || saving || attempted} onChange={valid_until => setDates({ ...dates, valid_until })} />
    </div>
    <p className="text-sm text-muted-foreground">{t('procurement.portal.offer.moneyHint')}</p>
    <div className="space-y-2"><Label htmlFor="offer-terms">{t('procurement.portal.offer.terms')}</Label><Textarea id="offer-terms" name="terms" maxLength={4000} value={draft.terms ?? ''} onChange={event => setDraft({ ...draft, terms: event.target.value })} /></div>
    </fieldset>{attempted && <p className="text-sm">{t('procurement.portal.offer.locked')}</p>}
    {error && <p role="alert" className="text-destructive">{message(error)}</p>}
    </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>{t('procurement.portal.closeDraft')}</Button><Button type="submit" disabled={disabled || saving || !supplier}>{t(saving ? 'procurement.portal.offer.saving' : attempted ? 'procurement.portal.offer.retry' : 'procurement.portal.offer.save')}</Button></DialogFooter>
    </DialogForm></DocumentDialog></>
}

function Field({ name, label, draft, onDraftChange, defaultValue, ...props }: React.ComponentProps<typeof Input> & {
  name: string; label: string; draft: Record<string, string>; onDraftChange: (name: string, value: string) => void
}) {
  return <div className="space-y-2"><Label htmlFor={`offer-${name}`}>{label}</Label><Input id={`offer-${name}`} name={name} required {...props}
    value={draft[name] ?? defaultValue ?? ''} onChange={event => onDraftChange(name, event.target.value)} /></div>
}
