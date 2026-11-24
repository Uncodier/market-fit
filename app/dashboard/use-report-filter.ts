"use client"

import { useState } from 'react'
import useSWR from 'swr'
import type { useFinanceWorkspace } from '@/app/finance/use-finance-workspace'
import { createClient } from '@/lib/supabase/client'
import { isKnownDemoSite } from '@/lib/demo-data'

type Kind = 'campaigns' | 'segments'
export type ReportOption = { id: string; name: string }

async function readOptions([, kind, siteId]: readonly [string, Kind, string, string]): Promise<ReportOption[]> {
  const client = createClient()
  const demo = isKnownDemoSite(siteId)
  if (Boolean(client._isDemo) !== demo || (!demo && client._isMock)) throw new Error('Filter options unavailable')
  if (kind === 'campaigns') {
    const { data, error } = await client.from('campaigns').select('id, title').eq('site_id', siteId).order('title')
    if (error || !Array.isArray(data)) throw new Error('Campaign options unavailable')
    return data.map(({ id, title }: { id: string; title: string }) => ({ id, name: title }))
  }
  const { data, error } = await client.from('segments').select('id, name').eq('site_id', siteId)
    .order('created_at', { ascending: false })
  if (error || !Array.isArray(data)) throw new Error('Segment options unavailable')
  return data.map(({ id, name }: ReportOption) => ({ id, name }))
}

export function useReportFilter(kind: Kind, workspace: ReturnType<typeof useFinanceWorkspace>, initial = 'all', supported = true) {
  const { siteId, actorId, key, ready } = workspace
  const [filter, setFilter] = useState({ key, value: initial, requested: false })
  if (filter.key !== key) {
    // Bind initial deep-link IDs to the first resolved scope only. Retire both
    // selection and picker intent before rendering another actor/site.
    setFilter({ key, value: filter.key === null ? filter.value : 'all', requested: false })
  }
  const enabled = supported && ready && filter.key === key
  const value = filter.key === key ? filter.value : 'all'
  const needed = filter.requested || value !== 'all'
  const result = useSWR(enabled && needed && siteId && actorId ? ['report-filter', kind, siteId, actorId] as const : null,
    readOptions, { keepPreviousData: false, shouldRetryOnError: false })
  return {
    value, options: !result.error ? result.data ?? [] : [], loading: result.isLoading, disabled: !enabled,
    request: () => setFilter(previous => ({ ...previous, requested: true })),
    onChange: (value: string) => setFilter({ key, value, requested: true }),
    retry: result.error ? () => { void result.mutate() } : undefined,
  }
}