"use client"

export function ReportCurrencySelect({ label, value, currencies, onChange }: {
  label: string
  value: string
  currencies: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm font-medium">
      {label}
      <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}
        className="rounded-md border bg-background px-3 py-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="">Choose currency</option>
        {currencies.map(currency => <option key={currency} value={currency}>
          {currency === "UNSPECIFIED" ? "Currency unspecified" : currency}
        </option>)}
      </select>
    </label>
  )
}