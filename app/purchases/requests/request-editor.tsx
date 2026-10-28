'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import { Choice } from '@/app/purchases/procurement/components/form-fields'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { ReferencePicker } from '../procurement/components/reference-picker'
import { requestDocumentSchema, type RequestDocument } from './schema'
import { ServiceEstimate } from './service-estimate'

const emptyDocument: RequestDocument = { title: '', description: '', currency: 'USD', lines: [{ catalog_item_id: null, description: '', quantity: 1 }] }
export function RequestEditor({ siteId, initial = emptyDocument, busy, onSave, onCancel, serverError }: {
  siteId: string; initial?: RequestDocument; busy: boolean; onSave: (document: RequestDocument) => Promise<void>; onCancel?: () => void; serverError?: string;
}) {
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState('')
  return <Dialog open onOpenChange={open => { if (!open && !busy) onCancel?.() }}><DialogContent size="lg" busy={busy}><DialogForm onSubmit={event => {
    event.preventDefault(); if (busy) return; const parsed = requestDocumentSchema.safeParse(draft)
    if (!parsed.success) { setError(parsed.error.issues[0].message); return }
    setError(''); void onSave(parsed.data)
  }}>
    <DialogHeader><DialogTitle>{initial === emptyDocument ? 'Create purchase request' : 'Edit purchase request'}</DialogTitle><DialogDescription>Save an internal draft. Submission resolves prices, taxes and approvals on the server.</DialogDescription></DialogHeader>
    <DialogBody>{serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
    <fieldset disabled={busy} className="space-y-4">
      <label className="block">Title<Input required maxLength={200} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="block">Description<Textarea maxLength={5000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      <Choice disabled={busy} label="Currency" value={draft.currency} options={['USD', 'MXN', 'EUR', 'GBP', 'CAD']} onChange={currency => setDraft({ ...draft, currency })} />
      <p className="text-sm text-muted-foreground">Catalog cost and tax rates are loaded by the database. All amounts are net of tax. For free-text services, authorized managers may enter an internal budget estimate with explicit workspace tax selection. Unpriced services cannot be submitted.</p>
      {draft.lines.map((line, index) => <section key={index} className="space-y-3 rounded border p-4">
        <h3 className="font-medium">Line {index + 1}</h3>
        <ReferencePicker disabled={busy} siteId={siteId} kind="products" label="Catalog item (optional for services)" single ids={line.catalog_item_id ? [line.catalog_item_id] : []}
          onChange={values => setDraft({ ...draft, lines: draft.lines.map((item, position) => position === index ? { catalog_item_id: values[0] ?? null, description: item.description, quantity: item.quantity } : item) })} />
        {!line.catalog_item_id && <label className="block">Service description<Input required value={line.description} maxLength={500} onChange={event => setDraft({ ...draft, lines: draft.lines.map((item, position) => position === index ? { ...item, description: event.target.value } : item) })} /></label>}
        {!line.catalog_item_id && <ServiceEstimate siteId={siteId} line={line} onChange={value => setDraft({ ...draft, lines: draft.lines.map((item, position) => position === index ? value : item) })} />}
        <label className="block">Quantity<Input type="number" min={1} max={1000000} step={1} required value={line.quantity} onChange={event => setDraft({ ...draft, lines: draft.lines.map((item, position) => position === index ? { ...item, quantity: Number(event.target.value) } : item) })} /></label>
        <Button type="button" variant="outline" disabled={draft.lines.length === 1} onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, position) => position !== index) })}>Remove line</Button>
      </section>)}
      <Button type="button" variant="outline" disabled={draft.lines.length >= 100} onClick={() => setDraft({ ...draft, lines: [...draft.lines, { catalog_item_id: null, description: '', quantity: 1 }] })}>Add line</Button>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </fieldset></DialogBody>
    <DialogFooter>{onCancel && <Button variant="outline" type="button" disabled={busy} onClick={onCancel}>Cancel edit</Button>}<Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</Button></DialogFooter>
  </DialogForm></DialogContent></Dialog>
}
