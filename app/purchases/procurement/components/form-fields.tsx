import { useId, useState, type ReactNode } from 'react';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';

export function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children(id)}</div>;
}

export const humanize = (value: string) => value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());

export function Choice<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string; value: T; options: readonly T[]; onChange: (value: T) => void; disabled?: boolean;
}) {
  return <Field label={label}>{(id) => <Select disabled={disabled} value={value} onValueChange={next => { if (!disabled) onChange(next as T); }}>
    <SelectTrigger id={id} aria-label={label}><SelectValue /></SelectTrigger>
    <SelectContent>{options.map(option => <SelectItem key={option} value={option}>{humanize(option)}</SelectItem>)}</SelectContent>
  </Select>}</Field>;
}

export function DateTimeField({ label, value, onChange, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const date = value && Number.isFinite(Date.parse(value)) ? new Date(value) : undefined;
  return <Field label={label}>{id => <div className="flex items-center gap-2">
    <DatePicker id={id} date={date} setDate={next => onChange(next.toISOString())} disabled={disabled} showEvents={false} showTimePicker placeholder="Select date and time" />
    {value && <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-label={`Clear ${label}`} onClick={() => onChange('')}>Clear</Button>}
  </div>}</Field>;
}

export function DateOnlyField({ label, value, onChange, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const date = value ? new Date(`${value}T12:00:00`) : undefined;
  return <Field label={label}>{id => <div className="flex items-center gap-2">
    <DatePicker id={id} date={date} disabled={disabled} showEvents={false} placeholder="Select date" setDate={next => {
      onChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`);
    }} />
    {value && <Button type="button" variant="ghost" size="sm" disabled={disabled} aria-label={`Clear ${label}`} onClick={() => onChange('')}>Clear</Button>}
  </div>}</Field>;
}

export function TextField({ label, value, onChange, ...props }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number;
}) {
  return <Field label={label}>{(id) => <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} />}</Field>;
}

export function NumberField({ label, value, onChange, min = 1 }: {
  label: string; value: number; onChange: (value: number) => void; min?: number;
}) {
  return <Field label={label}>{(id) => <Input id={id} type="number" min={min} step={1}
    value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />}</Field>;
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  const id = useId();
  return <div className="flex items-center gap-2"><Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} /><Label htmlFor={id}>{label}</Label></div>;
}

export function currencyScale(currency: string) {
  try { return 10 ** (new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2); }
  catch { return 100; }
}

export function AmountField({ label, value, currency, onChange }: {
  label: string; value: number; currency: string; onChange: (value: number) => void;
}) {
  const scale = currencyScale(currency);
  const [entry, setEntry] = useState<{ raw: string; value: number; currency: string } | null>(null);
  const rawValue = entry && Object.is(entry.value, value) && entry.currency === currency
    ? entry.raw : Number.isFinite(value) ? String(value / scale) : '';
  return <Field label={`${label} (${currency}, net of tax)`}>{(id) => <Input id={id} type="text" inputMode="decimal"
    value={rawValue} onChange={(e) => {
      const raw = e.target.value;
      const match = /^(\d+)(?:\.(\d*))?$/.exec(raw);
      const digits = Math.round(Math.log10(scale));
      const fraction = match?.[2] ?? '';
      const minor = match && fraction.length <= digits
        ? Number(`${match[1]}${fraction.padEnd(digits, '0')}`) : NaN;
      const parsed = Number.isSafeInteger(minor) ? minor : NaN;
      setEntry({ raw, value: parsed, currency });
      onChange(parsed);
    }} />}</Field>;
}