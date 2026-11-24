"use client"

import { useDialogRead } from '../use-dialog-read'
import { createClient } from '@/lib/supabase/client'

export interface SegmentOption { id: string; name: string; description: string }
export interface CampaignOption { id: string; title: string; description: string }
export type PickerDialog = 'leads' | 'content' | 'campaigns' | 'requirements' | 'experiments'

async function readSegments(siteId: string, signal: AbortSignal): Promise<SegmentOption[]> {
  const { data, error } = await createClient().from('segments').select('id, name, description')
    .eq('site_id', siteId).order('created_at', { ascending: false }).abortSignal(signal)
  if (error || !Array.isArray(data)) throw new Error('Segment options unavailable')
  return data.map((row: SegmentOption) => ({ id: row.id, name: row.name, description: row.description ?? '' }))
}

async function readCampaigns(siteId: string, signal: AbortSignal): Promise<CampaignOption[]> {
  const { data, error } = await createClient().from('campaigns').select('id, title, description')
    .eq('site_id', siteId).order('created_at', { ascending: false }).abortSignal(signal)
  if (error || !Array.isArray(data)) throw new Error('Campaign options unavailable')
  return data.map((row: CampaignOption) => ({ id: row.id, title: row.title ?? '', description: row.description ?? '' }))
}

export function useTopbarOptions(dialog: PickerDialog, siteId: string | null,
  segments?: SegmentOption[], campaigns?: CampaignOption[]) {
  const segmentList = useDialogRead(segments === undefined ? siteId : null, readSegments)
  const campaignList = useDialogRead(dialog !== 'campaigns' && campaigns === undefined ? siteId : null, readCampaigns)
  const segmentRows = segments ?? segmentList.data
  const campaignRows = dialog === 'campaigns' ? [] : campaigns ?? campaignList.data
  return {
    segments: segmentRows ?? [], campaigns: campaignRows ?? [],
    ready: !!siteId && segmentRows !== undefined && campaignRows !== undefined,
    error: [segmentList.failed && 'segments', campaignList.failed && 'campaigns'].filter(Boolean).join(' and '),
    retry: () => {
      if (segmentList.failed) segmentList.retry()
      if (campaignList.failed) campaignList.retry()
    },
  }
}