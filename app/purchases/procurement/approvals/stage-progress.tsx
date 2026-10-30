'use client'

import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { StatusDot } from '@/app/components/documents/document-list'

export type EventStage = {
  id: string; status: string; position: number
  own_decision?: string | null
  approval_votes?: number
  voters?: { user_id: string; name: string | null; is_owner: boolean; is_self: boolean; mandatory: boolean; decision: string | null }[]
  definition: {
    name: string; decisionMode: string
    approverIds?: string[]
    quorum?: { mode: string; count?: number }
  }
}

/** Counts describe the saved plan, never permission to bypass its mandatory voters. */
export function StageProgress({ stage }: { stage: EventStage }) {
  const { t, valueLabel, formatNumber } = useProcurementI18n()
  const quorum = stage.definition.quorum
  const required = quorum?.mode === 'all' ? stage.definition.approverIds?.length
    : quorum?.mode === 'n_of_m' ? quorum.count : quorum?.mode === 'first_response' ? 1 : undefined
  return <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
    {stage.own_decision && <p>{t('procurement.partners.approvals.yourDecision', { decision: valueLabel(stage.own_decision) })}</p>}
    {required !== undefined && stage.approval_votes !== undefined && <p>{t('procurement.partners.approvals.voteProgress', {
      count: formatNumber(stage.approval_votes), required: formatNumber(required),
    })}</p>}
    {stage.own_decision && stage.status === 'pending' && <p>{t('procurement.partners.approvals.waitingForOthers')}</p>}
    {!!stage.voters?.length && <ul className="mt-2 divide-y divide-border/60" aria-label={t('procurement.partners.approvals.voters')}>
      {stage.voters.map(voter => <li key={voter.user_id} className="flex items-center justify-between gap-3 py-2">
        <span className="min-w-0">
          <span className="font-medium text-foreground">{voter.name ?? t(voter.is_owner
            ? 'procurement.partners.approvals.owner' : 'procurement.partners.approvals.member')}
            {!voter.name && !voter.is_owner && <span className="ml-1 font-normal text-muted-foreground">· {voter.user_id.slice(0, 8)}</span>}
          </span>
          {voter.is_self && <span className="ml-1">({t('procurement.partners.approvals.you')})</span>}
          {voter.mandatory && <span className="ml-2">{t('procurement.partners.approvals.mandatory')}</span>}
        </span>
        <StatusDot status={voter.decision === 'approve' ? 'approved' : voter.decision === 'reject' ? 'rejected' : 'pending'}
          label={voter.decision ? valueLabel(voter.decision === 'approve' ? 'approved' : 'rejected')
            : t('procurement.partners.approvals.awaitingVote')} />
      </li>)}
    </ul>}
  </div>
}