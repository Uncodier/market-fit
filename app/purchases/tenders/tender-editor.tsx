'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSite } from '@/app/context/SiteContext'
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import { Choice, DateTimeField } from '@/app/purchases/procurement/components/form-fields'
import { RelationSelect } from '@/app/components/ui/relation-select'
import { ProcurementState } from '@/app/purchases/procurement/ui/workspace'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { isRealSiteId } from '@/lib/demo-utils'
import { ReferencePicker } from '@/app/purchases/procurement/components/reference-picker'
import { tenderDocumentSchema, type TenderDocument } from './schema'

const newLine = () => ({ id: crypto.randomUUID(), description: '', quantity: 1, unit: 'unit', unit_net_minor: 0, catalog_item_id: null })
function initialDocument(): TenderDocument {
  return { title: '', description: '', request_id: null, currency: 'USD', visibility: 'private', global_visible: false, participation: 'invitation_only', opening_policy: 'after_close',
    participation_deadline: new Date(Date.now() + 7 * 86400000).toISOString(), opening_at: new Date(Date.now() + 8 * 86400000).toISOString(), requirements: [newLine()] }
}
export function TenderEditor({ id }: { id?: string }) {
  const { currentSite } = useSite()
  if (!currentSite || !isRealSiteId(currentSite.id)) return <p className="p-6">Select a real workspace to manage tenders.</p>
  return <Editor key={`${currentSite.id}:${id}`} siteId={currentSite.id} id={id} />
}
function Editor({ siteId, id }: { siteId: string; id?: string }) {
  const router = useRouter()
  const [document, setDocument] = useState<TenderDocument>(initialDocument), [version, setVersion] = useState(0)
  const [requests, setRequests] = useState<{ id: string; title: string; status: string }[]>([])
  const [error, setError] = useState(''), [loading, setLoading] = useState(Boolean(id)), [saving, setSaving] = useState(false)
  const [editable, setEditable] = useState(!id), [optionsError, setOptionsError] = useState('')
  const update = <K extends keyof TenderDocument>(key: K, value: TenderDocument[K]) => setDocument(current => ({ ...current, [key]: value }))
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/procurement/requests?site_id=${siteId}&status=approved`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(result => setRequests(result.requests)).catch(reason => { if (!controller.signal.aborted) setOptionsError(reason.message || 'Unable to load requests') })
    if (id) fetch(`/api/procurement/tenders/${id}?site_id=${siteId}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(({ tender }) => { if (!controller.signal.aborted) { const { title, description, request_id, currency, visibility, global_visible, participation, opening_policy, participation_deadline, opening_at, requirements } = tender; setDocument({ title, description, request_id, currency, visibility, global_visible, participation, opening_policy, participation_deadline, opening_at, requirements }); setVersion(tender.version); setEditable(['draft', 'published'].includes(tender.status)) } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Unable to load tender') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, siteId])
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (saving || loading || !editable) return
    const parsed = tenderDocumentSchema.safeParse(document)
    if (!parsed.success) { setError(parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')); return }
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/procurement/tenders${id ? `/${id}` : ''}?site_id=${siteId}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_version: version, document: parsed.data }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      router.push(`/purchases/tenders/${result.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save tender') } finally { setSaving(false) }
  }
  const close = () => router.push(id ? `/purchases/tenders/${id}` : '/purchases/tenders')
  return <Dialog open onOpenChange={open => { if (!open && !saving) close() }}><DialogContent size="lg" busy={saving}><DialogForm onSubmit={save}>
    <DialogHeader><DialogTitle>{id ? 'Edit tender' : 'Create tender'}</DialogTitle><DialogDescription>Save a working version. Published terms change only after a separately approved publication.</DialogDescription></DialogHeader>
    <DialogBody className="space-y-5">
    {error && <p role="alert" className="text-destructive">{error}</p>}{optionsError && <p role="alert">Request options unavailable: {optionsError}</p>}
    <ProcurementState loading={loading} />
    {!loading && !editable && <p>This tender cannot be edited. Reload its detail to check its current state.</p>}
    {!loading && editable && <fieldset disabled={saving} className="space-y-5">
      <label className="block">Title<Input required maxLength={200} value={document.title} onChange={event => update('title', event.target.value)} /></label>
      <label className="block">Public description and terms<Textarea maxLength={10000} value={document.description} onChange={event => update('description', event.target.value)} /></label>
      <RelationSelect label="Approved purchase request (optional)" disabled={saving} allowCreate={false} placeholder="Direct tender — no request" value={document.request_id ? { mode: 'existing', id: document.request_id, label: requests.find(row => row.id === document.request_id)?.title ?? 'Current linked request' } : null} options={requests.map(row => ({ id: row.id, label: row.title }))} onValueChange={value => update('request_id', value?.mode === 'existing' ? value.id : null)} />
      <p className="text-xs text-muted-foreground">Shows the 50 most recent approved requests. Request approval never approves publication.</p>
      <div className="grid gap-4 sm:grid-cols-2"><Choice disabled={saving} label="Visibility" value={document.visibility} options={['private', 'unlisted', 'public']} onChange={visibility => setDocument(current => ({ ...current, visibility, global_visible: visibility === 'public' && current.global_visible }))} />
      <Choice disabled={saving} label="Estimate currency" value={document.currency} options={['USD', 'MXN', 'EUR', 'GBP', 'CAD']} onChange={value => update('currency', value)} /></div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={document.global_visible} disabled={document.visibility !== 'public'} onChange={event => update('global_visible', event.target.checked)} />Opt in to the global tender directory</label>
      <div className="grid gap-4 sm:grid-cols-2"><Choice disabled={saving} label="Participation" value={document.participation} options={['invitation_only', 'approved_suppliers', 'open']} onChange={value => update('participation', value)} />
      <Choice disabled={saving} label="Offer opening policy" value={document.opening_policy} options={['after_close', 'on_receipt']} onChange={value => update('opening_policy', value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2">{(['participation_deadline', 'opening_at'] as const).map(key => <DateTimeField key={key} disabled={saving} label={key === 'opening_at' ? 'Quotation opening (local time)' : 'Participation closes (local time)'} value={document[key]} onChange={value => update(key, value)} />)}</div>
      <section className="space-y-4"><h2 className="text-lg font-semibold">Structured requirements</h2>{document.requirements.map((line, index) => <fieldset className="space-y-3 rounded border p-4" key={line.id}><legend>Requirement {index + 1}</legend>
        <ReferencePicker disabled={saving} siteId={siteId} kind="products" label="Catalog item (optional)" single ids={line.catalog_item_id ? [line.catalog_item_id] : []} onChange={ids => update('requirements', document.requirements.map((row, i) => i === index ? { ...row, catalog_item_id: ids[0] ?? null } : row))} />
        <label>Description / specification<Textarea required maxLength={2000} value={line.description} onChange={event => update('requirements', document.requirements.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} /></label>
        <div className="grid gap-3 sm:grid-cols-3">{(['quantity', 'unit', 'unit_net_minor'] as const).map(key => <label key={key}>{key === 'unit_net_minor' ? 'Unit net estimate (minor units)' : key === 'quantity' ? 'Quantity' : 'Unit'}<Input required type={key === 'unit' ? 'text' : 'number'} min={key === 'quantity' ? 1 : 0} step="1" value={line[key]} onChange={event => update('requirements', document.requirements.map((row, i) => i === index ? { ...row, [key]: key === 'unit' ? event.target.value : Number(event.target.value) } : row))} /></label>)}</div>
        <Button type="button" variant="outline" disabled={document.requirements.length === 1} onClick={() => update('requirements', document.requirements.filter((_, i) => i !== index))}>Remove requirement</Button>
      </fieldset>)}<Button type="button" variant="outline" disabled={document.requirements.length >= 100} onClick={() => update('requirements', [...document.requirements, newLine()])}>Add requirement</Button></section>
      <p>Internal net estimate: {document.currency} {(document.requirements.reduce((sum, line) => sum + line.quantity * line.unit_net_minor, 0) / 100).toFixed(2)}</p>
    </fieldset>}</DialogBody>
    <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={close}>Cancel</Button><Button type="submit" disabled={saving || loading || !editable}>{saving ? 'Saving…' : 'Save working version'}</Button></DialogFooter>
  </DialogForm></DialogContent></Dialog>
}
