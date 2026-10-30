'use client'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { useEffect, useState } from 'react'
import type { ZodIssue } from 'zod'
import { WorkflowValidation } from '@/app/purchases/requests/workflow-validation'
import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Pagination } from '@/app/components/ui/pagination'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { ClipboardList, PlusCircle } from '@/app/components/ui/icons'
import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions'
import { SectionCard, SectionCardHeader, SectionCardContent } from '@/app/components/ui/section-card'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/app/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogForm } from '@/app/components/ui/dialog'
import { ProcurementState } from '../ui/workspace'
import { RuleRowsSkeleton } from '../ui/rule-screen-loading'
import { ReferencePicker } from '../components/reference-picker'
import { Choice, NumberField, TextField, Toggle } from '../components/form-fields'
import { replenishmentDocumentSchema, replenishmentPageSize, type ReplenishmentDocument, type ReplenishmentRule } from './schema'
import { isProcurementDemo as isDemoSiteId } from '../ui/is-demo'
import { demoReplenishmentRules, demoReplenishmentCases } from '@/lib/demo-data/procurement-replenishment'
import { ProcurementDemoNotice } from '../ui/demo-notice'

const initial: ReplenishmentDocument = { name: '', catalog_item_id: '', location_id: '', minimum: 10, target: 40, minimum_order: 1, order_multiple: 1, action: 'draft', enabled: false }
type Result = { status: string; message?: string; request_id?: string | null; quantity?: number; on_hand?: number }
type Case = { id: string; rule_id: string; rule_name: string; request_id: string | null; observed_quantity: number; quantity: number; action: string }
type Queue = { rule_id: string; generation: number; evaluated_generation: number; last_result: Result | null; last_error: string | null }

export function ReplenishmentRules({ siteId, search = '', status = 'all' }: { siteId: string; search?: string; status?: 'all' | 'enabled' | 'disabled' }) {
  return <ScopedRules key={siteId} siteId={siteId} search={search} status={status} />
}
function ScopedRules({ siteId, search, status }: { siteId: string; search: string; status: 'all' | 'enabled' | 'disabled' }) {
  const demo = isDemoSiteId(siteId)
  const { t, message, valueLabel, formatNumber } = useProcurementI18n()
  const [rules, setRules] = useState<ReplenishmentRule[]>(() => demo ? demoReplenishmentRules : []), [loading, setLoading] = useState(!demo), [error, setError] = useState('')
  const [generation, setGeneration] = useState(0), [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<ReplenishmentRule | 'new' | null>(null)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [draft, setDraft] = useState<ReplenishmentDocument>(initial)
  const [cases, setCases] = useState<Case[]>(() => demo ? demoReplenishmentCases : []), [closing, setClosing] = useState<Case | null>(null), [reason, setReason] = useState('')
  const [queue, setQueue] = useState<Queue[]>([])
  const [page, setPage] = useState(1), [casePage, setCasePage] = useState(1)
  const [ruleCount, setRuleCount] = useState(demo ? demoReplenishmentRules.length : 0), [caseCount, setCaseCount] = useState(demo ? demoReplenishmentCases.length : 0)
  const [issues, setIssues] = useState<ZodIssue[]>([])
  const visibleRules = rules.filter(rule => (status === 'all' || rule.enabled === (status === 'enabled')) && rule.name.toLowerCase().includes(search.toLowerCase()));
  const refresh = () => { if (demo) return; setLoading(true); setGeneration(value => value + 1) }
  useEffect(() => {
    if (demo) return
    const controller = new AbortController()
    fetch(`/api/procurement/replenishment?site_id=${siteId}&page=${page}&case_page=${casePage}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body })
      .then(body => {
        if (controller.signal.aborted) return
        setRules(body.rules); setCases(body.cases ?? []); setQueue(body.queue ?? []); setError('')
        setRuleCount(body.rule_count); setCaseCount(body.case_count)
        setPage(current => Math.min(current, Math.max(1, Math.ceil(body.rule_count / replenishmentPageSize))))
        setCasePage(current => Math.min(current, Math.max(1, Math.ceil(body.case_count / replenishmentPageSize))))
      })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, generation, page, casePage, demo])
  async function save() {
    if (demo) return
    const parsed = replenishmentDocumentSchema.safeParse(draft)
    if (!parsed.success) { setIssues(parsed.error.issues); return }
    setIssues([])
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/procurement/replenishment?site_id=${siteId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing === 'new' ? null : editing?.id, expected_version: editing === 'new' ? 0 : editing?.version, document: parsed.data }) })
      const body = await response.json(); if (!response.ok) throw new Error(body.error)
      setEditing(null); refresh()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save') }
    finally { setBusy(false) }
  }
  async function check(rule: ReplenishmentRule) {
    if (demo) { setResults(current => ({ ...current, [rule.id]: { status: 'alert', message: 'Demo only: 5 adapters on hand; suggested replenishment 35. No request was created.', on_hand: 5, quantity: 35 } })); return }
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/procurement/replenishment/${rule.id}/evaluate?site_id=${siteId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const body = await response.json(); if (!response.ok) throw new Error(body.error)
      setResults(current => ({ ...current, [rule.id]: body }))
      refresh()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to check stock') }
    finally { setBusy(false) }
  }
  async function closeCase() {
    if (demo) return
    if (!closing || !reason.trim() || busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/procurement/replenishment/cases/${closing.id}/close?site_id=${siteId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      })
      const body = await response.json(); if (!response.ok) throw new Error(body.error)
      setClosing(null); setReason(''); refresh()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to close case') }
    finally { setBusy(false) }
  }
  return <>
    {demo && <ProcurementDemoNotice />}
    <TopBarPrimaryActions>
      <Button type="button" size="sm" disabled={busy || loading} onClick={() => { setDraft(initial); setEditing('new'); setIssues([]) }}>
        <PlusCircle className="mr-2 h-4 w-4" />{t('procurement.workflow.replenishment.create')}
      </Button>
    </TopBarPrimaryActions>
    <SectionCard id="procurement-replenishment-minimums" className="scroll-mt-36"><SectionCardHeader title={t('procurement.workflow.replenishment.inventory')} description={t('procurement.workflow.replenishment.description')}
      className="flex-wrap" />
      <SectionCardContent><p className="mb-4 text-sm text-muted-foreground">{t('procurement.workflow.replenishment.workerDescription')}</p>
        {loading ? <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true"><RuleRowsSkeleton /></div>
          : <ProcurementState error={!editing ? message(error) : null} onRetry={refresh} />}
        {!loading && !error && !!visibleRules.length && <Table className="min-w-[800px]"><TableHeader><TableRow><TableHead>{t('procurement.workflow.replenishment.rule')}</TableHead><TableHead>{t('procurement.workflow.replenishment.minimumTarget')}</TableHead><TableHead>{t('procurement.workflow.replenishment.action')}</TableHead><TableHead>{t('procurement.workflow.replenishment.latestCheck')}</TableHead><TableHead>{t('procurement.workflow.replenishment.actions')}</TableHead></TableRow></TableHeader><TableBody>
          {visibleRules.map(rule => <TableRow key={rule.id}><TableCell>{rule.name}<Badge variant="outline" className="ml-2">{rule.enabled ? t('procurement.workflow.replenishment.enabled') : t('procurement.workflow.replenishment.disabled')}</Badge></TableCell>
            <TableCell>{formatNumber(rule.minimum)} / {formatNumber(rule.target)}</TableCell><TableCell>{rule.action === 'draft' ? t('procurement.workflow.replenishment.createDraft') : t('procurement.workflow.replenishment.recordAlert')}</TableCell>
            <TableCell>{results[rule.id] ? <><p>{results[rule.id].message ? message(results[rule.id].message) : valueLabel(results[rule.id].status)}</p>{results[rule.id].request_id && <Link className="underline" href={`/purchases/requests/${results[rule.id].request_id}`}>{t('procurement.workflow.replenishment.openRequest')}</Link>}</> : t('procurement.workflow.replenishment.notChecked')}
              {queue.filter(job => job.rule_id === rule.id).map(job => <p key={job.rule_id} className="text-xs text-muted-foreground">{t('procurement.workflow.replenishment.worker', { status: job.generation > job.evaluated_generation ? valueLabel('pending') : job.last_error ? message(job.last_error) : job.last_result?.message ? message(job.last_result.message) : job.last_result?.status ? valueLabel(job.last_result.status) : t('procurement.workflow.replenishment.notProcessed') })}</p>)}
            </TableCell>
            <TableCell><Button variant="ghost" size="sm" disabled={busy} onClick={() => { setEditing(rule); setIssues([]); setDraft({ name: rule.name, catalog_item_id: rule.catalog_item_id, location_id: rule.location_id, minimum: rule.minimum, target: rule.target, minimum_order: rule.minimum_order, order_multiple: rule.order_multiple, action: rule.action, enabled: rule.enabled }) }}>{t('procurement.workflow.common.edit')}</Button>
              <Button variant="ghost" size="sm" disabled={busy || !rule.enabled} onClick={() => void check(rule)}>{t('procurement.workflow.replenishment.checkStock')}</Button></TableCell></TableRow>)}
        </TableBody></Table>}
        {!loading && !error && !visibleRules.length && <EmptyCard title={t('procurement.workflow.replenishment.noRules')} description=""
          icon={<ClipboardList size={24} />} showShadow={false} showHint={false} contentClassName="min-h-[180px] py-6" />}
        {!error && <nav aria-label={t('procurement.workflow.replenishment.rulePages')} className="mt-4 flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{t('procurement.workflow.replenishment.ruleCount', { count: formatNumber(ruleCount) })}</span>
          <Pagination currentPage={page} totalPages={Math.ceil(ruleCount / replenishmentPageSize)} disabled={busy || loading}
            onPageChange={value => { setLoading(true); setPage(value) }} /></nav>}
      </SectionCardContent></SectionCard>
    <SectionCard id="procurement-replenishment-cases" className="scroll-mt-36"><SectionCardHeader title={t('procurement.workflow.replenishment.openCases')} description={t('procurement.workflow.replenishment.caseDescription')} />
      <SectionCardContent>{loading && <RuleRowsSkeleton cases />}{!loading && !error && cases.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
        <div><p>{item.rule_name} · {valueLabel(item.action)}</p><p className="text-sm text-muted-foreground">{t('procurement.workflow.replenishment.observedQuantity', { stock: formatNumber(item.observed_quantity), quantity: formatNumber(item.quantity) })}</p>
          {item.request_id && <Link className="underline" href={`/purchases/requests/${item.request_id}`}>{t('procurement.workflow.replenishment.openRequest')}</Link>}</div>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setClosing(item); setReason('') }}>{t('procurement.workflow.replenishment.resolveCase')}</Button>
      </div>)}{!cases.length && !loading && !error && <EmptyCard title={t('procurement.workflow.replenishment.noCases')} description=""
        icon={<ClipboardList size={24} />} showShadow={false} showHint={false} contentClassName="min-h-[180px] py-6" />}
        {!error && <nav aria-label={t('procurement.workflow.replenishment.casePages')} className="mt-4 flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{t('procurement.workflow.replenishment.caseCount', { count: formatNumber(caseCount) })}</span>
          <Pagination currentPage={casePage} totalPages={Math.ceil(caseCount / replenishmentPageSize)} disabled={busy || loading}
            onPageChange={value => { setLoading(true); setCasePage(value) }} /></nav>}
      </SectionCardContent></SectionCard>
    <Dialog open={closing !== null} onOpenChange={open => { if (!open && !busy) setClosing(null) }}><DialogContent closeLabel={t('procurement.navigation.closeDialog')} busy={busy}><DialogHeader><DialogTitle>{t('procurement.workflow.replenishment.resolveTitle')}</DialogTitle><DialogDescription>{t('procurement.workflow.replenishment.resolveDescription')}</DialogDescription></DialogHeader>
      <DialogForm onSubmit={event => { event.preventDefault(); void closeCase() }}><DialogBody><TextField label={t('procurement.workflow.replenishment.reason')} value={reason} onChange={setReason} />{error && <p role="alert">{message(error)}</p>}</DialogBody>
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setClosing(null)}>{t('procurement.workflow.common.cancel')}</Button><Button type="submit" disabled={demo || busy || !reason.trim()}>{t('procurement.workflow.replenishment.resolveCase')}</Button></DialogFooter></DialogForm>
    </DialogContent></Dialog>
    <Dialog open={editing !== null} onOpenChange={open => { if (!open && !busy) setEditing(null) }}><DialogContent closeLabel={t('procurement.navigation.closeDialog')} size="lg" busy={busy}><DialogHeader><DialogTitle>{t('procurement.workflow.replenishment.ruleTitle')}</DialogTitle><DialogDescription>{t('procurement.workflow.replenishment.editorDescription')}</DialogDescription></DialogHeader>
      <DialogForm onSubmit={event => { event.preventDefault(); void save() }}><DialogBody className="space-y-4"><fieldset disabled={busy} className="space-y-4">
        {error && <p role="alert" className="text-sm text-destructive">{message(error)}</p>}
        <WorkflowValidation issues={issues} kind="replenishment" />
        <TextField label={t('procurement.workflow.replenishment.ruleName')} value={draft.name} onChange={name => setDraft({ ...draft, name })} />
        <ReferencePicker siteId={siteId} kind="products" label={t('procurement.workflow.replenishment.stockSku')} single disabled={busy || editing !== 'new'} ids={draft.catalog_item_id ? [draft.catalog_item_id] : []} onChange={ids => setDraft({ ...draft, catalog_item_id: ids[0] ?? '' })} />
        <ReferencePicker siteId={siteId} kind="locations" label={t('procurement.workflow.replenishment.stockLocation')} single disabled={busy || editing !== 'new'} ids={draft.location_id ? [draft.location_id] : []} onChange={ids => setDraft({ ...draft, location_id: ids[0] ?? '' })} />
        <div className="grid gap-4 sm:grid-cols-2"><NumberField label={t('procurement.workflow.replenishment.minimumStock')} min={0} value={draft.minimum} onChange={minimum => setDraft({ ...draft, minimum })} />
          <NumberField label={t('procurement.workflow.replenishment.targetStock')} value={draft.target} onChange={target => setDraft({ ...draft, target })} />
          <NumberField label={t('procurement.workflow.replenishment.minimumPurchase')} value={draft.minimum_order} onChange={minimum_order => setDraft({ ...draft, minimum_order })} />
          <NumberField label={t('procurement.workflow.replenishment.purchaseMultiple')} value={draft.order_multiple} onChange={order_multiple => setDraft({ ...draft, order_multiple })} /></div>
        <Choice label={t('procurement.workflow.replenishment.action')} value={draft.action} options={['alert', 'draft']} disabled={busy} onChange={action => setDraft({ ...draft, action })} />
        <Toggle label={t('procurement.workflow.replenishment.enabled')} checked={draft.enabled} onChange={enabled => setDraft({ ...draft, enabled })} />
      </fieldset></DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(null)}>{t('procurement.workflow.common.cancel')}</Button><Button type="submit" disabled={demo || busy}>{t('procurement.workflow.replenishment.save')}</Button></DialogFooter></DialogForm>
    </DialogContent></Dialog>
  </>
}
