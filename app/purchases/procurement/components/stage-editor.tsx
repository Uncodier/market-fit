import { Button } from '@/app/components/ui/button';
import type { ApprovalStage } from '../domain';
import { Choice, NumberField, TextField, Toggle } from './form-fields';
import { ReferencePicker } from './reference-picker';
import { TimingEditor } from './timing-editor';
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n';
import { policyInsetClassName, policyLegendClassName } from './policy-styles';

export function newStage(name = 'Approval'): ApprovalStage {
  return { id: crypto.randomUUID(), name, decisionMode: 'human', approverIds: [], mandatoryApproverIds: [],
    quorum: { mode: 'all' }, rejectionBehavior: 'veto', execution: 'sequential', allowSelfApproval: false,
    delegatedAgentId: null, deadline: null, timeoutAction: 'block', escalationIds: [] };
}

export function StageEditor({ stages, onChange, siteId, timeZone }: {
  stages: ApprovalStage[]; onChange: (stages: ApprovalStage[]) => void; siteId: string; timeZone: string;
}) {
  const { t, formatNumber } = useProcurementI18n();
  return <div className="space-y-4">
    {stages.map((stage, index) => {
      const update = (changes: Partial<ApprovalStage>) => onChange(stages.map((item, i) => i === index ? { ...item, ...changes } : item));
      return <fieldset key={stage.id} className={policyInsetClassName}>
        <legend className={policyLegendClassName}>{t('procurement.policy.stage.number', { number: formatNumber(index + 1) })}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('procurement.policy.stage.name')} value={stage.name} onChange={(name) => update({ name })} maxLength={160} />
          <Choice label={t('procurement.policy.stage.decisionMode')} value={stage.decisionMode} options={['human', 'ai_assisted', 'automatic_ai']}
            onChange={(decisionMode) => update(decisionMode === 'automatic_ai'
              ? { decisionMode, approverIds: [], mandatoryApproverIds: [], quorum: { mode: 'first_response' } }
              : { decisionMode, delegatedAgentId: null })} />
          <Choice label={t('procurement.policy.stage.execution')} value={stage.execution} options={['sequential', 'parallel']} onChange={(execution) => update({ execution })} />
          <Choice label={t('procurement.policy.stage.rejection')} value={stage.rejectionBehavior} options={['veto', 'failed_vote', 'return_for_correction']} onChange={(rejectionBehavior) => update({ rejectionBehavior })} />
        </div>
        {stage.decisionMode !== 'human' && <p className="text-sm text-muted-foreground">{t('procurement.policy.stage.aiDescription')}</p>}
        {stage.decisionMode === 'automatic_ai' ? <ReferencePicker siteId={siteId} kind="agents" label={t('procurement.policy.stage.agent')} single
          ids={stage.delegatedAgentId ? [stage.delegatedAgentId] : []} onChange={(ids) => update({ delegatedAgentId: ids[0] ?? null })} />
          : <>
            <ReferencePicker siteId={siteId} label={t('procurement.policy.stage.approvers')} ids={stage.approverIds}
              onChange={(approverIds) => update({ approverIds, mandatoryApproverIds: stage.mandatoryApproverIds.filter((id) => approverIds.includes(id)) })} />
            <ReferencePicker siteId={siteId} label={t('procurement.policy.stage.mandatory')} ids={stage.mandatoryApproverIds}
              onChange={(mandatoryApproverIds) => update({ mandatoryApproverIds })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Choice label={t('procurement.policy.stage.quorum')} value={stage.quorum.mode} options={['all', 'first_response', 'n_of_m'] as const}
                onChange={(mode) => update({ quorum: mode === 'n_of_m' ? { mode, count: 1 } : { mode } })} />
              {stage.quorum.mode === 'n_of_m' && <NumberField label={t('procurement.policy.stage.count')} value={stage.quorum.count}
                onChange={(count) => update({ quorum: { mode: 'n_of_m', count } })} />}
            </div>
            <Toggle label={t('procurement.policy.stage.selfApproval')} checked={stage.allowSelfApproval} onChange={(allowSelfApproval) => update({ allowSelfApproval })} />
          </>}
        <TimingEditor label={t('procurement.policy.stage.deadline')} value={stage.deadline} timeZone={timeZone} onChange={(deadline) => update({ deadline })} />
        <Choice label={t('procurement.policy.stage.timeout')} value={stage.timeoutAction} options={['block', 'remind', 'escalate', 'expire']}
          onChange={(timeoutAction) => update({ timeoutAction })} />
        {stage.timeoutAction === 'escalate' && <ReferencePicker siteId={siteId} label={t('procurement.policy.stage.escalation')} ids={stage.escalationIds}
          onChange={(escalationIds) => update({ escalationIds })} />}
        <Button type="button" variant="outline" onClick={() => onChange(stages.filter((_, i) => i !== index))}>{t('procurement.policy.stage.remove', { number: formatNumber(index + 1) })}</Button>
      </fieldset>;
    })}
    <Button type="button" variant="outline" disabled={stages.length >= 50} onClick={() => onChange([...stages, newStage(t('procurement.common.newApproval'))])}>{t('procurement.policy.stage.add')}</Button>
  </div>;
}