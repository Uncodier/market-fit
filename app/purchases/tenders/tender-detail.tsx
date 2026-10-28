'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSite } from '@/app/context/SiteContext'
import { ProcurementWorkspace, ProcurementState } from '@/app/purchases/procurement/ui/workspace'
import { EntityAvatar } from '@/app/components/documents/document-list'
import { ProgressiveStatusBar } from '@/app/components/ui/progressive-status-bar'
import { Tabs, TabsContent } from '@/app/components/ui/tabs'
import { ResponsiveTabsList } from '@/app/components/ui/responsive-tabs-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table'
import { SectionCard } from '@/app/components/ui/section-card'
import { RelationSelect } from '@/app/components/ui/relation-select'
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog'
import { humanize } from '@/app/purchases/procurement/components/form-fields'
import { Button } from '@/app/components/ui/button'
import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions'
import { isRealSiteId } from '@/lib/demo-utils'
import { EventApprovals } from '@/app/purchases/procurement/approvals/event-approvals'
import type { Tender, TenderPublication } from './schema'

type Participant = { id: string; supplier_id: string; status: string; suppliers: { name: string } | null }
type Detail = { tender: Tender; publications: TenderPublication[]; participants: Participant[]; site_slug: string; portal_enabled: boolean }
export function TenderDetail({ id }: { id: string }) {
  const { currentSite } = useSite()
  if (!currentSite || !isRealSiteId(currentSite.id)) return <p className="p-6">Select a real workspace to manage tenders.</p>
  return <DetailView key={`${currentSite.id}:${id}`} siteId={currentSite.id} id={id} />
}
function DetailView({ siteId, id }: { siteId: string; id: string }) {
  const router = useRouter()
  const [tab, setTab] = useState('about')
  const [confirmation, setConfirmation] = useState<'cancel' | 'delete' | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false), [reload, setReload] = useState(0), [loading, setLoading] = useState(true)
  const [loadedAt, setLoadedAt] = useState(0)
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]), [supplier, setSupplier] = useState(''), [supplierError, setSupplierError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/procurement/tenders/${id}?site_id=${siteId}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(result => { if (!controller.signal.aborted) { setDetail(result); setLoadedAt(Date.now()); setError('') } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Unable to load tender') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    fetch(`/api/procurement/suppliers?site_id=${siteId}&status=approved`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(result => { if (!controller.signal.aborted) setSuppliers(result.suppliers) })
      .catch(reason => { if (!controller.signal.aborted) setSupplierError(reason.message || 'Unable to load suppliers') })
    return () => controller.abort()
  }, [id, siteId, reload])
  async function action(path: string, body: Record<string, unknown>, method = 'POST') {
    if (!detail) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/procurement/tenders/${id}${path}?site_id=${siteId}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, expected_version: detail.tender.version }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      if (body.action === 'delete') { router.push('/purchases/tenders'); return }
      setNotice(result.status === 'pending' ? 'Publication approval is pending. No new terms have been published.' : path === '/publish' ? 'Publication completed.' : 'Tender updated.')
      setReload(value => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update tender') } finally { setBusy(false) }
  }
  const tender = detail?.tender
  async function togglePortal() {
    if (!detail) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/procurement/tenders/portal?site_id=${siteId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !detail.portal_enabled }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      setReload(value => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update portal') } finally { setBusy(false) }
  }
  return <ProcurementWorkspace title={tender?.title ?? 'Tender'} toolbar={<div className="flex w-full flex-wrap items-center justify-between gap-3 py-3"><Button variant="ghost" size="sm" asChild><Link href="/purchases/tenders">All tenders</Link></Button>
    <div className="flex flex-wrap items-center gap-2">
      {!loading && tender && detail && <>
        {['draft', 'published'].includes(tender.status) && <><Button variant="ghost" size="sm" asChild><Link href={`/purchases/tenders/${id}/edit`}>Edit working version</Link></Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmation('cancel')}>Cancel tender</Button></>}
        {tender.status === 'draft' && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmation('delete')}>Delete draft</Button>}
        {tender.status === 'published' && detail.publications[0] && Date.parse(detail.publications[0].snapshot.participation_deadline) <= loadedAt && <Button variant="ghost" size="sm" disabled={busy} onClick={() => action('', { action: 'close' }, 'PATCH')}>Close participation</Button>}
      </>}
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setReload(value => value + 1)}>Refresh</Button>
    </div></div>}>
    <TopBarPrimaryActions>{!loading && tender && detail && ['draft', 'published'].includes(tender.status) && !detail.publications.some(row => row.version === tender.version) && <Button size="sm" disabled={busy} onClick={() => action('/publish', {})}>Request publication</Button>}</TopBarPrimaryActions>
    {detail && error && <p role="alert" className="text-destructive">{error}</p>}{notice && <p role="status">{notice}</p>}
    <ProcurementState loading={loading} error={!detail ? error : undefined} onRetry={() => { setLoading(true); setError(''); setReload(value => value + 1) }} />
    {!loading && tender && detail && <>
      <header className="flex items-start gap-3"><EntityAvatar name={tender.title} className="h-11 w-11" /><div><h2 className="text-xl font-semibold">{tender.title}</h2><p className="mt-1 text-sm text-muted-foreground">Working version {tender.version} · {humanize(tender.visibility)}{tender.global_visible ? ' · Global discovery enabled' : ''}</p></div></header>
      <div className="space-y-2 rounded-xl border bg-card px-5 py-3"><ProgressiveStatusBar current={tender.status} forwardPath={['draft', 'published']} outcomes={['closed', 'cancelled']} successOutcomes={['closed']} labels={humanize} styles={{ draft: 'bg-muted', published: 'bg-emerald-100 text-emerald-800', closed: 'bg-blue-100 text-blue-800', cancelled: 'bg-rose-100 text-rose-800' }} disabled onChange={() => undefined} /><p className="text-xs text-muted-foreground">Read-only status. Use the authorized publication and participation actions below.</p></div>
      <Tabs value={tab} onValueChange={setTab}><ResponsiveTabsList tabs={[{ value: 'about', label: 'About' }, { value: 'lines', label: 'Lines' }, { value: 'suppliers', label: 'Suppliers' }, { value: 'approvals', label: 'Approvals' }, { value: 'activity', label: 'Activity' }]} activeTab={tab} onTabChange={setTab} />
      <TabsContent value="about" className="mt-6 space-y-4"><SectionCard className="space-y-4 p-5">
      <p className="text-sm text-muted-foreground">Publication runs its own policy approval. Linked request approval is not publication approval. Draft edits do not change the latest published terms until a new publication is approved.</p>
      {tender.request_id && <Link className="underline" href={`/purchases/requests/${tender.request_id}`}>Linked purchase request</Link>}
      </SectionCard></TabsContent><TabsContent value="lines" className="mt-6"><SectionCard className="space-y-3 p-5"><h2 className="text-lg font-semibold">Working requirements</h2><p className="whitespace-pre-wrap">{tender.description}</p>
        <p>Participation closes: {new Date(tender.participation_deadline).toLocaleString('en')}<br />Opening: {new Date(tender.opening_at).toLocaleString('en')}</p>
        <p>Internal net estimate: {tender.currency} {(Number(tender.net_amount_minor) / 100).toFixed(2)}</p>
        <Table><TableHeader><TableRow><TableHead>Requirement</TableHead><TableHead>Quantity</TableHead><TableHead>Unit net estimate</TableHead></TableRow></TableHeader><TableBody>{tender.requirements.map(line => <TableRow key={line.id}><TableCell className="font-medium">{line.description}</TableCell><TableCell>{line.quantity} {line.unit}</TableCell><TableCell>{tender.currency} {(line.unit_net_minor / 100).toFixed(2)}</TableCell></TableRow>)}</TableBody></Table>
      </SectionCard></TabsContent><TabsContent value="activity" className="mt-6"><SectionCard className="space-y-3 p-5"><h2 className="text-lg font-semibold">Publications</h2>
        <div className="rounded border p-3"><p>Workspace tender portal: {detail.portal_enabled ? 'enabled' : 'disabled'}. Disabling removes all public and unlisted access immediately.</p><Button variant="outline" disabled={busy} onClick={togglePortal}>{detail.portal_enabled ? 'Disable workspace portal' : 'Enable workspace portal'}</Button><Link className="ml-3 underline" href={`/tenders/${detail.site_slug}`}>Workspace portal</Link></div>
        {detail.publications.length === 0 ? <p>Not published. No public access is available.</p> : <>
          <Link className="underline" href={`/tenders/${detail.site_slug}/${tender.portal_slug}`}>Open latest public publication</Link><p className="text-xs text-muted-foreground">Private publications are not available on public pages.</p>
          {detail.publications.map(publication => <details className="rounded border p-3" key={publication.id}><summary>Version {publication.version} · {new Date(publication.published_at).toLocaleString('en')}</summary><h3 className="mt-3 font-medium">{publication.snapshot.title}</h3><p className="whitespace-pre-wrap">{publication.snapshot.description}</p><p>Participation closes: {new Date(publication.snapshot.participation_deadline).toLocaleString('en')}</p><ul>{publication.snapshot.requirements.map(line => <li key={line.id}>{line.description} — {line.quantity} {line.unit}</li>)}</ul></details>)}
        </>}
      </SectionCard></TabsContent><TabsContent value="suppliers" className="mt-6"><SectionCard className="space-y-3 p-5"><h2 className="text-lg font-semibold">Invited suppliers</h2><p className="text-sm text-muted-foreground">Internal invitation register. This does not send email, grant organization representation, or submit a quotation.</p>
        {supplierError && <p role="alert">{supplierError}</p>}
        {['draft', 'published'].includes(tender.status) && <div className="flex flex-wrap gap-3"><RelationSelect label="Approved supplier" disabled={busy} allowCreate={false} placeholder="Select an approved supplier" value={supplier ? { mode: 'existing', id: supplier, label: suppliers.find(row => row.id === supplier)?.name ?? 'Supplier' } : null} options={suppliers.map(row => ({ id: row.id, label: row.name }))} onValueChange={value => setSupplier(value?.mode === 'existing' ? value.id : '')} /><Button disabled={!supplier || busy} onClick={() => action('/participants', { supplier_id: supplier, status: 'invited' })}>Register invitation</Button></div>}
        {!detail.participants.length ? <p>No suppliers invited.</p> : <ul className="space-y-2">{detail.participants.map(participant => <li key={participant.id} className="flex items-center gap-3 rounded border p-3"><Link className="underline" href={`/suppliers/${participant.supplier_id}`}>{participant.suppliers?.name ?? 'Supplier'}</Link><span>{participant.status}</span>{participant.status === 'invited' && ['draft', 'published'].includes(tender.status) && <Button variant="outline" disabled={busy} onClick={() => action('/participants', { supplier_id: participant.supplier_id, status: 'withdrawn' })}>Withdraw invitation</Button>}</li>)}</ul>}
      </SectionCard></TabsContent><TabsContent value="approvals" className="mt-6">
      <EventApprovals key={reload} siteId={siteId} targetId={id} onDecision={() => setReload(value => value + 1)} />
      </TabsContent></Tabs><Button variant="outline" asChild><Link href="/purchases/quotes">Received quotations</Link></Button>
    </>}
    <ConfirmDialog open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null) }} loading={busy} title={confirmation === 'delete' ? 'Delete this unpublished draft?' : 'Cancel this tender?'} description="Public access will be removed. The audit record is retained." onConfirm={async () => { if (confirmation) await action('', { action: confirmation }, 'PATCH'); setConfirmation(null) }} />
  </ProcurementWorkspace>
}