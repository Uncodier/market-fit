"use client"

import { useId, useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/app/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { isLeadMessageAssetUrl, leadMessageMediaType } from '@/lib/chat/new-lead-message'

export type LeadMessageAsset = { id: string; name: string; file_type: string; file_path: string }

export function LeadMessageAttachment({ siteId, channel, asset, onChange, disabled }: {
  siteId: string; channel: string; asset?: LeadMessageAsset; disabled: boolean
  onChange: (asset?: LeadMessageAsset) => void
}) {
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const { data, error, isLoading, mutate } = useSWR(expanded ? ['lead-message-assets', siteId] as const : null,
    async ([, site]) => {
      const result = await createClient().from('assets').select('id, name, file_type, file_path')
        .eq('site_id', site).eq('is_public', true).order('created_at', { ascending: false }).limit(50)
      if (result.error) throw new Error('Unable to load attachments.')
      return (result.data ?? []).filter((item: LeadMessageAsset) => isLeadMessageAssetUrl(item.file_path)) as LeadMessageAsset[]
    }, { shouldRetryOnError: false, revalidateOnFocus: false })
  const supported = Boolean(leadMessageMediaType(channel, 'application/pdf'))
  const available = data?.filter(item => leadMessageMediaType(channel, item.file_type)) ?? []

  if (asset) return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-1 text-sm">
      <span className="truncate">{asset.name}</span>
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(undefined)}>Remove attachment</Button>
    </div>
  )
  if (!supported) return <p className="text-xs text-muted-foreground">This channel does not support attachments.</p>
  if (!expanded) return <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setExpanded(true)}>Attach from Assets</Button>

  return <div className="space-y-1">
    <label htmlFor={id} className="text-sm font-medium">Recent public files</label>
    {isLoading && <p role="status" className="text-sm text-muted-foreground">Loading files…</p>}
    {error && <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void mutate()}>Retry loading files</Button>}
    {!error && !isLoading && !available.length && <p className="text-sm text-muted-foreground">No compatible public files in Assets.</p>}
    {available.length > 0 && <select id={id} value="" disabled={disabled} className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      onChange={event => {
        onChange(available.find(item => item.id === event.target.value))
        setExpanded(false)
      }}>
      <option value="">Choose a file</option>
      {available.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>}
  </div>
}