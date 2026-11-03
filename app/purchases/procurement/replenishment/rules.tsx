'use client'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { Pagination } from '@/app/components/ui/pagination'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { ClipboardList, PlusCircle } from '@/app/components/ui/icons'
import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions'
import { Table, TableHeader, TableRow, TableBody, TableCell } from '@/app/components/ui/table'
import { DocumentListHead, DocumentListRow, EntityCell, StatusDot, documentListShellClassName } from '@/app/components/documents/document-list'
import { ProcurementState } from '../ui/workspace'
import { ProcurementListSkeleton } from '../ui/list-loading'
import { replenishmentPageSize, type ReplenishmentRule } from './schema'
import { ReplenishmentRuleDialog } from './rule-dialog'
import { isProcurementDemo as isDemoSiteId } from '../ui/is-demo'
import { demoReplenishmentRules } from '@/lib/demo-data/procurement-replenishment'
import { ProcurementDemoNotice } from '../ui/demo-notice'

type Result = { status: string; message?: string; request_id?: string | null; quantity?: number; on_hand?: number }
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
  const [queue, setQueue] = useState<Queue[]>([])
  const [page, setPage] = useState(1)
  const [ruleCount, setRuleCount] = useState(demo ? demoReplenishmentRules.length : 0)
  const visibleRules = rules.filter(rule => (status === 'all' || rule.enabled === (status === 'enabled')) && rule.name.toLowerCase().includes(search.toLowerCase()));
  const refresh = () => { if (demo) return; setLoading(true); setGeneration(value => value + 1) }
  useEffect(() => {
    if (demo) return
    const controller = new AbortController()
    fetch(`/api/procurement/replenishment?site_id=${siteId}&page=${page}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body })
      .then(body => {
        if (controller.signal.aborted) return
        setRules(body.rules); setQueue(body.queue ?? []); setError('')
        setRuleCount(body.rule_count)
        setPage(current => Math.min(current, Math.max(1, Math.ceil(body.rule_count / replenishmentPageSize))))
      })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, generation, page, demo])
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
  return <>
    {demo && <ProcurementDemoNotice />}
    <TopBarPrimaryActions>
      <Button type="button" size="sm" disabled={busy || loading} onClick={() => setEditing('new')}>
        <PlusCircle className="mr-2 h-4 w-4" />{t('procurement.workflow.replenishment.create')}
      </Button>
    </TopBarPrimaryActions>
    <section id="procurement-replenishment-minimums" className="min-w-0 space-y-4">
      <header className="space-y-1"><h2 className="text-lg font-semibold">{t('procurement.workflow.replenishment.inventory')}</h2>
        <p className="max-w-4xl text-sm text-muted-foreground">{t('procurement.workflow.replenishment.description')}</p>
      </header>
        {loading ? <ProcurementListSkeleton columns={6} minWidth="min-w-[1000px]" />
          : <ProcurementState error={!editing ? message(error) : null} onRetry={refresh} />}
        {!loading && !error && <div className={documentListShellClassName()}>
        {!!visibleRules.length && <Table className="min-w-[1000px]" aria-label={t('procurement.workflow.replenishment.inventory')}><TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur"><TableRow className="hover:bg-transparent">
          <DocumentListHead className="w-[25%]">{t('procurement.workflow.replenishment.rule')}</DocumentListHead>
          <DocumentListHead className="w-[12%]">{t('procurement.workflow.common.status')}</DocumentListHead>
          <DocumentListHead className="w-[12%]" align="right">{t('procurement.workflow.replenishment.minimumTarget')}</DocumentListHead>
          <DocumentListHead className="w-[16%]">{t('procurement.workflow.replenishment.action')}</DocumentListHead>
          <DocumentListHead className="w-[20%]">{t('procurement.workflow.replenishment.latestCheck')}</DocumentListHead>
          <DocumentListHead className="w-[15%]" align="right">{t('procurement.workflow.replenishment.actions')}</DocumentListHead>
        </TableRow></TableHeader><TableBody>
          {visibleRules.map(rule => <DocumentListRow key={rule.id} className="cursor-default" accent={rule.enabled ? 'none' : 'cancelled'}>
            <TableCell className="py-3.5"><Link className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={rule.name} title={rule.name} href={`/inventory/minimums/${rule.id}`}><EntityCell name={rule.name} secondary={t('procurement.workflow.common.version', { number: rule.version })} secondaryMono={false} /></Link></TableCell>
            <TableCell className="py-3.5"><StatusDot status={rule.enabled ? 'active' : 'inactive'} label={rule.enabled ? t('procurement.workflow.replenishment.enabled') : t('procurement.workflow.replenishment.disabled')} /></TableCell>
            <TableCell className="py-3.5 text-right font-medium tabular-nums">{formatNumber(rule.minimum)} / {formatNumber(rule.target)}</TableCell>
            <TableCell className="py-3.5 text-sm text-muted-foreground">{rule.action === 'draft' ? t('procurement.workflow.replenishment.createDraft') : t('procurement.workflow.replenishment.recordAlert')}</TableCell>
            <TableCell className="py-3.5 text-xs text-muted-foreground">{results[rule.id] ? <><p>{results[rule.id].message ? message(results[rule.id].message) : valueLabel(results[rule.id].status)}</p>{results[rule.id].request_id && <Link className="underline" href={`/purchases/requests/${results[rule.id].request_id}`}>{t('procurement.workflow.replenishment.openRequest')}</Link>}</> : t('procurement.workflow.replenishment.notChecked')}
              {queue.filter(job => job.rule_id === rule.id).map(job => <p key={job.rule_id} className="text-xs text-muted-foreground">{t('procurement.workflow.replenishment.worker', { status: job.generation > job.evaluated_generation ? valueLabel('pending') : job.last_error ? message(job.last_error) : job.last_result?.message ? message(job.last_result.message) : job.last_result?.status ? valueLabel(job.last_result.status) : t('procurement.workflow.replenishment.notProcessed') })}</p>)}
            </TableCell>
            <TableCell className="py-3.5 text-right"><div className="flex flex-wrap justify-end gap-1"><Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(rule)}>{t('procurement.workflow.common.edit')}</Button>
              <Button variant="ghost" size="sm" disabled={busy || !rule.enabled} onClick={() => void check(rule)}>{t('procurement.workflow.replenishment.checkStock')}</Button></div></TableCell></DocumentListRow>)}
        </TableBody></Table>}
        {!loading && !error && !visibleRules.length && <EmptyCard title={t('procurement.workflow.replenishment.noRules')} description=""
          icon={<ClipboardList size={24} />} showShadow={false} showHint={false} contentClassName="min-h-[180px] py-6" />}
        <nav aria-label={t('procurement.workflow.replenishment.rulePages')} className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3"><span className="text-xs text-muted-foreground">{t('procurement.workflow.replenishment.ruleCount', { count: formatNumber(ruleCount) })}</span>
          <Pagination currentPage={page} totalPages={Math.ceil(ruleCount / replenishmentPageSize)} disabled={busy || loading}
            onPageChange={value => { if (value !== page) { setLoading(true); setPage(value) } }} /></nav>
        </div>}
        <p className="max-w-4xl text-xs leading-relaxed text-muted-foreground">{t('procurement.workflow.replenishment.workerDescription')}</p>
    </section>
    <ReplenishmentRuleDialog siteId={siteId} rule={editing} onClose={() => setEditing(null)} onSaved={refresh} demo={demo} />
  </>
}
