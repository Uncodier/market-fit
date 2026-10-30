import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter, type SectionCardFooterProps } from '@/app/components/ui/section-card';
import type { ProcurementPolicy } from '../domain';
import { Choice, NumberField, TextField, Toggle } from './form-fields';
import { ReferencePicker } from './reference-picker';
import { StageEditor, newStage } from './stage-editor';
import { TimingEditor } from './timing-editor';
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n';
import { policyInsetClassName } from './policy-styles';

const exceptionKinds = ['absent_approver', 'urgent_purchase', 'insufficient_offers', 'inadequate_price', 'inadequate_certifications'] as const;
const exceptionActions = ['substitute', 'continue', 'extend', 'invite_suppliers', 'negotiate', 'request_evidence', 'accept_equivalent'] as const;

export function SettingsEditor({ value, onChange, siteId, saveProps }: {
  value: ProcurementPolicy; onChange: (value: ProcurementPolicy) => void; siteId: string;
  saveProps?: SectionCardFooterProps;
}) {
  const { t, valueLabel } = useProcurementI18n();
  const update = (patch: Partial<ProcurementPolicy>) => onChange({ ...value, ...patch });
  return <div className="space-y-6">
    <SectionCard id="procurement-settings-general" className="scroll-mt-36"><SectionCardHeader title={t('procurement.policy.settings.general')} description={t('procurement.policy.settings.generalDescription')} />
      <SectionCardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('procurement.policy.settings.timeZone')} value={value.timeZone} onChange={(timeZone) => update({ timeZone })} placeholder="America/Mexico_City" />
          <Choice label={t('procurement.policy.settings.counting')} value={value.crossRuleCounting} options={['independent', 'shared']} onChange={(crossRuleCounting) => update({ crossRuleCounting })} />
          <Choice label={t('procurement.policy.settings.visibility')} value={value.visibility} options={['private', 'unlisted', 'public']} onChange={(visibility) => update({ visibility })} />
          <Choice label={t('procurement.policy.settings.participation')} value={value.participation} options={['open', 'invitation_only', 'approved_suppliers']} onChange={(participation) => update({ participation })} />
          <Choice label={t('procurement.policy.settings.opening')} value={value.offerOpening} options={['on_receipt', 'after_close']} onChange={(offerOpening) => update({ offerOpening })} />
        </div>
        <Toggle label={t('procurement.policy.settings.listing')} checked={value.allowGlobalListing} onChange={(allowGlobalListing) => update({ allowGlobalListing })} />
        <ReferencePicker siteId={siteId} label={t('procurement.policy.settings.supervisor')} single ids={value.supervisorId ? [value.supervisorId] : []}
          onChange={(ids) => update({ supervisorId: ids[0] ?? null })} />
        <ReferencePicker siteId={siteId} label={t('procurement.policy.settings.substitutes')} ids={value.substituteIds} onChange={(substituteIds) => update({ substituteIds })} />
      </SectionCardContent>
      {saveProps && <SectionCardFooter {...saveProps} />}
    </SectionCard>
    <SectionCard id="procurement-settings-fallback" className="scroll-mt-36"><SectionCardHeader title={t('procurement.policy.settings.fallback')} description={t('procurement.policy.settings.fallbackDescription')} />
      <SectionCardContent>
        <Choice label={t('procurement.policy.settings.fallbackMode')} value={value.fallback.mode} options={['block', 'approval', 'none'] as const}
          onChange={(mode) => update({ fallback: mode === 'approval' ? { mode, stages: [newStage(t('procurement.common.newApproval'))] } : { mode } })} />
        {value.fallback.mode === 'approval' && <StageEditor siteId={siteId} timeZone={value.timeZone} stages={value.fallback.stages}
          onChange={(stages) => update({ fallback: { mode: 'approval', stages } })} />}
      </SectionCardContent>
      {saveProps && <SectionCardFooter {...saveProps} />}
    </SectionCard>
    <SectionCard id="procurement-settings-deadlines" className="scroll-mt-36"><SectionCardHeader title={t('procurement.policy.settings.deadlines')} description={t('procurement.policy.settings.deadlinesDescription')} />
      <SectionCardContent><div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(value.timings) as (keyof ProcurementPolicy['timings'])[]).map((key) => <TimingEditor key={key}
          label={t(`procurement.policy.settings.timing.${key}`)}
          value={value.timings[key]} timeZone={value.timeZone} onChange={(timing) => update({ timings: { ...value.timings, [key]: timing } })} />)}
      </div></SectionCardContent>
      {saveProps && <SectionCardFooter {...saveProps} />}
    </SectionCard>
    <SectionCard id="procurement-settings-exceptions" className="scroll-mt-36"><SectionCardHeader title={t('procurement.policy.settings.exceptions')} description={t('procurement.policy.settings.exceptionsDescription')} />
      <SectionCardContent>{exceptionKinds.map((kind) => {
        const existing = value.exceptions.find((item) => item.kind === kind);
        const exception = existing ?? { kind, enabled: false, aiRecommendation: true as const, decisionAuthority: 'supervisor' as const,
          allowedActions: ['extend' as const], justificationRequired: true as const };
        const change = (next: typeof exception) => update({ exceptions: [...value.exceptions.filter((item) => item.kind !== kind), next] });
        return <fieldset key={kind} className={policyInsetClassName}>
          <Toggle label={valueLabel(kind)} checked={exception.enabled} onChange={(enabled) => change({ ...exception, enabled })} />
          {exception.enabled && <div className="grid gap-3 sm:grid-cols-2">{exceptionActions.map((action) => <Toggle key={action} label={valueLabel(action)}
            checked={exception.allowedActions.includes(action)} onChange={(checked) => change({ ...exception, allowedActions: checked
              ? [...exception.allowedActions, action] : exception.allowedActions.filter((item) => item !== action) })} />)}</div>}
        </fieldset>;
      })}</SectionCardContent>
      {saveProps && <SectionCardFooter {...saveProps} />}
    </SectionCard>
    <SectionCard id="procurement-settings-urgent" className="scroll-mt-36"><SectionCardHeader title={t('procurement.policy.settings.urgent')} description={t('procurement.policy.settings.urgentDescription')} />
      <SectionCardContent>
        <Toggle label={t('procurement.policy.settings.urgentEnable')} checked={value.urgentPreset.enabled} onChange={(enabled) => update({ urgentPreset: { ...value.urgentPreset, enabled } })} />
        {value.urgentPreset.enabled && <>
          <TimingEditor label={t('procurement.policy.settings.urgentResponse')} value={value.urgentPreset.responseTiming} timeZone={value.timeZone}
            onChange={(responseTiming) => update({ urgentPreset: { ...value.urgentPreset, responseTiming } })} />
          <NumberField label={t('procurement.policy.rule.minimumProposals')} value={value.urgentPreset.minimumSupplierProposals}
            onChange={(minimumSupplierProposals) => update({ urgentPreset: { ...value.urgentPreset, minimumSupplierProposals } })} />
          <Choice label={t('procurement.policy.settings.urgentMode')} value={value.urgentPreset.decisionMode} options={['human', 'ai_assisted', 'automatic_ai']}
            onChange={(decisionMode) => update({ urgentPreset: { ...value.urgentPreset, decisionMode } })} />
          <Toggle label={t('procurement.policy.settings.urgentNotify')} checked={value.urgentPreset.notifyPreviousEligibleSuppliers}
            onChange={(notifyPreviousEligibleSuppliers) => update({ urgentPreset: { ...value.urgentPreset, notifyPreviousEligibleSuppliers } })} />
          <p className="text-sm text-muted-foreground">{t('procurement.policy.settings.urgentWarning')}</p>
        </>}
      </SectionCardContent>
      {saveProps && <SectionCardFooter {...saveProps} />}
    </SectionCard>
    <SectionCard id="procurement-settings-notifications" className="scroll-mt-36"><SectionCardHeader title={t('procurement.policy.settings.notifications')} description={t('procurement.policy.settings.notificationsDescription')} />
      <SectionCardContent>
        <Toggle label={t('procurement.policy.settings.notifyRequester')} checked={value.rejectionNotifications.notifyRequester}
          onChange={(notifyRequester) => update({ rejectionNotifications: { ...value.rejectionNotifications, notifyRequester } })} />
        <Toggle label={t('procurement.policy.settings.notifyParticipants')} checked={value.rejectionNotifications.notifyParticipants}
          onChange={(notifyParticipants) => update({ rejectionNotifications: { ...value.rejectionNotifications, notifyParticipants } })} />
        <ReferencePicker siteId={siteId} label={t('procurement.policy.settings.recipients')} ids={value.rejectionNotifications.recipientIds}
          onChange={(recipientIds) => update({ rejectionNotifications: { ...value.rejectionNotifications, recipientIds } })} />
      </SectionCardContent>
      {saveProps && <SectionCardFooter {...saveProps} />}
    </SectionCard>
  </div>;
}