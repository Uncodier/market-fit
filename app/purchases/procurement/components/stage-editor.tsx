import { Button } from '@/app/components/ui/button';
import type { ApprovalStage } from '../domain';
import { Choice, NumberField, TextField, Toggle } from './form-fields';
import { ReferencePicker } from './reference-picker';
import { TimingEditor } from './timing-editor';

export function newStage(): ApprovalStage {
  return { id: crypto.randomUUID(), name: 'Approval', decisionMode: 'human', approverIds: [], mandatoryApproverIds: [],
    quorum: { mode: 'all' }, rejectionBehavior: 'veto', execution: 'sequential', allowSelfApproval: false,
    delegatedAgentId: null, deadline: null, timeoutAction: 'block', escalationIds: [] };
}

export function StageEditor({ stages, onChange, siteId, timeZone }: {
  stages: ApprovalStage[]; onChange: (stages: ApprovalStage[]) => void; siteId: string; timeZone: string;
}) {
  return <div className="space-y-4">
    {stages.map((stage, index) => {
      const update = (changes: Partial<ApprovalStage>) => onChange(stages.map((item, i) => i === index ? { ...item, ...changes } : item));
      return <fieldset key={stage.id} className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 font-medium">Approval stage {index + 1}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Stage name" value={stage.name} onChange={(name) => update({ name })} maxLength={160} />
          <Choice label="Decision mode" value={stage.decisionMode} options={['human', 'ai_assisted', 'automatic_ai']}
            onChange={(decisionMode) => update(decisionMode === 'automatic_ai'
              ? { decisionMode, approverIds: [], mandatoryApproverIds: [], quorum: { mode: 'first_response' } }
              : { decisionMode, delegatedAgentId: null })} />
          <Choice label="Stage execution" value={stage.execution} options={['sequential', 'parallel']} onChange={(execution) => update({ execution })} />
          <Choice label="Rejection behavior" value={stage.rejectionBehavior} options={['veto', 'failed_vote', 'return_for_correction']} onChange={(rejectionBehavior) => update({ rejectionBehavior })} />
        </div>
        {stage.decisionMode !== 'human' && <p className="text-sm text-muted-foreground">AI authority is configuration only. This release does not execute AI reviews or decisions.</p>}
        {stage.decisionMode === 'automatic_ai' ? <ReferencePicker siteId={siteId} kind="agents" label="Delegated agent" single
          ids={stage.delegatedAgentId ? [stage.delegatedAgentId] : []} onChange={(ids) => update({ delegatedAgentId: ids[0] ?? null })} />
          : <>
            <ReferencePicker siteId={siteId} label="Eligible approvers" ids={stage.approverIds}
              onChange={(approverIds) => update({ approverIds, mandatoryApproverIds: stage.mandatoryApproverIds.filter((id) => approverIds.includes(id)) })} />
            <ReferencePicker siteId={siteId} label="Mandatory approvers (must also be eligible)" ids={stage.mandatoryApproverIds}
              onChange={(mandatoryApproverIds) => update({ mandatoryApproverIds })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Choice label="Approval quorum" value={stage.quorum.mode} options={['all', 'first_response', 'n_of_m'] as const}
                onChange={(mode) => update({ quorum: mode === 'n_of_m' ? { mode, count: 1 } : { mode } })} />
              {stage.quorum.mode === 'n_of_m' && <NumberField label="Required internal approvals" value={stage.quorum.count}
                onChange={(count) => update({ quorum: { mode: 'n_of_m', count } })} />}
            </div>
            <Toggle label="Allow requester self-approval" checked={stage.allowSelfApproval} onChange={(allowSelfApproval) => update({ allowSelfApproval })} />
          </>}
        <TimingEditor label="Stage deadline" value={stage.deadline} timeZone={timeZone} onChange={(deadline) => update({ deadline })} />
        <Choice label="On deadline expiry" value={stage.timeoutAction} options={['block', 'remind', 'escalate', 'expire']}
          onChange={(timeoutAction) => update({ timeoutAction })} />
        {stage.timeoutAction === 'escalate' && <ReferencePicker siteId={siteId} label="Escalation recipients" ids={stage.escalationIds}
          onChange={(escalationIds) => update({ escalationIds })} />}
        <Button type="button" variant="outline" onClick={() => onChange(stages.filter((_, i) => i !== index))}>Remove stage {index + 1}</Button>
      </fieldset>;
    })}
    <Button type="button" variant="outline" disabled={stages.length >= 50} onClick={() => onChange([...stages, newStage()])}>Add approval stage</Button>
  </div>;
}