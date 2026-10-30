import type { Timing } from '../domain';
import { Choice, NumberField, TextField, DateTimeField } from './form-fields';
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n';
import { policyInsetClassName, policyLegendClassName } from './policy-styles';

export function TimingEditor({ label, value, onChange, timeZone }: {
  label: string; value: Timing | null; onChange: (value: Timing | null) => void; timeZone: string;
}) {
  const { t } = useProcurementI18n();
  return <fieldset className={policyInsetClassName}><legend className={policyLegendClassName}>{label}</legend>
    <Choice label={t('procurement.policy.timing.kind', { label })} value={value?.kind ?? 'none'} options={['none', 'duration', 'fixed'] as const}
      onChange={(kind) => onChange(kind === 'none' ? null : kind === 'fixed'
        ? { kind, at: '', timeZone } : { kind, value: 24, unit: 'hours', anchor: 'stage_activation', calendar: 'calendar', businessCalendarId: null, timeZone })} />
    {value && <TextField label={t('procurement.policy.timing.timeZone', { label })} value={value.timeZone} onChange={(zone) => onChange({ ...value, timeZone: zone })} />}
    {value?.kind === 'fixed' && <DateTimeField label={t('procurement.policy.timing.fixed', { label })} value={value.at}
      onChange={(at) => onChange({ ...value, at })} />}
    {value?.kind === 'duration' && <div className="grid gap-3 sm:grid-cols-2">
      <NumberField label={t('procurement.policy.timing.duration', { label })} value={value.value} onChange={(duration) => onChange({ ...value, value: duration })} />
      <Choice label={t('procurement.policy.timing.unit')} value={value.unit} options={['hours', 'days', 'weeks']} onChange={(unit) => onChange({ ...value, unit })} />
      <Choice label={t('procurement.policy.timing.anchor')} value={value.anchor} options={['publication', 'stage_activation']} onChange={(anchor) => onChange({ ...value, anchor })} />
      <Choice label={t('procurement.policy.timing.calendar')} value={value.calendar} options={['calendar', 'business']} onChange={(calendar) => onChange({ ...value, calendar, businessCalendarId: calendar === 'calendar' ? null : value.businessCalendarId })} />
      {value.calendar === 'business' && <TextField label={t('procurement.policy.timing.businessReference')} value={value.businessCalendarId ?? ''} onChange={(businessCalendarId) => onChange({ ...value, businessCalendarId })} />}
    </div>}
    <p className="text-sm text-muted-foreground">{t('procurement.policy.timing.description')}</p>
  </fieldset>;
}