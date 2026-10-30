'use client'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TenderDetailSkeleton } from './tender-detail-skeleton'
import { ProcurementQuotesPanel } from '@/app/purchases/procurement/commerce/ProcurementQuotesPanel'
import { useSite } from '@/app/context/SiteContext'
import { toSiteSlug } from '@/app/book/site-slug'
import { ProcurementState } from '@/app/purchases/procurement/ui/workspace'
import { EntityAvatar } from '@/app/components/documents/document-list'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/app/components/ui/dropdown-menu'
import { TenderProperties, TenderStatusSegments } from './tender-properties'
import { TenderActivity } from './tender-activity'
import type { TenderReceiptActivity } from './receipt-activity'
import { Tabs, TabsContent } from '@/app/components/ui/tabs'
import { ResponsiveTabsList } from '@/app/components/ui/responsive-tabs-list'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table'
import { SectionCard } from '@/app/components/ui/section-card'
import { RelationSelect } from '@/app/components/ui/relation-select'
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog'
import { Button } from '@/app/components/ui/button'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { Users, MoreHorizontal, Trash2, XCircle } from '@/app/components/ui/icons'
import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions'
import { getDemoTenderDetail, demoTenderSuppliers } from '@/lib/demo-data/procurement-workflow'
import { isRealSiteId, isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { EventApprovals } from '@/app/purchases/procurement/approvals/event-approvals'
import type { Tender, TenderPublication } from './schema'

type Participant = { id: string; supplier_id: string; status: string; suppliers: { name: string } | null }
export type TenderDetailData = { tender: Tender; publications: TenderPublication[]; receipt_activity?: TenderReceiptActivity[]; participants: Participant[]; site_slug: string; portal_enabled: boolean; publication_pending: boolean }
export function TenderDetail({ id }: { id: string }) {
  const { t } = useProcurementI18n()
  const { currentSite } = useSite()
  if (!currentSite) return <TenderDetailSkeleton />
  if (!isRealSiteId(currentSite.id) && !isDemoSiteId(currentSite.id)) return <p className="p-6">{t('procurement.workflow.tender.selectWorkspace')}</p>
  return <DetailView key={`${currentSite.id}:${id}`} siteId={currentSite.id} siteSlug={toSiteSlug(currentSite.name)} id={id} />
}
function DetailView({ siteId, siteSlug, id }: { siteId: string; siteSlug: string; id: string }) {
  const demo = isDemoSiteId(siteId) || isDemoModeActive()
  // Keep nested panels inside the demo boundary even while SiteContext is stale.
  const panelSiteId = demo && !isDemoSiteId(siteId) ? 'demo-procurement-preview' : siteId
  const { t, message, valueLabel, formatNumber, formatMoney } = useProcurementI18n()
  const router = useRouter()
  const [tab, setTab] = useState('activity')
  const [confirmation, setConfirmation] = useState<'cancel' | 'delete' | null>(null)
  const [detail, setDetail] = useState<TenderDetailData | null>(() => demo ? getDemoTenderDetail(siteId, id) : null), [error, setError] = useState(demo && !getDemoTenderDetail(siteId, id) ? 'Demo tender not found.' : ''), [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false), [reload, setReload] = useState(0), [loading, setLoading] = useState(!demo)
  const [loadedAt, setLoadedAt] = useState(0)
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>(demo ? demoTenderSuppliers : []), [supplier, setSupplier] = useState(''), [supplierError, setSupplierError] = useState('')
  useEffect(() => {
    if (demo || isDemoModeActive()) return
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
  }, [demo, id, siteId, reload])
  async function action(path: string, body: Record<string, unknown>, method = 'POST') {
    if (!detail || busy || (path === '/publish' && detail.publication_pending)) return
    if (demo || isDemoModeActive()) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/procurement/tenders/${id}${path}?site_id=${siteId}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, expected_version: detail.tender.version }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      if (body.action === 'delete') { router.push('/purchases/tenders'); return }
      if (path === '/publish' && result.status === 'pending') setDetail(current => current ? { ...current, publication_pending: true } : current)
      setNotice(result.status === 'pending' ? 'procurement.workflow.tender.publicationPending' : path === '/publish' ? 'procurement.workflow.tender.publicationCompleted' : 'procurement.workflow.tender.updatedNotice')
      setReload(value => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update tender') } finally { setBusy(false) }
  }
  const tender = detail?.tender
  async function togglePortal() {
    if (!detail) return
    if (demo || isDemoModeActive()) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/procurement/tenders/portal?site_id=${siteId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !detail.portal_enabled }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error)
      setReload(value => value + 1)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update portal') } finally { setBusy(false) }
  }
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('breadcrumb:update', { detail: { title: tender?.title ?? t('procurement.workflow.tender.tender') } }))
  }, [tender?.title, t])
  const tabs = [
    { value: 'activity', label: t('procurement.workflow.common.activity') },
    { value: 'lines', label: t('procurement.workflow.common.lines') },
    { value: 'suppliers', label: t('procurement.workflow.common.suppliers') },
    { value: 'quotes', label: t('procurement.workflow.tender.receivedQuotes') },
    { value: 'approvals', label: t('procurement.workflow.common.approvals') },
  ]
  if (loading) return <TenderDetailSkeleton />
  return <div className="min-w-0 flex-1 p-0"><h1 className="sr-only">{tender?.title ?? t('procurement.workflow.tender.tender')}</h1><Tabs value={tab} onValueChange={setTab}>
    <StickyHeader><div className="flex w-full min-w-0 flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
      <ResponsiveTabsList tabs={tabs} activeTab={tab} onTabChange={setTab} containerClassName="min-w-0 flex-1" className="w-auto max-w-full" />
      {!loading && tender && <div className="max-w-full overflow-x-auto md:shrink-0"><TenderStatusSegments status={tender.status} /></div>}
    </div></StickyHeader>
    <div className="px-4 lg:px-8 py-5">
    {demo && <ProcurementDemoNotice />}
    <TopBarPrimaryActions>{!loading && tender && detail && ['draft', 'published'].includes(tender.status) && !detail.publications.some(row => row.version === tender.version) && <Button size="sm" disabled={demo || busy || detail.publication_pending} onClick={() => action('/publish', {})}>{detail.publication_pending ? valueLabel('pending') : t('procurement.workflow.tender.requestPublication')}</Button>}</TopBarPrimaryActions>
    {detail && error && <p role="alert" className="text-destructive">{message(error)}</p>}{notice && <p role="status">{t(notice)}</p>}
    <ProcurementState loading={loading} error={!detail ? message(error) : undefined} onRetry={demo ? undefined : () => { setLoading(true); setError(''); setReload(value => value + 1) }} />
    {!loading && tender && detail && <>
      <header className="flex flex-wrap items-center gap-3">
        <EntityAvatar name={tender.title} className="h-11 w-11" />
        <div className="min-w-0 flex-1"><h2 className="break-words text-xl font-semibold">{tender.title}</h2><p className="mt-1 text-sm text-muted-foreground">{t('procurement.workflow.common.workingVersion', { number: formatNumber(tender.version) })}</p></div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {['draft', 'published'].includes(tender.status) && <Button variant="outline" size="sm" asChild><Link href={`/purchases/tenders/${id}/edit`}>{t('procurement.workflow.tender.editWorkingVersion')}</Link></Button>}
          {tender.status === 'published' && detail.publications[0] && Date.parse(detail.publications[0].snapshot.participation_deadline) <= loadedAt && <Button variant="outline" size="sm" disabled={demo || busy} onClick={() => action('', { action: 'close' }, 'PATCH')}>{t('procurement.workflow.tender.closeParticipation')}</Button>}
          {['draft', 'published'].includes(tender.status) && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={demo || busy} aria-label={t('procurement.workflow.replenishment.actions')}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={demo || busy} className="text-destructive focus:text-destructive" onSelect={() => setConfirmation('cancel')}><XCircle className="mr-2 h-4 w-4" />{t('procurement.workflow.tender.cancelTender')}</DropdownMenuItem>
              {tender.status === 'draft' && <DropdownMenuItem disabled={demo || busy} className="text-destructive focus:text-destructive" onSelect={() => setConfirmation('delete')}><Trash2 className="mr-2 h-4 w-4" />{t('procurement.workflow.tender.deleteDraft')}</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </header>
      <div className="mt-5 flex flex-col lg:flex-row border-t border-border/50"><main className="w-full min-w-0 lg:flex-1 pt-5 lg:pr-8">
      <TabsContent value="activity" className="mt-0"><TenderActivity tender={tender} publications={detail.publications} receipts={detail.receipt_activity} portalEnabled={detail.portal_enabled} siteSlug={demo ? detail.site_slug : siteSlug || detail.site_slug} busy={busy} demo={demo} onTogglePortal={togglePortal} /></TabsContent>
      <TabsContent value="lines" className="mt-0"><SectionCard className="space-y-3 p-5"><h2 className="text-lg font-semibold">{t('procurement.workflow.tender.workingRequirements')}</h2>
        <Table><TableHeader><TableRow><TableHead>{t('procurement.workflow.tender.requirement')}</TableHead><TableHead>{t('procurement.workflow.common.quantity')}</TableHead><TableHead>{t('procurement.workflow.tender.unitEstimate')}</TableHead></TableRow></TableHeader><TableBody>{tender.requirements.map(line => <TableRow key={line.id}><TableCell className="font-medium">{line.description}</TableCell><TableCell>{formatNumber(line.quantity)} {line.unit}</TableCell><TableCell>{formatMoney(line.unit_net_minor, tender.currency)}</TableCell></TableRow>)}</TableBody></Table>
      </SectionCard></TabsContent><TabsContent value="suppliers" className="mt-0"><SectionCard className="space-y-3 p-5"><h2 className="text-lg font-semibold">{t('procurement.workflow.tender.invitedSuppliers')}</h2><p className="text-sm text-muted-foreground">{t('procurement.workflow.tender.invitationDescription')}</p>
        {supplierError && <p role="alert">{message(supplierError)}</p>}
        {['draft', 'published'].includes(tender.status) && <div className="flex flex-wrap gap-3"><RelationSelect label={t('procurement.workflow.tender.approvedSupplier')} disabled={demo || busy} allowCreate={false} placeholder={t('procurement.workflow.tender.selectSupplier')} value={supplier ? { mode: 'existing', id: supplier, label: suppliers.find(row => row.id === supplier)?.name ?? t('procurement.workflow.common.supplier') } : null} options={suppliers.map(row => ({ id: row.id, label: row.name }))} onValueChange={value => setSupplier(value?.mode === 'existing' ? value.id : '')} /><Button disabled={!supplier || busy} onClick={() => action('/participants', { supplier_id: supplier, status: 'invited' })}>{t('procurement.workflow.tender.registerInvitation')}</Button></div>}
        {!detail.participants.length ? <EmptyCard icon={<Users size={24} />} title={t('procurement.workflow.tender.noSuppliers')}
          description="" showHint={false} showShadow={false} contentClassName="min-h-0 py-6" /> : <ul className="space-y-2">{detail.participants.map(participant => <li key={participant.id} className="flex items-center gap-3 rounded border p-3"><Link className="underline" href={`/suppliers/${participant.supplier_id}`}>{participant.suppliers?.name ?? t('procurement.workflow.common.supplier')}</Link><span>{valueLabel(participant.status)}</span>{participant.status === 'invited' && ['draft', 'published'].includes(tender.status) && <Button variant="outline" disabled={demo || busy} onClick={() => action('/participants', { supplier_id: participant.supplier_id, status: 'withdrawn' })}>{t('procurement.workflow.tender.withdrawInvitation')}</Button>}</li>)}</ul>}
      </SectionCard></TabsContent><TabsContent value="quotes" className="mt-0">
      <ProcurementQuotesPanel key={reload} siteId={panelSiteId} tenderId={id} embedded />
      </TabsContent><TabsContent value="approvals" className="mt-0">
      <EventApprovals key={reload} siteId={panelSiteId} targetId={id} onDecision={() => setReload(value => value + 1)} />
      </TabsContent>
      </main><TenderProperties tender={tender} /></div>
    </>}
    <ConfirmDialog confirmLabel={t('procurement.common.confirm')} cancelLabel={t('procurement.common.cancel')} open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null) }} loading={busy} title={confirmation === 'delete' ? t('procurement.workflow.tender.deleteTitle') : t('procurement.workflow.tender.cancelTitle')} description={t('procurement.workflow.tender.confirmDescription')} onConfirm={async () => { if (confirmation) await action('', { action: confirmation }, 'PATCH'); setConfirmation(null) }} />
    </div></Tabs></div>
}
