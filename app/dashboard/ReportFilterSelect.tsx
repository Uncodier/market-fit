import { Button } from '@/app/components/ui/button'
import { Select, SelectContent, SelectItem, SelectIconTrigger } from '@/app/components/ui/select'
import { Filter } from '@/app/components/ui/icons'
import type { ReportOption } from './use-report-filter'

export function ReportFilterSelect({ label, all, value, options, onChange, request, retry, loading, disabled }: {
  label: string; all: string; value: string; options: ReportOption[]; onChange: (value: string) => void
  request?: () => void; retry?: () => void; loading: boolean; disabled?: boolean
}) {
  if (retry) return <div role="alert" className="flex items-center gap-2 text-sm">
    {label} options unavailable.
    <Button size="sm" variant="outline" disabled={loading} onClick={retry}>Retry {label.toLowerCase()} options</Button>
  </div>
  const selectedLabel = value === 'all' ? all : options.find(option => option.id === value)?.name ?? value
  return <Select value={value} onValueChange={onChange} disabled={disabled} onOpenChange={open => { if (open) request?.() }}>
    <SelectIconTrigger label={label} tooltipLabel={`${label}: ${selectedLabel}`} disabled={disabled}>
      <Filter className="h-4 w-4" aria-hidden />
    </SelectIconTrigger>
    <SelectContent className="min-w-[180px] w-auto">
      <SelectItem value="all">{all}</SelectItem>
      {loading && <p role="status" className="px-2 py-1 text-sm text-muted-foreground">Loading options…</p>}
      {options.map(option => <SelectItem key={option.id} value={option.id} className="whitespace-normal">{option.name}</SelectItem>)}
    </SelectContent>
  </Select>
}