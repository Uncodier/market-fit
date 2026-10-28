import type { Timing } from '../domain';
import { Choice, NumberField, TextField, DateTimeField } from './form-fields';

export function TimingEditor({ label, value, onChange, timeZone }: {
  label: string; value: Timing | null; onChange: (value: Timing | null) => void; timeZone: string;
}) {
  return <fieldset className="space-y-3 rounded-lg border p-4"><legend className="px-1 text-sm font-medium">{label}</legend>
    <Choice label={`${label} timing`} value={value?.kind ?? 'none'} options={['none', 'duration', 'fixed'] as const}
      onChange={(kind) => onChange(kind === 'none' ? null : kind === 'fixed'
        ? { kind, at: '', timeZone } : { kind, value: 24, unit: 'hours', anchor: 'stage_activation', calendar: 'calendar', businessCalendarId: null, timeZone })} />
    {value && <TextField label={`${label} time zone`} value={value.timeZone} onChange={(zone) => onChange({ ...value, timeZone: zone })} />}
    {value?.kind === 'fixed' && <DateTimeField label={`${label} fixed deadline`} value={value.at}
      onChange={(at) => onChange({ ...value, at })} />}
    {value?.kind === 'duration' && <div className="grid gap-3 sm:grid-cols-2">
      <NumberField label={`${label} duration`} value={value.value} onChange={(duration) => onChange({ ...value, value: duration })} />
      <Choice label="Duration unit" value={value.unit} options={['hours', 'days', 'weeks']} onChange={(unit) => onChange({ ...value, unit })} />
      <Choice label="Starts at" value={value.anchor} options={['publication', 'stage_activation']} onChange={(anchor) => onChange({ ...value, anchor })} />
      <Choice label="Calendar" value={value.calendar} options={['calendar', 'business']} onChange={(calendar) => onChange({ ...value, calendar, businessCalendarId: calendar === 'calendar' ? null : value.businessCalendarId })} />
      {value.calendar === 'business' && <TextField label="Business calendar reference" value={value.businessCalendarId ?? ''} onChange={(businessCalendarId) => onChange({ ...value, businessCalendarId })} />}
    </div>}
    <p className="text-xs text-muted-foreground">Timing is configuration only. No timer runs or approval by silence. Days/weeks are elapsed 24/168 hours, not local calendar arithmetic. Business calendars require external resolution.</p>
  </fieldset>;
}