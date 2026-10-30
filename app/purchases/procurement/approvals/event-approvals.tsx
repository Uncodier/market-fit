'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { SectionCard, SectionCardHeader, SectionCardContent } from '@/app/components/ui/section-card'
import { Badge } from '@/app/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogForm } from '@/app/components/ui/dialog'
import { ProcurementState } from '../ui/workspace'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { submitDecision, decisionTimeoutMessage, DecisionConflictError } from './decision-response'
import { DeprecatedBadge } from './deprecated-badge'
import { StageProgress, type EventStage } from './stage-progress'
import { isProcurementDemo as isDemoSiteId } from '../ui/is-demo'
import { demoEventApprovals } from '@/lib/demo-data/procurement-commerce'

type Stage = EventStage
type Approval = { id: string; status: string; event: string; target_version: number; is_deprecated?: boolean; procurement_event_stages: Stage[] }

export function EventApprovals({ siteId, targetId, approvalId, onDecision }: { siteId: string; targetId: string; approvalId?: string; onDecision?: () => void }) {
  return <ScopedEventApprovals key={`${siteId}:${targetId}:${approvalId ?? ''}`} siteId={siteId} targetId={targetId} approvalId={approvalId} onDecision={onDecision} />
}

function ScopedEventApprovals({ siteId, targetId, approvalId, onDecision }: { siteId: string; targetId: string; approvalId?: string; onDecision?: () => void }) {
  const { t, message, valueLabel, formatNumber } = useProcurementI18n()
  const [approvals, setApprovals] = useState<Approval[]>(() => isDemoSiteId(siteId) ? demoEventApprovals(targetId) : [])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!isDemoSiteId(siteId))
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (isDemoSiteId(siteId)) return
    const controller = new AbortController()
    fetch(`/api/procurement/approvals?site_id=${siteId}&target_id=${targetId}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load approval stages')
        const data = await response.json()
        if (!controller.signal.aborted) { setApprovals(data.approvals); setError('') }
      }).catch(() => { if (!controller.signal.aborted) setError('Unable to load approval stages') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, targetId, refresh])
  return <SectionCard><SectionCardHeader title={t('procurement.partners.approvals.title')} description={t('procurement.partners.approvals.description')} />
    <SectionCardContent>
      <ProcurementState loading={loading} error={message(error)} onRetry={() => setRefresh(value => value + 1)}
        empty={!loading && !error && !approvals.length} emptyTitle={t('procurement.partners.approvals.emptyDocument')}
        description={t('procurement.partners.approvals.description')} compact />
      {approvals.filter(approval => !approvalId || approval.id === approvalId).map(approval => <div key={approval.id} className="space-y-3 border-b py-4">
        <div className="flex items-center justify-between"><p className="text-sm font-medium">{t('procurement.partners.approvals.eventRevision', { event: valueLabel(approval.event), revision: formatNumber(approval.target_version) })}</p><div className="flex items-center gap-2"><DeprecatedBadge deprecated={approval.is_deprecated} /><Badge variant="outline">{valueLabel(approval.status)}</Badge></div></div>
        {[...approval.procurement_event_stages].sort((a,b) => a.position-b.position).map(stage => <StageDecision key={stage.id}
          siteId={siteId} approval={approval} stage={stage} onSaved={() => { setLoading(true); setApprovals([]); setRefresh(value => value+1); onDecision?.() }} />)}
      </div>)}
    </SectionCardContent></SectionCard>
}

function StageDecision({ siteId, approval, stage, onSaved }: { siteId: string; approval: Approval; stage: Stage; onSaved: () => void }) {
  const { t, message, valueLabel, formatNumber } = useProcurementI18n()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const sending = useRef(false)
  async function decide(decision: 'approve' | 'reject') {
    if (isDemoSiteId(siteId)) return
    if (approval.status !== 'pending' || stage.status !== 'pending' || approval.is_deprecated || stage.own_decision || sending.current || busy || unconfirmed || !reason.trim()) return
    sending.current = true
    setBusy(true); setError('')
    try {
      await submitDecision(`/api/procurement/approvals/${approval.id}/decisions?site_id=${siteId}`, { stage_id: stage.id, decision, reason })
      setDecision(null); setReason('')
      onSaved()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to record decision')
      if (failure instanceof DecisionConflictError || (failure instanceof Error && failure.message === decisionTimeoutMessage)) setUnconfirmed(true)
    }
    finally { sending.current = false; setBusy(false) }
  }
  return <div className="space-y-3 rounded-xl border bg-background p-4">
    <div className="flex items-center justify-between gap-3"><p className="font-medium">{stage.definition.name}</p><Badge variant="outline">{valueLabel(stage.status)}</Badge></div>
    <StageProgress stage={stage} />
    {stage.definition.decisionMode !== 'human' && <p>{t('procurement.partners.approvals.aiHint')}</p>}
    {!approval.is_deprecated && !stage.own_decision && approval.status === 'pending' && stage.status === 'pending' && stage.definition.decisionMode === 'human' && <>
      <div className="flex gap-2"><Button disabled={busy || unconfirmed || isDemoSiteId(siteId)} onClick={() => setDecision('approve')}>{t('procurement.partners.approvals.approve')}</Button>
        <Button variant="outline" disabled={busy || unconfirmed || isDemoSiteId(siteId)} onClick={() => setDecision('reject')}>{t('procurement.partners.approvals.reject')}</Button></div>
      <p className="text-xs text-muted-foreground">{t('procurement.partners.approvals.eligibleHint')}</p>
    </>}
    {error && <p role="alert">{message(error)}</p>}
    <Dialog open={decision !== null} onOpenChange={open => { if (!open && !busy) setDecision(null) }}>
      <DialogContent closeLabel={t('procurement.navigation.closeDialog')} busy={busy}><DialogHeader><DialogTitle>{t(decision === 'reject' ? 'procurement.partners.approvals.rejectTitle' : 'procurement.partners.approvals.approveTitle')}</DialogTitle>
        <DialogDescription>{t('procurement.partners.approvals.decisionHint', { name: stage.definition.name, revision: formatNumber(approval.target_version) })}</DialogDescription></DialogHeader>
        <DialogForm onSubmit={event => { event.preventDefault(); if (decision) void decide(decision) }}>
          <DialogBody><label className="space-y-2 text-sm font-medium">{t('procurement.partners.approvals.reason')}<Textarea aria-label={t('procurement.partners.approvals.reasonFor', { name: stage.definition.name })} maxLength={2000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></label>
          </DialogBody>
          <DialogFooter>{error && <p role="alert" className="w-full text-sm text-destructive">{message(error)}</p>}<Button type="button" variant="outline" disabled={busy} onClick={() => setDecision(null)}>{t('procurement.common.cancel')}</Button><Button type="submit" disabled={busy || unconfirmed || !reason.trim()}>{t(busy ? 'procurement.partners.actions.recording' : 'procurement.partners.approvals.confirmDecision')}</Button></DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  </div>
}