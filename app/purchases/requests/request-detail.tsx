'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSite } from '@/app/context/SiteContext'
import { ProcurementWorkspace, ProcurementState } from '@/app/purchases/procurement/ui/workspace'
import { EntityAvatar } from '@/app/components/documents/document-list'
import { ProgressiveStatusBar } from '@/app/components/ui/progressive-status-bar'
import { Tabs, TabsContent } from '@/app/components/ui/tabs'
import { ResponsiveTabsList } from '@/app/components/ui/responsive-tabs-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table'
import { SectionCard, SectionCardContent, SectionCardHeader } from '@/app/components/ui/section-card'
import { humanize } from '@/app/purchases/procurement/components/form-fields'
import { Button } from '@/app/components/ui/button'
import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions'
import { Textarea } from '@/app/components/ui/textarea'
import { isRealSiteId } from '@/lib/demo-utils'
import type { ResolvedStage, SimulationResult } from '../procurement/domain'
import type { RequestDocument, RequestItem, RequestSummary } from './schema'
import { RequestEditor } from './request-editor'

type Stage = { id: string; revision: number; definition: ResolvedStage; status: string; decisions: { id: string; actor_id: string; decision: string; reason: string; created_at: string }[] }
type Detail = {
  request: RequestSummary & { resolved_plan: SimulationResult | null }; actor_id: string; can_manage: boolean; items: RequestItem[]; stages: Stage[];
  audit: { id: string; event: string; actor_id: string; revision: number; created_at: string; snapshot: unknown }[];
}
export function RequestDetail({ id }: { id: string }) {
  const { currentSite } = useSite()
  if (!currentSite || !isRealSiteId(currentSite.id)) return <p className="p-6">Select a real workspace to view this request.</p>
  return <WorkspaceDetail key={`${currentSite.id}:${id}`} siteId={currentSite.id} id={id} />
}
function WorkspaceDetail({ siteId, id }: { siteId: string; id: string }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('about')
  const [editing, setEditing] = useState(false)
  const [reload, setReload] = useState(0)
  const endpoint = `/api/procurement/requests/${encodeURIComponent(id)}?site_id=${siteId}`
  useEffect(() => {
    const controller = new AbortController()
    fetch(endpoint, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(result => { if (!controller.signal.aborted) { setDetail(result); setError('') } }).catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Unable to load request') })
    return () => controller.abort()
  }, [endpoint, reload])
  async function mutate(action: string, body: unknown, method = 'POST') {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/procurement/requests/${encodeURIComponent(id)}${action}?site_id=${siteId}`, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok || result.error) throw new Error([result.error, ...(result.issues ?? [])].join(' · '))
      setNotice('Saved successfully.'); setEditing(false); setReload(value => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save request') }
    finally { setBusy(false) }
  }
  const record = detail?.request
  const items = detail?.items.filter(item => item.revision === record?.revision) ?? []
  const initial: RequestDocument | undefined = record && { title: record.title, description: record.description, currency: record.currency,
    lines: items.map(item => ({ catalog_item_id: item.catalog_item_id, description: item.description, quantity: item.quantity,
      ...(!item.catalog_item_id && item.unit_net_minor !== null ? { unit_estimate_minor: Number(item.unit_net_minor), tax_ids: item.tax_snapshot?.map(tax => tax.id) } : {}) })) }
  return <ProcurementWorkspace title={record?.title ?? 'Purchase request'} toolbar={<div className="flex w-full items-center justify-between gap-3 py-3"><Button variant="ghost" size="sm" asChild><Link href="/purchases/requests">All purchase requests</Link></Button>
    <div className="flex items-center gap-2">
      {!editing && detail?.can_manage && record && ['draft', 'returned'].includes(record.status) && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(true)}>Edit request</Button>}
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setEditing(false); setDetail(null); setError(''); setReload(value => value + 1) }}>Reload request (discard edits)</Button>
    </div></div>}>
    <TopBarPrimaryActions>{!editing && detail?.can_manage && record?.status === 'draft' && <Button size="sm" disabled={busy} onClick={() => void mutate('/submit', { expected_revision: record.revision })}>Submit for approval</Button>}</TopBarPrimaryActions>
    {detail && error && <p role="alert" className="text-destructive">{error}</p>}{notice && <p role="status">{notice}</p>}
    <ProcurementState loading={!detail && !error} error={!detail ? error : undefined} onRetry={() => { setError(''); setReload(value => value + 1) }} />
    {record && detail && <>
      <header className="flex items-start gap-3"><EntityAvatar name={record.title} className="h-11 w-11" /><div><h2 className="text-xl font-semibold">{record.title}</h2><p className="mt-1 text-sm text-muted-foreground">Revision {record.revision} · {record.currency} {(Number(record.net_amount_minor) / 100).toFixed(2)} net</p><p className="mt-1 text-xs text-muted-foreground">{record.policy_revision ? `Pinned policy revision ${record.policy_revision}` : 'No submitted policy snapshot'}</p></div></header>
      <div className="space-y-2 rounded-xl border bg-card px-5 py-3"><ProgressiveStatusBar current={record.status} forwardPath={['draft', 'submitted']} outcomes={['approved', 'returned', 'rejected']} successOutcomes={['approved']} labels={humanize} styles={{ draft: 'bg-muted', submitted: 'bg-blue-100 text-blue-800', approved: 'bg-emerald-100 text-emerald-800', returned: 'bg-amber-100 text-amber-800', rejected: 'bg-rose-100 text-rose-800' }} disabled onChange={() => undefined} /><p className="text-xs text-muted-foreground">Read-only status. Submit and approval actions enforce the saved policy.</p></div>
      {editing && initial ? <RequestEditor siteId={siteId} initial={initial} busy={busy} serverError={error} onCancel={() => setEditing(false)} onSave={document => mutate('', { expected_revision: record.revision, document }, 'PUT')} /> : <>

        <Tabs value={tab} onValueChange={setTab}><ResponsiveTabsList tabs={[{ value: 'about', label: 'About' }, { value: 'lines', label: 'Lines' }, { value: 'approvals', label: 'Approvals' }, { value: 'activity', label: 'Activity' }]} activeTab={tab} onTabChange={setTab} />
        <TabsContent value="about" className="mt-6"><SectionCard><SectionCardHeader title="Request information" /><SectionCardContent><p className="whitespace-pre-wrap text-sm">{record.description || 'No description provided.'}</p><p className="mt-4 text-xs text-muted-foreground">Requester {record.requester_id}</p></SectionCardContent></SectionCard></TabsContent>
        <TabsContent value="lines" className="mt-6 space-y-3"><h2 className="text-lg font-semibold">Request lines</h2>
        <SectionCard><Table><TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Quantity</TableHead><TableHead>Unit net</TableHead><TableHead>Tax snapshot</TableHead></TableRow></TableHeader><TableBody>{items.map(item => <TableRow key={item.id}>
          <TableCell><p className="text-sm font-medium">{item.description}</p><p className="text-xs text-muted-foreground">{item.valuation_source === 'manager_estimate' ? 'Internal manager estimate' : 'Catalog cost'}</p></TableCell>
          <TableCell>{item.quantity}</TableCell><TableCell>{item.unit_net_minor === null ? 'Unpriced service' : `${record.currency} ${(Number(item.unit_net_minor) / 100).toFixed(2)}`}</TableCell>
          <TableCell className="text-xs text-muted-foreground">{item.tax_snapshot === null ? 'Unresolved — submission blocked' : item.tax_snapshot.length ? item.tax_snapshot.map(tax => `${tax.name} ${tax.rate}%`).join(', ') : 'No active catalog taxes'}</TableCell>
        </TableRow>)}</TableBody></Table></SectionCard>
        </TabsContent><TabsContent value="approvals" className="mt-6 space-y-4"><h2 className="text-lg font-semibold">Approvals</h2>
        {record.resolved_plan && <p className="text-sm">Source: {record.resolved_plan.source} · Cross-rule votes: {record.resolved_plan.crossRuleCounting}. Requirements and supplier proposal counts are retained for downstream enforcement, not waived by request approval.</p>}
        {detail.stages.filter(stage => stage.revision === record.revision).map(stage => <StageCard key={stage.id} stage={stage} actorId={detail.actor_id} active={record.status === 'submitted'} busy={busy}
          decide={(decision, reason) => mutate('/decisions', { expected_revision: record.revision, stage_id: stage.id, decision, reason })} />)}
        {record.status === 'draft' && <p>No approval plan yet. Submission resolves the saved policy on the server.</p>}
        {record.resolved_plan && <details className="rounded border p-3"><summary>Resolved policy plan and requirements</summary><pre className="overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(record.resolved_plan, null, 2)}</pre></details>}
        </TabsContent><TabsContent value="activity" className="mt-6"><SectionCard><SectionCardHeader title="Activity" description="Latest 200 events; earlier revisions remain retained." /><SectionCardContent><ol className="divide-y">{detail.audit.map(event => <li key={event.id} className="py-3"><p className="text-sm font-medium">{humanize(event.event)}</p><p className="text-xs text-muted-foreground">Revision {event.revision} · {new Date(event.created_at).toLocaleString('en')}</p><details className="mt-2 text-xs text-muted-foreground"><summary>Audit snapshot</summary><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(event.snapshot, null, 2)}</pre></details></li>)}</ol>{!detail.audit.length && <p className="text-sm text-muted-foreground">No activity recorded.</p>}</SectionCardContent></SectionCard></TabsContent></Tabs>
      </>}
    </>}
  </ProcurementWorkspace>
}
function StageCard({ stage, actorId, active, busy, decide }: { stage: Stage; actorId: string; active: boolean; busy: boolean; decide: (decision: 'approve' | 'reject', reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const definition = stage.definition
  const eligible = active && stage.status === 'pending' && definition.decisionMode === 'human' && definition.approverIds.includes(actorId) && !stage.decisions.some(vote => vote.actor_id === actorId)
  const required = definition.quorum.mode === 'all' ? definition.approverIds.length : definition.quorum.mode === 'n_of_m' ? definition.quorum.count : 1
  return <SectionCard className="space-y-3 p-5 text-sm"><h3 className="font-semibold">{definition.name} · {stage.status}</h3>
    <p>{definition.decisionMode} · {definition.execution} · {stage.decisions.filter(vote => vote.decision === 'approve').length}/{required} approvals · Rejection: {definition.rejectionBehavior}</p>
    <p className="break-all text-sm">Eligible: {definition.approverIds.join(', ') || 'Delegated AI only'}</p>
    <p className="break-all text-sm">Mandatory: {definition.mandatoryApproverIds.join(', ') || 'None'} · Deadline: {definition.resolvedDeadline ? new Date(definition.resolvedDeadline).toLocaleString('en') : 'None'}</p>
    {definition.decisionMode !== 'human' && <p role="status">Pending AI integration. No AI recommendation or automatic decision has been produced; this stage cannot be approved here.</p>}
    {stage.decisions.map(vote => <p key={vote.id} className="text-sm">{vote.actor_id}: {vote.decision} — {vote.reason}</p>)}
    {eligible && <><label className="block">Decision reason<Textarea maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <div className="flex gap-3"><Button disabled={busy || !reason.trim()} onClick={() => void decide('approve', reason)}>Approve stage</Button>
        <Button variant="destructive" disabled={busy || !reason.trim()} onClick={() => void decide('reject', reason)}>Reject stage</Button></div></>}
  </SectionCard>
}
