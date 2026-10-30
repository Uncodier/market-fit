'use client'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { useState } from 'react'
import type { ZodIssue } from 'zod'
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import { Choice } from '@/app/purchases/procurement/components/form-fields'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { ReferencePicker } from '../procurement/components/reference-picker'
import { requestDocumentSchema, type RequestDocument } from './schema'
import { ServiceEstimate } from './service-estimate'
import { WorkflowValidation } from './workflow-validation'

const emptyDocument: RequestDocument = { title: '', description: '', currency: 'USD', lines: [{ catalog_item_id: null, description: '', quantity: 1 }] }
export function RequestEditor({ siteId, initial = emptyDocument, busy, onSave, onCancel, serverError, creating = initial === emptyDocument }: {
  siteId: string; initial?: RequestDocument; busy: boolean; onSave: (document: RequestDocument) => Promise<void>; onCancel?: () => void; serverError?: string; creating?: boolean;
}) {
  const { t, message } = useProcurementI18n()
  const demo = isDemoSiteId(siteId) || isDemoModeActive()
  const [draft, setDraft] = useState(initial)
  const [issues, setIssues] = useState<ZodIssue[]>([])
  return <Dialog open onOpenChange={open => { if (!open && !busy) onCancel?.() }}><DialogContent closeLabel={t('procurement.navigation.closeDialog')} size="lg" busy={busy}><DialogForm onSubmit={event => {
    event.preventDefault(); if (busy || demo || isDemoModeActive()) return; const parsed = requestDocumentSchema.safeParse(draft)
    if (!parsed.success) { setIssues(parsed.error.issues); return }
    setIssues([]); void onSave(parsed.data)
  }}>
    <DialogHeader><DialogTitle>{creating ? t('procurement.workflow.request.createTitle') : t('procurement.workflow.request.editTitle')}</DialogTitle><DialogDescription>{t('procurement.workflow.request.editorDescription')}</DialogDescription></DialogHeader>
    <DialogBody className="text-sm">{serverError && <p role="alert" className="text-sm text-destructive">{message(serverError)}</p>}
    <fieldset disabled={busy} className="space-y-4">
      <label className="block">{t('procurement.workflow.common.title')}<Input required maxLength={200} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="block">{t('procurement.workflow.common.description')}<Textarea maxLength={5000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      <Choice disabled={busy} label={t('procurement.workflow.common.currency')} value={draft.currency} options={['USD', 'MXN', 'EUR', 'GBP', 'CAD']} onChange={currency => setDraft({ ...draft, currency })} />
      <p className="text-sm text-muted-foreground">{t('procurement.workflow.request.costDescription')}</p>
      {draft.lines.map((line, index) => <section key={index} className="space-y-3 rounded border p-4">
        <h3 className="font-medium">{t('procurement.workflow.request.line', { number: index + 1 })}</h3>
        {demo ? null : <ReferencePicker disabled={busy} siteId={siteId} kind="products" label={t('procurement.workflow.request.catalogOptionalServices')} single ids={line.catalog_item_id ? [line.catalog_item_id] : []}
          onChange={values => setDraft({ ...draft, lines: draft.lines.map((item, position) => position === index ? { catalog_item_id: values[0] ?? null, description: item.description, quantity: item.quantity } : item) })} />}
        {!line.catalog_item_id && <label className="block">{t('procurement.workflow.request.serviceDescription')}<Input required value={line.description} maxLength={500} onChange={event => setDraft({ ...draft, lines: draft.lines.map((item, position) => position === index ? { ...item, description: event.target.value } : item) })} /></label>}
        {!line.catalog_item_id && <ServiceEstimate siteId={siteId} line={line} onChange={value => setDraft({ ...draft, lines: draft.lines.map((item, position) => position === index ? value : item) })} />}
        <label className="block">{t('procurement.workflow.common.quantity')}<Input type="number" min={1} max={1000000} step={1} required value={line.quantity} onChange={event => setDraft({ ...draft, lines: draft.lines.map((item, position) => position === index ? { ...item, quantity: Number(event.target.value) } : item) })} /></label>
        <Button type="button" variant="outline" disabled={draft.lines.length === 1} onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, position) => position !== index) })}>{t('procurement.workflow.request.removeLine')}</Button>
      </section>)}
      <Button type="button" variant="outline" disabled={draft.lines.length >= 100} onClick={() => setDraft({ ...draft, lines: [...draft.lines, { catalog_item_id: null, description: '', quantity: 1 }] })}>{t('procurement.workflow.request.addLine')}</Button>
      <WorkflowValidation issues={issues} kind="request" />
    </fieldset></DialogBody>
    <DialogFooter>{onCancel && <Button variant="outline" type="button" disabled={busy} onClick={onCancel}>{t('procurement.workflow.request.cancelEdit')}</Button>}<Button type="submit" disabled={busy || demo}>{busy ? t('procurement.workflow.common.saving') : t('procurement.workflow.request.saveDraft')}</Button></DialogFooter>
  </DialogForm></DialogContent></Dialog>
}
