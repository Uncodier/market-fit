'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSite } from '@/app/context/SiteContext'
import { isDemoSiteId, isRealSiteId } from '@/lib/demo-utils'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { EntityAvatar } from '@/app/components/documents/document-list'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogForm } from '@/app/components/ui/dialog'
import { TextField } from '../components/form-fields'
import { ProcurementState } from '../ui/workspace'
import { ProcurementDemoNotice } from '../ui/demo-notice'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { useRuleDetail, type ReplenishmentCase, type CheckResult } from './detail-data'
import { RuleAboutPanel, RuleCasesPanel, RuleRequestsPanel, RuleDetailSkeleton } from './detail-panels'
import { RuleInlineField, ruleDocument, type SaveRuleField } from './inline-field'
import { replenishmentDocumentSchema } from './schema'


export function ReplenishmentRuleDetail({ ruleId }: { ruleId: string }) {
  const { currentSite } = useSite()
  const { t } = useProcurementI18n()
  if (!currentSite) return <RuleDetailSkeleton />
  if (!isRealSiteId(currentSite.id) && !isDemoSiteId(currentSite.id)) return <div className="p-6">{t('procurement.policy.page.realWorkspace')}</div>
  return <ScopedRuleDetail key={`${currentSite.id}:${ruleId}`} siteId={currentSite.id} ruleId={ruleId} />
}

export function ScopedRuleDetail({ siteId, ruleId: inputRuleId }: { siteId: string; ruleId: string }) {
  const ruleId = inputRuleId.toLowerCase()
  const { t, message, valueLabel } = useProcurementI18n()
  const state = useRuleDetail(siteId, ruleId)
  const { data, loading, error, notFound, demo, refresh } = state
  const [tab, setTab] = useState('cases')
  const [closing, setClosing] = useState<ReplenishmentCase | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const writeLock = useRef(false)
  const [writeError, setWriteError] = useState('')
  const [result, setResult] = useState<CheckResult | null>(null)
  const unavailable = busy || loading || !!error || demo
  const title = data?.rule.name

  useEffect(() => {
    if (!title) return
    const path = `/inventory/minimums/${ruleId}`
    window.dispatchEvent(new CustomEvent('breadcrumb:update', { detail: { title, path, section: 'inventory' } }))
    return () => { window.dispatchEvent(new CustomEvent('breadcrumb:update', { detail: { title: null, path, section: 'inventory' } })) }
  }, [title, ruleId])

  const saveField: SaveRuleField = async (field, value, version) => {
    if (!data || unavailable || writeLock.current) throw new Error('Unable to save replenishment rule')
    if (version !== data.rule.version) throw new Error('Version conflict')
    const document = replenishmentDocumentSchema.parse({ ...ruleDocument(data.rule), [field]: value })
    writeLock.current = true; setBusy(true)
    try {
      const response = await fetch(`/api/procurement/replenishment?site_id=${encodeURIComponent(siteId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.rule.id, expected_version: version, document }),
      })
      const body = await response.json()
      if (!response.ok || body.id !== data.rule.id) {
        // Reconcile conflicts or ambiguous responses before permitting another write.
        throw new Error(body.error || 'Unable to confirm replenishment rule save')
      }
      refresh()
    } catch (failure) {
      refresh()
      throw failure
    } finally { writeLock.current = false; setBusy(false) }
  }

  async function mutate(kind: 'check' | 'close') {
    if (!data || unavailable || writeLock.current || (kind === 'close' && (!closing || !reason.trim()))) return
    writeLock.current = true; setBusy(true); setWriteError('')
    try {
      const path = kind === 'check' ? `${ruleId}/evaluate` : `cases/${closing!.id}/close`
      const response = await fetch(`/api/procurement/replenishment/${path}?site_id=${encodeURIComponent(siteId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kind === 'check' ? {} : { reason }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Unable to update replenishment rule')
      if (kind === 'check') setResult(body)
      else { setClosing(null); setReason('') }
      refresh()
    } catch (failure) { setWriteError(failure instanceof Error ? failure.message : 'Unable to update replenishment rule') }
    finally { writeLock.current = false; setBusy(false) }
  }

  if (!data) return loading ? <RuleDetailSkeleton /> : <div className="space-y-5 p-4 lg:p-8">
    {notFound ? <h1 className="text-xl font-semibold">{t(`procurement.workflow.replenishment.notFound`)}</h1> : <ProcurementState error={error} onRetry={refresh} />}
  </div>

  return <div className="min-w-0 flex-1 p-0">
    <Tabs value={tab} onValueChange={setTab}>
      <StickyHeader><div className="flex w-full flex-wrap items-center justify-between gap-3 py-3">
        <TabsList><TabsTrigger value="cases">{t(`procurement.workflow.replenishment.casesTab`)}</TabsTrigger>
          <TabsTrigger value="requests">{t(`procurement.workflow.replenishment.requestsTab`)}</TabsTrigger></TabsList>
        <Badge variant="outline">{t(`procurement.workflow.replenishment.${data.rule.enabled ? 'enabled' : 'disabled'}`)}</Badge>
      </div></StickyHeader>
      <div className="px-4 py-5 lg:px-8">
        {demo && <ProcurementDemoNotice />}
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3"><EntityAvatar name={data.rule.name} className="h-11 w-11 text-sm" />
            <div className="min-w-0"><h1 className="break-words text-xl font-semibold leading-tight" aria-label={data.rule.name}>
              <RuleInlineField rule={data.rule} field="name" label={t('procurement.workflow.replenishment.ruleName')} display={data.rule.name}
                disabled={unavailable} onSave={saveField} identity />
            </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t(`procurement.workflow.replenishment.ruleTitle`)} · {t('procurement.workflow.common.version', { number: data.rule.version })}</p>
            </div></div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" disabled={unavailable || !data.rule.enabled} onClick={() => void mutate('check')}>{t(`procurement.workflow.replenishment.checkStock`)}</Button>
          </div>
        </header>
        {writeError && !closing && <p role="alert" className="mt-4 text-sm text-destructive">{message(writeError)}</p>}
        {result && <div role="status" className="mt-4 rounded-lg border p-3 text-sm">
          {result.message ? message(result.message) : valueLabel(result.status)}
          {result.request_id && <Link className="ml-2 underline" href={`/purchases/requests/${result.request_id}`}>{t(`procurement.workflow.replenishment.openRequest`)}</Link>}
        </div>}
        <div className="mt-5 flex flex-col border-t border-border/50 lg:flex-row">
          <div className="w-full pt-5 lg:min-w-0 lg:flex-1 lg:pr-8">
            {loading || error ? <ProcurementState loading={loading} error={error} onRetry={refresh} /> : <>
              <TabsContent value="cases" className="mt-0 pt-0"><RuleCasesPanel data={data} busy={unavailable} page={state.casePage}
                onPageChange={state.changeCasePage} onResolve={item => { setClosing(item); setReason(''); setWriteError('') }} /></TabsContent>
              <TabsContent value="requests" className="mt-0 pt-0"><RuleRequestsPanel data={data} busy={unavailable} page={state.requestPage} onPageChange={state.changeRequestPage} /></TabsContent>
            </>}
          </div>
          <aside className="w-full shrink-0 pt-5 lg:w-[340px] lg:border-l lg:border-border/50 lg:pl-8 xl:w-[380px]">
            <div className="lg:sticky lg:top-[calc(var(--topbar-height,64px)+71px+16px)] lg:max-h-[calc(100vh-var(--topbar-height,64px)-96px)] lg:overflow-y-auto"><RuleAboutPanel data={data} disabled={unavailable} onSave={saveField} /></div>
          </aside>
        </div>
      </div>
    </Tabs>
    <Dialog open={!!closing} onOpenChange={open => { if (!open && !busy) setClosing(null) }}>
      <DialogContent busy={busy} closeLabel={t('procurement.navigation.closeDialog')}><DialogHeader>
        <DialogTitle>{t(`procurement.workflow.replenishment.resolveTitle`)}</DialogTitle><DialogDescription>{t(`procurement.workflow.replenishment.resolveDescription`)}</DialogDescription>
      </DialogHeader><DialogForm onSubmit={event => { event.preventDefault(); void mutate('close') }}>
        <DialogBody><TextField label={t(`procurement.workflow.replenishment.reason`)} value={reason} onChange={setReason} maxLength={2000} />
          {writeError && <p role="alert" className="text-sm text-destructive">{message(writeError)}</p>}</DialogBody>
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setClosing(null)}>{t('procurement.workflow.common.cancel')}</Button>
          <Button type="submit" disabled={unavailable || !reason.trim()}>{t(`procurement.workflow.replenishment.resolveCase`)}</Button></DialogFooter>
      </DialogForm></DialogContent>
    </Dialog>
  </div>
}