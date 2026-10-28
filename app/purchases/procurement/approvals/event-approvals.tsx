'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { SectionCard, SectionCardHeader, SectionCardContent } from '@/app/components/ui/section-card'
import { Badge } from '@/app/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter, DialogForm } from '@/app/components/ui/dialog'
import { ProcurementState } from '../ui/workspace'

type Stage = { id: string; status: string; position: number; definition: { name: string; decisionMode: string } }
type Approval = { id: string; status: string; event: string; target_version: number; procurement_event_stages: Stage[] }

export function EventApprovals({ siteId, targetId, onDecision }: { siteId: string; targetId: string; onDecision?: () => void }) {
  return <ScopedEventApprovals key={`${siteId}:${targetId}`} siteId={siteId} targetId={targetId} onDecision={onDecision} />
}

function ScopedEventApprovals({ siteId, targetId, onDecision }: { siteId: string; targetId: string; onDecision?: () => void }) {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
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
  return <SectionCard><SectionCardHeader title="Approvals" description="Decisions apply only to the recorded document and policy revisions." />
    <SectionCardContent>
      <ProcurementState loading={loading} error={error} onRetry={() => setRefresh(value => value + 1)} />
      {!loading && !error && !approvals.length && <p>No approval submitted for this document.</p>}
      {approvals.map(approval => <div key={approval.id} className="space-y-3 border-b py-4">
        <div className="flex items-center justify-between"><p className="text-sm font-medium capitalize">{approval.event} · Revision {approval.target_version}</p><Badge variant="outline">{approval.status}</Badge></div>
        {[...approval.procurement_event_stages].sort((a,b) => a.position-b.position).map(stage => <StageDecision key={stage.id}
          siteId={siteId} approval={approval} stage={stage} onSaved={() => { setLoading(true); setApprovals([]); setRefresh(value => value+1); onDecision?.() }} />)}
      </div>)}
    </SectionCardContent></SectionCard>
}

function StageDecision({ siteId, approval, stage, onSaved }: { siteId: string; approval: Approval; stage: Stage; onSaved: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  async function decide(decision: 'approve' | 'reject') {
    if (busy || !reason.trim()) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/procurement/approvals/${approval.id}/decisions?site_id=${siteId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage_id: stage.id, decision, reason }),
      })
      if (!response.ok) throw new Error('Decision not confirmed. Check assignment, deadline and current document revision, then reload.')
      setDecision(null); setReason('')
      onSaved()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to record decision') }
    finally { setBusy(false) }
  }
  return <div className="space-y-3 rounded-xl border bg-background p-4">
    <div className="flex items-center justify-between gap-3"><p className="font-medium">{stage.definition.name}</p><Badge variant="outline">{stage.status}</Badge></div>
    {stage.definition.decisionMode !== 'human' && <p>Waiting for the configured AI integration; no automatic approval is assumed.</p>}
    {approval.status === 'pending' && stage.status === 'pending' && stage.definition.decisionMode === 'human' && <>
      <div className="flex gap-2"><Button disabled={busy} onClick={() => setDecision('approve')}>Approve</Button>
        <Button variant="outline" disabled={busy} onClick={() => setDecision('reject')}>Reject</Button></div>
      <p className="text-xs text-muted-foreground">Only currently eligible assigned approvers can decide.</p>
    </>}
    {error && <p role="alert">{error}</p>}
    <Dialog open={decision !== null} onOpenChange={open => { if (!open && !busy) setDecision(null) }}>
      <DialogContent busy={busy}><DialogHeader><DialogTitle>{decision === 'reject' ? 'Reject approval stage' : 'Approve stage'}</DialogTitle>
        <DialogDescription>{stage.definition.name} · Document revision {approval.target_version}. Your decision and reason are recorded.</DialogDescription></DialogHeader>
        <DialogForm onSubmit={event => { event.preventDefault(); if (decision) void decide(decision) }}>
          <DialogBody><label className="space-y-2 text-sm font-medium">Decision reason<Textarea aria-label={`Decision reason for ${stage.definition.name}`} maxLength={2000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}</DialogBody>
          <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setDecision(null)}>Cancel</Button><Button type="submit" disabled={busy || !reason.trim()}>{busy ? 'Recording…' : 'Confirm decision'}</Button></DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  </div>
}