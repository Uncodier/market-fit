'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { StatusDot } from '@/app/components/documents/document-list'
import { Check, ClipboardList } from '@/app/components/ui/icons'
import { cn } from '@/lib/utils'
import { Textarea } from '@/app/components/ui/textarea'
import { Label } from '@/app/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogForm } from '@/app/components/ui/dialog'
import { ProcurementState } from '../ui/workspace'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import type { InboxRow } from './inbox-schema'
import { submitDecision, decisionTimeoutMessage, DecisionConflictError } from './decision-response'
import Link from 'next/link'
import { DeprecatedBadge } from './deprecated-badge'
import { StageProgress, type EventStage } from './stage-progress'
import { isProcurementDemo as isDemoSiteId } from '../ui/is-demo'
import { demoEventApprovals } from '@/lib/demo-data/procurement-commerce'
import { ProcurementDemoNotice } from '../ui/demo-notice'

type Approval = { id: string; status: string; event: string; target_version: number; is_deprecated?: boolean; procurement_event_stages: EventStage[] }

export function EventApprovalReview({ siteId, row, onClose, onDecision }: {
  siteId: string; row: InboxRow; onClose: () => void; onDecision: () => void
}) {
  const { t, message, valueLabel, formatNumber, formatDate } = useProcurementI18n()
  const reasonHintId = useId()
  const [approval, setApproval] = useState<Approval | null>(() => isDemoSiteId(siteId) ? demoEventApprovals(row.target_id).find(item => item.id === row.id.replace(/^event:/, '')) ?? null : null)
  const [loading, setLoading] = useState(!isDemoSiteId(siteId))
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [stageId, setStageId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const sending = useRef(false)
  const approvalId = row.id.replace(/^event:/, '')

  useEffect(() => {
    if (isDemoSiteId(siteId)) return
    const controller = new AbortController()
    fetch(`/api/procurement/approvals?site_id=${siteId}&target_id=${row.target_id}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load approval stages')
        const data: { approvals: Approval[] } = await response.json()
        const current = data.approvals.find(item => item.id === approvalId)
        if (!current) throw new Error('Unable to load approval stages')
        if (!controller.signal.aborted) { setApproval(current); setError('') }
      }).catch(() => { if (!controller.signal.aborted) setError('Unable to load approval stages') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, row.target_id, approvalId, refresh])

  const stages = [...(approval?.procurement_event_stages ?? [])].sort((a, b) => a.position - b.position)
  const pendingStages = stages.filter(stage => stage.status === 'pending' && stage.definition.decisionMode === 'human' && !stage.own_decision)
  const stage = pendingStages.find(item => item.id === stageId) ?? pendingStages[0]
  const canDecide = !loading && !approval?.is_deprecated && !row.is_deprecated && approval?.status === 'pending' && !!stage

  async function decide(decision: 'approve' | 'reject') {
    if (isDemoSiteId(siteId)) return
    if (!canDecide || !stage || sending.current || busy || unconfirmed || !reason.trim()) return
    sending.current = true
    setBusy(true); setError('')
    try {
      await submitDecision(`/api/procurement/approvals/${approvalId}/decisions?site_id=${siteId}`, {
        stage_id: stage.id, decision, reason: reason.trim(),
      })
      onDecision(); onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to record decision')
      if (failure instanceof DecisionConflictError || (failure instanceof Error && failure.message === decisionTimeoutMessage)) setUnconfirmed(true)
    }
    finally { sending.current = false; setBusy(false) }
  }

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <DialogContent closeLabel={t('procurement.navigation.closeDialog')} busy={busy}>
      <DialogHeader><DialogTitle>{t('procurement.partners.approvals.reviewTitle')}</DialogTitle>
        <DialogDescription>{t('procurement.partners.approvals.description')}</DialogDescription></DialogHeader>
      <DialogForm onSubmit={event => { event.preventDefault(); void decide('approve') }}>
        <DialogBody className="space-y-6 py-6 text-sm">
          {isDemoSiteId(siteId) && <ProcurementDemoNotice />}
          <ProcurementState loading={loading} error={approval ? '' : message(error)} compact
            onRetry={() => { setLoading(true); setError(''); setRefresh(value => value + 1) }} />
          {approval && <>
            <DeprecatedBadge deprecated={approval.is_deprecated || row.is_deprecated} />
            <section aria-label={t('procurement.partners.approvals.columns.document')} className="space-y-5">
              <div className="flex items-start gap-4">
                <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><ClipboardList size={24} /></div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t(`procurement.partners.approvals.stages.${row.stage}`)}</p>
                  <h2 className="text-base font-semibold leading-snug tracking-tight">{row.title}</h2>
                  <StatusDot status={approval.status} label={valueLabel(approval.status)} />
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-border/60 pb-5 text-sm">
                <div className="space-y-1"><dt className="text-sm text-muted-foreground">{t('procurement.partners.approvals.columns.revision')}</dt>
                  <dd className="font-medium">{formatNumber(approval.target_version)}</dd></div>
                <div className="space-y-1"><dt className="text-sm text-muted-foreground">{t('procurement.partners.approvals.columns.date')}</dt>
                  <dd className="font-medium">{formatDate(row.date, { dateStyle: 'medium' })}</dd></div>
              </dl>
            </section>
            <dl aria-label={t('procurement.partners.approvals.stageLabel')}>
              {stages.map((item, index) => <div key={item.id} className="relative flex items-start gap-3 pb-5 last:pb-0">
                {index < stages.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-3.5 top-8 w-px bg-border" />}
                <span aria-hidden="true" className={cn('relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                  item.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' :
                    canDecide && item.id === stage.id ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')}>
                  {item.status === 'approved' ? <Check size={14} /> : formatNumber(index + 1)}
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <dt className="text-sm font-medium leading-snug">{item.definition.name}</dt>
                  <dd className="mt-1"><StatusDot status={item.status} label={valueLabel(item.status)} /></dd>
                  <dd className="mt-2"><StageProgress stage={item} /></dd>
                  {item.definition.decisionMode !== 'human' && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('procurement.partners.approvals.aiHint')}</p>}
                </div>
              </div>)}
            </dl>
            {canDecide && <section className="-mx-6 space-y-4 border-y border-border/60 bg-muted/30 px-6 py-5" aria-label={t('procurement.partners.approvals.reason')}>
              {pendingStages.length > 1 && <Select value={stage.id} disabled={busy} onValueChange={value => { setStageId(value); setReason(''); setError('') }}>
                <SelectTrigger aria-label={t('procurement.partners.approvals.stageLabel')}><SelectValue /></SelectTrigger>
                <SelectContent>{pendingStages.map(item => <SelectItem key={item.id} value={item.id}>{item.definition.name}</SelectItem>)}</SelectContent>
              </Select>}
              <div className="space-y-1.5">
                <Label htmlFor={`${reasonHintId}-input`}>{t('procurement.partners.approvals.reason')} <span aria-hidden="true" className="text-muted-foreground">*</span></Label>
                <p id={reasonHintId} className="text-sm leading-relaxed text-muted-foreground">{t('procurement.partners.approvals.decisionHint', { name: stage.definition.name, revision: formatNumber(approval.target_version) })}</p>
              </div>
              <Textarea id={`${reasonHintId}-input`} aria-describedby={reasonHintId} aria-label={t('procurement.partners.approvals.reasonFor', { name: stage.definition.name })} required maxLength={2000}
                className="min-h-[112px] resize-y rounded-lg px-3.5 py-3 leading-relaxed" disabled={busy} value={reason} onChange={event => setReason(event.target.value)} />
              <div className="flex items-start justify-between gap-4 text-sm text-muted-foreground">
                <p className="leading-relaxed">{t('procurement.partners.approvals.eligibleHint')}</p>
                <span className="shrink-0 text-xs tabular-nums">{formatNumber(reason.length)} / {formatNumber(2000)}</span>
              </div>
            </section>}
          </>}
        </DialogBody>
        <DialogFooter className="flex-wrap">
          {approval && error && <div className="w-full basis-full space-y-2" role="alert">
            <p className="text-sm text-destructive">{message(error)}</p>
            {row.stage === 'publication' && <Link className="text-sm underline" href={`/purchases/tenders/${row.target_id}`}>
              {t('procurement.partners.approvals.stages.publication')}
            </Link>}
          </div>}
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>{t('procurement.common.cancel')}</Button>
          {canDecide && <>
            <Button type="button" variant="outline" disabled={isDemoSiteId(siteId) || busy || unconfirmed || !reason.trim()} onClick={() => void decide('reject')}>{t('procurement.partners.approvals.reject')}</Button>
            <Button type="submit" disabled={isDemoSiteId(siteId) || busy || unconfirmed || !reason.trim()}>{t(busy ? 'procurement.partners.actions.recording' : 'procurement.partners.approvals.approve')}</Button>
          </>}
        </DialogFooter>
      </DialogForm>
    </DialogContent>
  </Dialog>
}