import { useState } from 'react'
import useSWR from 'swr'
import { useLocalization } from '@/app/context/LocalizationContext'
import { listLocations } from '@/app/inventory/actions'
import { Button } from '@/app/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'

export function SalesLocationFilter({ siteId, actorId, value, onChange }: {
  siteId: string; actorId: string; value: string; onChange: (value: string) => void
}) {
  const { t } = useLocalization()
  const [requested, setRequested] = useState(false)
  const { data: locations, isLoading, mutate } = useSWR(requested || value !== 'all' ? ['sales-location-options', siteId, actorId] : null,
    ([, id]) => listLocations(id).catch(() => ({ data: [], error: 'Locations unavailable' })),
    { keepPreviousData: false })
  if (locations?.error) return <div role="alert" className="flex items-center gap-2 text-sm">
    Location options unavailable.
    <Button size="sm" variant="outline" onClick={() => { void mutate() }}>Retry location options</Button>
  </div>
  const all = t('common.allLocations') || 'All Locations'
  return <Select value={value} onValueChange={onChange} onOpenChange={open => { if (open) setRequested(true) }}>
    <SelectTrigger aria-label="Location" className="w-[160px] h-8 text-xs bg-muted/30 border-0 rounded-full">
      <SelectValue>{value === 'all' ? all : locations?.data.find(location => location.id === value)?.name ?? value}</SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{all}</SelectItem>
      {isLoading && <p role="status" className="px-2 py-1 text-sm text-muted-foreground">Loading locations…</p>}
      {locations?.data.map(location => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}
    </SelectContent>
  </Select>
}