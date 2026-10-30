'use client'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RequestDetailSkeleton } from './request-detail-skeleton'
import { useSite } from '@/app/context/SiteContext'
import { ProcurementWorkspace, ProcurementState } from '@/app/purchases/procurement/ui/workspace'
import { ProgressiveStatusBar } from '@/app/components/ui/progressive-status-bar'
import { Button } from '@/app/components/ui/button'
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog'
import { getDemoRequestDetail } from '@/lib/demo-data/procurement-workflow'
import { isRealSiteId, isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import type { ResolvedStage, SimulationResult } from '../procurement/domain'
import type { RequestDocument, RequestItem, RequestSummary } from './schema'
import { RequestEditor } from './request-editor'
import { RequestDocumentView } from './request-document'
import { RequestDetailSidebar, canDecideStage } from './request-detail-sidebar'
import { ChevronLeft, Pencil, RotateCw, Send, Check, X } from '@/app/components/ui/icons'

export type Stage = { id: string; revision: number; definition: ResolvedStage; status: string; decisions: { id: string; actor_id: string; decision: string; reason: string; created_at: string }[] }
export type RequestDetailData = {
  request: RequestSummary & { resolved_plan: SimulationResult | null; revalidation_of_revision?: number | null }; actor_id: string; can_manage: boolean; items: RequestItem[]; stages: Stage[];
  audit: { id: string; event: string; actor_id: string; revision: number; created_at: string; snapshot: unknown }[];
}
export function RequestDetail({ id }: { id: string }) {
  const { t } = useProcurementI18n()
  const { currentSite } = useSite()
  if (!currentSite) return <RequestDetailSkeleton />
  if (!isRealSiteId(currentSite.id) && !isDemoSiteId(currentSite.id)) return <p className="p-6">{t('procurement.workflow.request.selectDetailWorkspace')}</p>
  return <WorkspaceDetail key={`${currentSite.id}:${id}`} siteId={currentSite.id} id={id} />
}
function WorkspaceDetail({ siteId, id }: { siteId: string; id: string }) {
  const demo = isDemoSiteId(siteId) || isDemoModeActive()
  const { t, message, valueLabel } = useProcurementI18n()
  const [detail, setDetail] = useState<RequestDetailData | null>(() => demo ? getDemoRequestDetail(siteId, id) : null)
  const [error, setError] = useState(demo && !getDemoRequestDetail(siteId, id) ? 'Demo request not found.' : '')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('approvals')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  const [confirmRevalidation, setConfirmRevalidation] = useState(false)
  const [reload, setReload] = useState(0)
  const endpoint = `/api/procurement/requests/${encodeURIComponent(id)}?site_id=${siteId}`
  useEffect(() => {
    if (demo || isDemoModeActive()) return
    const controller = new AbortController()
    fetch(endpoint, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(result => { if (!controller.signal.aborted) { setDetail(result); setError('') } }).catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Unable to load request') })
    return () => controller.abort()
  }, [demo, endpoint, reload])
  async function mutate(action: string, body: unknown, method = 'POST') {
    if (demo || isDemoModeActive()) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/procurement/requests/${encodeURIComponent(id)}${action}?site_id=${siteId}`, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok || result.error) throw new Error([result.error, ...(result.issues ?? [])].join(' · '))
      setNotice(action === '/revalidate' ? 'procurement.workflow.request.revalidationNotice' : 'procurement.workflow.request.saved'); setEditing(false); setReasons({}); setReload(value => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save request') }
    finally { setBusy(false) }
  }
  if (!detail && !error) return <RequestDetailSkeleton />
  const record = detail?.request
  const items = detail?.items.filter(item => item.revision === record?.revision) ?? []
  const initial: RequestDocument | undefined = record && { title: record.title, description: record.description, currency: record.currency,
    lines: items.map(item => ({ catalog_item_id: item.catalog_item_id, description: item.description, quantity: item.quantity,
      ...(!item.catalog_item_id && item.unit_net_minor !== null ? { unit_estimate_minor: Number(item.unit_net_minor), tax_ids: item.tax_snapshot?.map(tax => tax.id) } : {}) })) }
  const eligibleStages = detail?.stages.filter(stage => stage.revision === record?.revision && canDecideStage(stage, detail.actor_id, !demo && record?.status === 'submitted')) ?? []
  return <ProcurementWorkspace title={record?.title ?? t('procurement.workflow.request.request')} className="bg-muted/50 dark:bg-background" toolbar={
    <div role="toolbar" aria-label={t('procurement.workflow.request.request')} className="flex w-full flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" asChild><Link href="/purchases/requests"><ChevronLeft className="mr-1 h-4 w-4" />{t('procurement.workflow.request.allPurchaseRequests')}</Link></Button>
        {!editing && detail?.can_manage && record && !record.revalidation_of_revision && (demo || ['draft', 'returned'].includes(record.status)) && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(true)}><Pencil className="mr-1 h-4 w-4" />{t('procurement.workflow.request.edit')}</Button>}
        {!editing && detail?.can_manage && record?.status === 'draft' && <Button variant="ghost" size="sm" disabled={busy || demo} onClick={() => void mutate('/submit', { expected_revision: record.revision })}><Send className="mr-1 h-4 w-4" />{t('procurement.workflow.request.submit')}</Button>}
        {!editing && detail?.can_manage && record && (record.status === 'approved' || (record.status === 'returned' && record.revalidation_of_revision)) && <Button variant="ghost" size="sm" disabled={busy || demo} onClick={() => setConfirmRevalidation(true)}><RotateCw className="mr-1 h-4 w-4" />{t('procurement.workflow.request.revalidate')}</Button>}
        <Button variant="ghost" size="sm" disabled={busy || (demo && !detail)} onClick={() => { setEditing(false); setReasons({}); setDetail(demo ? getDemoRequestDetail(siteId, id) : null); setError(''); setReload(value => value + 1) }}><RotateCw className="mr-1 h-4 w-4" />{t('procurement.workflow.request.reloadDiscard')}</Button>
        {!editing && record && eligibleStages.map(stage => <div key={stage.id} role="group" aria-label={stage.definition.name} className="flex flex-wrap items-center gap-1 border-l pl-2">
          <span className="px-1 text-xs text-muted-foreground">{stage.definition.name}</span>
          <Button variant="ghost" size="sm" disabled={busy || !reasons[stage.id]?.trim()} onClick={() => void mutate('/decisions', { expected_revision: record.revision, stage_id: stage.id, decision: 'approve', reason: reasons[stage.id] })}><Check className="mr-1 h-4 w-4" />{t('procurement.workflow.stage.approve')}</Button>
          <Button variant="ghost" size="sm" className="text-destructive" disabled={busy || !reasons[stage.id]?.trim()} onClick={() => void mutate('/decisions', { expected_revision: record.revision, stage_id: stage.id, decision: 'reject', reason: reasons[stage.id] })}><X className="mr-1 h-4 w-4" />{t('procurement.workflow.stage.reject')}</Button>
        </div>)}
      </div>
      {record && <div className="min-w-0 overflow-x-auto"><ProgressiveStatusBar current={record.status} forwardPath={['draft', 'submitted']} outcomes={['approved', 'returned', 'rejected']} successOutcomes={['approved']} labels={valueLabel} styles={{ draft: 'bg-muted', submitted: 'bg-blue-100 text-blue-800', approved: 'bg-emerald-100 text-emerald-800', returned: 'bg-amber-100 text-amber-800', rejected: 'bg-rose-100 text-rose-800' }} disabled onChange={() => undefined} /></div>}
    </div>
  }>
    {demo && <ProcurementDemoNotice />}
    <ConfirmDialog cancelLabel={t('procurement.common.cancel')} open={confirmRevalidation} onOpenChange={setConfirmRevalidation} loading={busy} title={t('procurement.workflow.request.revalidateTitle')}
      description={t('procurement.workflow.request.revalidateDescription')}
      confirmLabel={t('procurement.workflow.request.startRevalidation')} onConfirm={async () => { if (record) await mutate('/revalidate', { expected_revision: record.revision }) }} />
    {detail && error && <p role="alert" className="text-destructive">{message(error)}</p>}{notice && <p role="status">{t(notice)}</p>}
    <ProcurementState loading={!detail && !error} error={!detail ? message(error) : undefined} onRetry={demo ? undefined : () => { setError(''); setReload(value => value + 1) }} />
    {record && detail && <>
      <div className="mx-auto grid w-full max-w-[1240px] min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,800px)_minmax(320px,1fr)]">
        <div className="min-w-0"><RequestDocumentView request={record} items={items} /></div>
        <RequestDetailSidebar detail={detail} demo={demo} tab={tab} onTabChange={setTab} reasons={reasons} onReasonChange={(stageId, reason) => setReasons(current => ({ ...current, [stageId]: reason }))} />
      </div>
      {editing && initial && <RequestEditor siteId={siteId} initial={initial} busy={busy} serverError={error} onCancel={() => setEditing(false)} onSave={document => mutate('', { expected_revision: record.revision, document }, 'PUT')} />}
    </>}
  </ProcurementWorkspace>
}
