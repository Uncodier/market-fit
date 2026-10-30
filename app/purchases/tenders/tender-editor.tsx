'use client'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { useEffect, useState } from 'react'
import type { ZodIssue } from 'zod'
import { WorkflowValidation } from '@/app/purchases/requests/workflow-validation'
import { useRouter } from 'next/navigation'
import { ProcurementEditorLoading, ProcurementEditorFieldsSkeleton } from '../procurement/ui/editor-loading'
import { useSite } from '@/app/context/SiteContext'
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import { Choice, DateTimeField, Field, Toggle } from '@/app/purchases/procurement/components/form-fields'
import { RelationSelect } from '@/app/components/ui/relation-select'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Textarea } from '@/app/components/ui/textarea'
import { isRealSiteId, isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { demoRequestSummaries, demoTenderDocument, getDemoTenderDetail } from '@/lib/demo-data/procurement-workflow'
import { ReferencePicker } from '@/app/purchases/procurement/components/reference-picker'
import { tenderDocumentSchema, type TenderDocument } from './schema'

const newLine = () => ({ id: crypto.randomUUID(), description: '', quantity: 1, unit: 'unit', unit_net_minor: 0, catalog_item_id: null })
function initialDocument(): TenderDocument {
  return { title: '', description: '', request_id: null, currency: 'USD', visibility: 'private', global_visible: false, participation: 'invitation_only', opening_policy: 'after_close',
    participation_deadline: new Date(Date.now() + 7 * 86400000).toISOString(), opening_at: new Date(Date.now() + 8 * 86400000).toISOString(), requirements: [newLine()] }
}
export function TenderEditor({ id }: { id?: string }) {
  const { t } = useProcurementI18n()
  const { currentSite } = useSite()
  if (!currentSite) return <ProcurementEditorLoading />
  if (!isRealSiteId(currentSite.id) && !isDemoSiteId(currentSite.id)) return <p className="p-6">{t('procurement.workflow.tender.selectWorkspace')}</p>
  return <Editor key={`${currentSite.id}:${id}`} siteId={currentSite.id} id={id} />
}
function Editor({ siteId, id }: { siteId: string; id?: string }) {
  const demo = isDemoSiteId(siteId) || isDemoModeActive()
  const { t, message, formatNumber, formatMoney } = useProcurementI18n()
  const router = useRouter()
  const [document, setDocument] = useState<TenderDocument>(() => demo ? (id ? getDemoTenderDetail(siteId, id)?.tender ?? demoTenderDocument : demoTenderDocument) : initialDocument()), [version, setVersion] = useState(0)
  const [requests, setRequests] = useState<{ id: string; title: string; status: string }[]>(demo ? demoRequestSummaries.filter(row => row.status === 'approved') : [])
  const [error, setError] = useState(''), [loading, setLoading] = useState(!demo && Boolean(id)), [saving, setSaving] = useState(false)
  const [editable, setEditable] = useState(demo ? !id || !!getDemoTenderDetail(siteId, id) : !id), [optionsError, setOptionsError] = useState('')
  const [issues, setIssues] = useState<ZodIssue[]>([])
  const update = <K extends keyof TenderDocument>(key: K, value: TenderDocument[K]) => setDocument(current => ({ ...current, [key]: value }))
  useEffect(() => {
    if (demo || isDemoModeActive()) return
    const controller = new AbortController()
    fetch(`/api/procurement/requests?site_id=${siteId}&status=approved`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(result => setRequests(result.requests)).catch(reason => { if (!controller.signal.aborted) setOptionsError(reason.message || 'Unable to load requests') })
    if (id) fetch(`/api/procurement/tenders/${id}?site_id=${siteId}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(({ tender }) => { if (!controller.signal.aborted) { const { title, description, request_id, currency, visibility, global_visible, participation, opening_policy, participation_deadline, opening_at, requirements } = tender; setDocument({ title, description, request_id, currency, visibility, global_visible, participation, opening_policy, participation_deadline, opening_at, requirements }); setVersion(tender.version); setEditable(['draft', 'published'].includes(tender.status)) } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Unable to load tender') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [demo, id, siteId])
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (demo || isDemoModeActive() || saving || loading || !editable) return
    const parsed = tenderDocumentSchema.safeParse(document)
    if (!parsed.success) { setIssues(parsed.error.issues); return }
    setSaving(true); setError(''); setIssues([])
    try {
      const response = await fetch(`/api/procurement/tenders${id ? `/${id}` : ''}?site_id=${siteId}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_version: version, document: parsed.data }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      router.push(`/purchases/tenders/${result.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save tender') } finally { setSaving(false) }
  }
  const close = () => router.push(id ? `/purchases/tenders/${id}` : '/purchases/tenders')
  return <Dialog open onOpenChange={open => { if (!open && !saving) close() }}><DialogContent closeLabel={t('procurement.navigation.closeDialog')} size="lg" busy={saving}><DialogForm onSubmit={save}>
    <DialogHeader><DialogTitle>{id ? t('procurement.workflow.tender.edit') : t('procurement.workflow.tender.create')}</DialogTitle><DialogDescription>{t('procurement.workflow.tender.editorDescription')}</DialogDescription></DialogHeader>
    <DialogBody className="space-y-5 text-sm">
    {demo && <ProcurementDemoNotice />}
    {error && <p role="alert" className="text-destructive">{message(error)}</p>}{optionsError && <p role="alert">{t('procurement.workflow.tender.optionsError', { error: message(optionsError) })}</p>}
    <WorkflowValidation issues={issues} kind="tender" />
    {loading && <ProcurementEditorFieldsSkeleton />}
    {!loading && !editable && <p>{t('procurement.workflow.tender.notEditable')}</p>}
    {!loading && editable && <fieldset disabled={saving} className="space-y-5">
      <label className="block">{t('procurement.workflow.common.title')}<Input required maxLength={200} value={document.title} onChange={event => update('title', event.target.value)} /></label>
      <label className="block">{t('procurement.workflow.tender.publicDescription')}<Textarea maxLength={10000} value={document.description} onChange={event => update('description', event.target.value)} /></label>
      <RelationSelect label={t('procurement.workflow.tender.approvedRequestOptional')} disabled={saving} allowCreate={false} placeholder={t('procurement.workflow.tender.noRequest')} value={document.request_id ? { mode: 'existing', id: document.request_id, label: requests.find(row => row.id === document.request_id)?.title ?? t('procurement.workflow.tender.currentRequest') } : null} options={requests.map(row => ({ id: row.id, label: row.title }))} onValueChange={value => update('request_id', value?.mode === 'existing' ? value.id : null)} />
      <p className="text-xs text-muted-foreground">{t('procurement.workflow.tender.requestOptionsDescription')}</p>
      <div className="grid gap-4 sm:grid-cols-2"><Choice disabled={saving} label={t('procurement.workflow.tender.visibility')} value={document.visibility} options={['private', 'unlisted', 'public']} onChange={visibility => setDocument(current => ({ ...current, visibility, global_visible: visibility === 'public' && current.global_visible }))} />
      <Choice disabled={saving} label={t('procurement.workflow.tender.estimateCurrency')} value={document.currency} options={['USD', 'MXN', 'EUR', 'GBP', 'CAD']} onChange={value => update('currency', value)} /></div>
      <fieldset disabled={saving || document.visibility !== 'public'}><Toggle label={t('procurement.workflow.tender.globalDirectory')} checked={document.global_visible} onChange={checked => update('global_visible', checked)} /></fieldset>
      <div className="grid gap-4 sm:grid-cols-2"><Choice disabled={saving} label={t('procurement.workflow.tender.participation')} value={document.participation} options={['invitation_only', 'approved_suppliers', 'open']} onChange={value => update('participation', value)} />
      <Choice disabled={saving} label={t('procurement.workflow.tender.openingPolicy')} value={document.opening_policy} options={['after_close', 'on_receipt']} onChange={value => update('opening_policy', value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2">{(['participation_deadline', 'opening_at'] as const).map(key => <DateTimeField key={key} disabled={saving} label={key === 'opening_at' ? t('procurement.workflow.tender.openingLocal') : t('procurement.workflow.tender.closingLocal')} value={document[key]} onChange={value => update(key, value)} />)}</div>
      <section className="space-y-4"><h2 className="text-sm font-semibold">{t('procurement.workflow.tender.structuredRequirements')}</h2>{document.requirements.map((line, index) => <fieldset className="space-y-3 rounded border p-4" key={line.id}><legend className="px-1 text-sm font-medium">{t('procurement.workflow.tender.requirementNumber', { number: formatNumber(index + 1) })}</legend>
        {demo ? null : <ReferencePicker disabled={saving} siteId={siteId} kind="products" label={t('procurement.workflow.tender.catalogOptional')} single ids={line.catalog_item_id ? [line.catalog_item_id] : []} onChange={ids => update('requirements', document.requirements.map((row, i) => i === index ? { ...row, catalog_item_id: ids[0] ?? null } : row))} />}
        <Field label={t('procurement.workflow.tender.specification')}>{fieldId => <Textarea id={fieldId} required maxLength={2000} value={line.description} onChange={event => update('requirements', document.requirements.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['quantity', 'unit'] as const).map(key => <Field key={key} label={t(key === 'quantity' ? 'procurement.workflow.common.quantity' : 'procurement.workflow.common.unit')}>{fieldId => <Input id={fieldId} required type={key === 'unit' ? 'text' : 'number'} min={1} step="1" value={line[key]} onChange={event => update('requirements', document.requirements.map((row, i) => i === index ? { ...row, [key]: key === 'unit' ? event.target.value : Number(event.target.value) } : row))} />}</Field>)}
        </div>
        <Field label={t('procurement.workflow.tender.unitEstimateMinor')}>{fieldId => <Input id={fieldId} required type="number" min={0} step="1" value={line.unit_net_minor} onChange={event => update('requirements', document.requirements.map((row, i) => i === index ? { ...row, unit_net_minor: Number(event.target.value) } : row))} />}</Field>
        <Button type="button" variant="outline" disabled={document.requirements.length === 1} onClick={() => update('requirements', document.requirements.filter((_, i) => i !== index))}>{t('procurement.workflow.tender.removeRequirement')}</Button>
      </fieldset>)}<Button type="button" variant="outline" disabled={document.requirements.length >= 100} onClick={() => update('requirements', [...document.requirements, newLine()])}>{t('procurement.workflow.tender.addRequirement')}</Button></section>
      <p>{t('procurement.workflow.tender.internalEstimate', { amount: formatMoney(document.requirements.reduce((sum, line) => sum + line.quantity * line.unit_net_minor, 0), document.currency) })}</p>
    </fieldset>}</DialogBody>
    <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={close}>{t('procurement.workflow.common.cancel')}</Button><Button type="submit" disabled={demo || saving || loading || !editable}>{saving ? t('procurement.workflow.common.saving') : t('procurement.workflow.tender.saveWorkingVersion')}</Button></DialogFooter>
  </DialogForm></DialogContent></Dialog>
}
