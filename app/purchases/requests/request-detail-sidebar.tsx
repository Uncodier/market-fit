'use client'

import { Tabs, TabsContent } from '@/app/components/ui/tabs'
import { ResponsiveTabsList } from '@/app/components/ui/responsive-tabs-list'
import { SectionCard, SectionCardContent, SectionCardHeader } from '@/app/components/ui/section-card'
import { Textarea } from '@/app/components/ui/textarea'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { ClipboardList } from '@/app/components/ui/icons'
import { useProcurementI18n } from '../procurement/i18n/use-procurement-i18n'
import { WorkflowSnapshot } from './workflow-snapshot'
import type { RequestDetailData, Stage } from './request-detail'

export function canDecideStage(stage: Stage, actorId: string, active: boolean) {
  return active && stage.status === 'pending' && stage.definition.decisionMode === 'human'
    && stage.definition.approverIds.includes(actorId) && !stage.decisions.some(vote => vote.actor_id === actorId)
}

export function RequestDetailSidebar({ detail, demo, tab, onTabChange, reasons, onReasonChange }: {
  detail: RequestDetailData; demo: boolean; tab: string; onTabChange: (tab: string) => void;
  reasons: Record<string, string>; onReasonChange: (stageId: string, reason: string) => void;
}) {
  const { t, valueLabel, formatNumber, formatDate } = useProcurementI18n()
  const record = detail.request
  return <aside aria-label={t('procurement.workflow.request.information')} className="min-w-0 space-y-4">
    <SectionCard><SectionCardHeader title={t('procurement.workflow.request.information')} /><SectionCardContent>
      <p className="text-sm text-muted-foreground">{record.policy_revision ? t('procurement.workflow.request.pinnedRevision', { number: formatNumber(record.policy_revision) }) : t('procurement.workflow.request.noPolicySnapshot')}</p>
      <p className="mt-3 text-xs text-muted-foreground">{t('procurement.workflow.request.statusPolicyDescription')}</p>
      {record.status === 'approved' && detail.can_manage && <p className="mt-3 text-sm text-muted-foreground">{t('procurement.workflow.request.revalidationHelp')}</p>}
      {record.revalidation_of_revision && <p className="mt-3 text-sm text-muted-foreground">{t('procurement.workflow.request.revalidationPreserved', { number: formatNumber(record.revalidation_of_revision) })}</p>}
    </SectionCardContent></SectionCard>
    <Tabs value={tab} onValueChange={onTabChange}>
      <ResponsiveTabsList tabs={[{ value: 'approvals', label: t('procurement.workflow.common.approvals') }, { value: 'activity', label: t('procurement.workflow.common.activity') }]} activeTab={tab} onTabChange={onTabChange} />
      <TabsContent value="approvals" className="mt-4 space-y-4">
        {record.resolved_plan && <p className="text-sm">{t('procurement.workflow.request.planDescription', { source: valueLabel(record.resolved_plan.source), votes: valueLabel(record.resolved_plan.crossRuleCounting) })}</p>}
        {detail.stages.filter(stage => stage.revision === record.revision).map(stage => <StageCard key={stage.id} stage={stage}
          eligible={canDecideStage(stage, detail.actor_id, !demo && record.status === 'submitted')}
          reason={reasons[stage.id] ?? ''} onReasonChange={reason => onReasonChange(stage.id, reason)} />)}
        {record.status === 'draft' && <EmptyCard title={t('procurement.workflow.request.noPlan')} description="" icon={<ClipboardList size={24} />} showShadow={false} showHint={false} contentClassName="min-h-[180px] py-6" />}
        {record.resolved_plan && <details className="rounded border bg-card p-3 text-sm"><summary>{t('procurement.workflow.request.resolvedPlan')}</summary><WorkflowSnapshot value={record.resolved_plan} currency={record.currency} /></details>}
      </TabsContent>
      <TabsContent value="activity" className="mt-4"><SectionCard><SectionCardHeader title={t('procurement.workflow.common.activity')} description={t('procurement.workflow.request.activityDescription')} /><SectionCardContent>
        <ol className="divide-y">{detail.audit.map(event => <li key={event.id} className="py-3">
          <p className="text-sm font-medium">{valueLabel(event.event)}</p>
          <p className="text-xs text-muted-foreground">{t('procurement.workflow.common.revision', { number: formatNumber(event.revision) })} · {formatDate(event.created_at)}</p>
          <details className="mt-2 text-xs text-muted-foreground"><summary>{t('procurement.workflow.request.auditSnapshot')}</summary><WorkflowSnapshot value={event.snapshot} currency={record.currency} /></details>
        </li>)}</ol>
        {!detail.audit.length && <EmptyCard title={t('procurement.workflow.request.noActivity')} description="" icon={<ClipboardList size={24} />} showShadow={false} showHint={false} contentClassName="min-h-[180px] py-6" />}
      </SectionCardContent></SectionCard></TabsContent>
    </Tabs>
  </aside>
}

function StageCard({ stage, eligible, reason, onReasonChange }: { stage: Stage; eligible: boolean; reason: string; onReasonChange: (reason: string) => void }) {
  const { t, valueLabel, formatNumber, formatDate } = useProcurementI18n()
  const definition = stage.definition
  const required = definition.quorum.mode === 'all' ? definition.approverIds.length : definition.quorum.mode === 'n_of_m' ? definition.quorum.count : 1
  return <SectionCard className="space-y-3 p-5 text-sm">
    <h3 className="font-semibold">{definition.name} · {valueLabel(stage.status)}</h3>
    <p>{t('procurement.workflow.stage.summary', { mode: valueLabel(definition.decisionMode), execution: valueLabel(definition.execution), count: formatNumber(stage.decisions.filter(vote => vote.decision === 'approve').length), required: formatNumber(required), rejection: valueLabel(definition.rejectionBehavior) })}</p>
    <p className="break-all">{t('procurement.workflow.stage.eligible', { approvers: definition.approverIds.join(', ') || t('procurement.workflow.stage.aiOnly') })}</p>
    <p className="break-all">{t('procurement.workflow.stage.mandatoryDeadline', { approvers: definition.mandatoryApproverIds.join(', ') || t('procurement.workflow.common.none'), deadline: definition.resolvedDeadline ? formatDate(definition.resolvedDeadline) : t('procurement.workflow.common.none') })}</p>
    {definition.decisionMode !== 'human' && <p role="status">{t('procurement.workflow.stage.aiPending')}</p>}
    {stage.decisions.map(vote => <p key={vote.id} className="break-words">{vote.actor_id}: {valueLabel(vote.decision)} — {vote.reason}</p>)}
    {eligible && <label className="block">{t('procurement.workflow.stage.reason')}<Textarea maxLength={2000} value={reason} onChange={event => onReasonChange(event.target.value)} /></label>}
  </SectionCard>
}