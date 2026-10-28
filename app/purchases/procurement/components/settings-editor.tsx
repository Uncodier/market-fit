import { SectionCard, SectionCardHeader, SectionCardContent } from '@/app/components/ui/section-card';
import type { ProcurementPolicy } from '../domain';
import { Choice, NumberField, TextField, Toggle, humanize } from './form-fields';
import { ReferencePicker } from './reference-picker';
import { StageEditor, newStage } from './stage-editor';
import { TimingEditor } from './timing-editor';

const exceptionKinds = ['absent_approver', 'urgent_purchase', 'insufficient_offers', 'inadequate_price', 'inadequate_certifications'] as const;
const exceptionActions = ['substitute', 'continue', 'extend', 'invite_suppliers', 'negotiate', 'request_evidence', 'accept_equivalent'] as const;

export function SettingsEditor({ value, onChange, siteId }: {
  value: ProcurementPolicy; onChange: (value: ProcurementPolicy) => void; siteId: string;
}) {
  const update = (patch: Partial<ProcurementPolicy>) => onChange({ ...value, ...patch });
  return <div className="space-y-6">
    <SectionCard><SectionCardHeader title="General defaults" description="Defaults are stored for this workspace only. They do not publish tenders or change operational documents." />
      <SectionCardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Workspace time zone" value={value.timeZone} onChange={(timeZone) => update({ timeZone })} placeholder="America/Mexico_City" />
          <Choice label="Cross-rule approval counting" value={value.crossRuleCounting} options={['independent', 'shared']} onChange={(crossRuleCounting) => update({ crossRuleCounting })} />
          <Choice label="Default visibility" value={value.visibility} options={['private', 'unlisted', 'public']} onChange={(visibility) => update({ visibility })} />
          <Choice label="Default participation" value={value.participation} options={['open', 'invitation_only', 'approved_suppliers']} onChange={(participation) => update({ participation })} />
          <Choice label="Offer opening" value={value.offerOpening} options={['on_receipt', 'after_close']} onChange={(offerOpening) => update({ offerOpening })} />
        </div>
        <Toggle label="Allow global listing (publication still requires explicit opt-in)" checked={value.allowGlobalListing} onChange={(allowGlobalListing) => update({ allowGlobalListing })} />
        <ReferencePicker siteId={siteId} label="Supervisor" single ids={value.supervisorId ? [value.supervisorId] : []}
          onChange={(ids) => update({ supervisorId: ids[0] ?? null })} />
        <ReferencePicker siteId={siteId} label="Supervisor substitutes" ids={value.substituteIds} onChange={(substituteIds) => update({ substituteIds })} />
      </SectionCardContent>
    </SectionCard>
    <SectionCard><SectionCardHeader title="When no rules match" description="Block is the safe initial fallback. None is an explicit no-approval configuration, not authorization to order or pay." />
      <SectionCardContent>
        <Choice label="Fallback behavior" value={value.fallback.mode} options={['block', 'approval', 'none'] as const}
          onChange={(mode) => update({ fallback: mode === 'approval' ? { mode, stages: [newStage()] } : { mode } })} />
        {value.fallback.mode === 'approval' && <StageEditor siteId={siteId} timeZone={value.timeZone} stages={value.fallback.stages}
          onChange={(stages) => update({ fallback: { mode: 'approval', stages } })} />}
      </SectionCardContent>
    </SectionCard>
    <SectionCard><SectionCardHeader title="Deadlines" description="Each time window is independent. Expiry never grants approval." />
      <SectionCardContent><div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(value.timings) as (keyof ProcurementPolicy['timings'])[]).map((key) => <TimingEditor key={key}
          label={key === 'tenderResponse' ? 'Tender response' : key === 'offerValidity' ? 'Offer validity' : humanize(key)}
          value={value.timings[key]} timeZone={value.timeZone} onChange={(timing) => update({ timings: { ...value.timings, [key]: timing } })} />)}
      </div></SectionCardContent>
    </SectionCard>
    <SectionCard><SectionCardHeader title="Supervisor exceptions" description="Enabled exceptions require a supervisor, justification and a separate supervisor decision. AI recommendations are not executed here." />
      <SectionCardContent>{exceptionKinds.map((kind) => {
        const existing = value.exceptions.find((item) => item.kind === kind);
        const exception = existing ?? { kind, enabled: false, aiRecommendation: true as const, decisionAuthority: 'supervisor' as const,
          allowedActions: ['extend' as const], justificationRequired: true as const };
        const change = (next: typeof exception) => update({ exceptions: [...value.exceptions.filter((item) => item.kind !== kind), next] });
        return <fieldset key={kind} className="space-y-3 rounded-lg border p-4">
          <Toggle label={humanize(kind)} checked={exception.enabled} onChange={(enabled) => change({ ...exception, enabled })} />
          {exception.enabled && <div className="grid gap-3 sm:grid-cols-2">{exceptionActions.map((action) => <Toggle key={action} label={humanize(action)}
            checked={exception.allowedActions.includes(action)} onChange={(checked) => change({ ...exception, allowedActions: checked
              ? [...exception.allowedActions, action] : exception.allowedActions.filter((item) => item !== action) })} />)}</div>}
        </fieldset>;
      })}</SectionCardContent>
    </SectionCard>
    <SectionCard><SectionCardHeader title="Urgent purchase preset" description="Urgency does not waive mandatory requirements or automatically accept the first supplier response." />
      <SectionCardContent>
        <Toggle label="Enable urgent preset" checked={value.urgentPreset.enabled} onChange={(enabled) => update({ urgentPreset: { ...value.urgentPreset, enabled } })} />
        {value.urgentPreset.enabled && <>
          <TimingEditor label="Urgent response" value={value.urgentPreset.responseTiming} timeZone={value.timeZone}
            onChange={(responseTiming) => update({ urgentPreset: { ...value.urgentPreset, responseTiming } })} />
          <NumberField label="Minimum supplier proposals (not internal approvals)" value={value.urgentPreset.minimumSupplierProposals}
            onChange={(minimumSupplierProposals) => update({ urgentPreset: { ...value.urgentPreset, minimumSupplierProposals } })} />
          <Choice label="Urgent decision mode" value={value.urgentPreset.decisionMode} options={['human', 'ai_assisted', 'automatic_ai']}
            onChange={(decisionMode) => update({ urgentPreset: { ...value.urgentPreset, decisionMode } })} />
          <Toggle label="Notify previous eligible suppliers" checked={value.urgentPreset.notifyPreviousEligibleSuppliers}
            onChange={(notifyPreviousEligibleSuppliers) => update({ urgentPreset: { ...value.urgentPreset, notifyPreviousEligibleSuppliers } })} />
          <p className="text-sm text-muted-foreground">Mandatory requirements are always preserved. Notifications and delegated AI are not executed by this configuration screen.</p>
        </>}
      </SectionCardContent>
    </SectionCard>
    <SectionCard><SectionCardHeader title="Rejection notifications" description="Notification preferences do not change approval outcomes. No notifications are sent by this release." />
      <SectionCardContent>
        <Toggle label="Notify requester" checked={value.rejectionNotifications.notifyRequester}
          onChange={(notifyRequester) => update({ rejectionNotifications: { ...value.rejectionNotifications, notifyRequester } })} />
        <Toggle label="Notify participants" checked={value.rejectionNotifications.notifyParticipants}
          onChange={(notifyParticipants) => update({ rejectionNotifications: { ...value.rejectionNotifications, notifyParticipants } })} />
        <ReferencePicker siteId={siteId} label="Additional rejection recipients" ids={value.rejectionNotifications.recipientIds}
          onChange={(recipientIds) => update({ rejectionNotifications: { ...value.rejectionNotifications, recipientIds } })} />
      </SectionCardContent>
    </SectionCard>
  </div>;
}