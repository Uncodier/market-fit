import { Input } from "@/app/components/ui/input"
import { currencyDisplays, type RecordCurrency } from "../lib/record-field-presentation"

export function RecordCurrencySettings({ value, onChange }: { value: RecordCurrency; onChange: (value: RecordCurrency) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="min-w-0 space-y-1 text-xs font-medium">
        <span>Currency</span>
        <Input value={value.code} maxLength={3} placeholder="USD" autoCapitalize="characters"
          onChange={event => onChange({ ...value, code: event.target.value.toUpperCase() })} />
      </label>
      <label className="min-w-0 space-y-1 text-xs font-medium">
        <span>Currency format</span>
        <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={value.display}
          onChange={event => onChange({ ...value, display: event.target.value as RecordCurrency["display"] })}>
          {Object.entries(currencyDisplays).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
    </div>
  )
}