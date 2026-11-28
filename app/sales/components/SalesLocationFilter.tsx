import { useState } from 'react'
import useSWR from 'swr'
import { useLocalization } from '@/app/context/LocalizationContext'
import { listLocations } from '@/app/inventory/actions'
import { Button } from '@/app/components/ui/button'
import { Select, SelectContent, SelectItem, SelectIconTrigger } from '@/app/components/ui/select'
import { MapPin } from '@/app/components/ui/icons'

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
  const label = t('common.location') || 'Location'
  const selectedLabel = value === 'all' ? all : locations?.data.find(location => location.id === value)?.name ?? value
  return <Select value={value} onValueChange={onChange} onOpenChange={open => { if (open) setRequested(true) }}>
    <SelectIconTrigger label={label} tooltipLabel={`${label}: ${selectedLabel}`}>
      <MapPin className="h-4 w-4" aria-hidden />
    </SelectIconTrigger>
    <SelectContent>
      <SelectItem value="all">{all}</SelectItem>
      {isLoading && <p role="status" className="px-2 py-1 text-sm text-muted-foreground">Loading locations…</p>}
      {locations?.data.map(location => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}
    </SelectContent>
  </Select>
}