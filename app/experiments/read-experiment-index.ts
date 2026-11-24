import { createClient } from '@/lib/supabase/client'
import type { Experiment } from './types'

type IndexFields = Pick<Experiment, 'id' | 'name' | 'description' | 'status' | 'start_date' | 'end_date' | 'roi' | 'conversion'>
type Segment = { id: string; name: string; participants: number }
export type ExperimentIndexRow = IndexFields & { hypothesis: string | null; preview_url: string | null;
  segments: Segment[]; campaign: { title: string } | null }
type DbRow = Omit<ExperimentIndexRow, 'segments' | 'campaign'> & { campaign_id: string | null;
  experiment_segments: { participants: number | null; segment: { id: string; name: string; site_id: string } | null }[] | null }

// Creation dialogs own their option directories. Search needs campaign labels,
// but only for campaigns referenced by rows visible in this workspace.
export async function readExperimentIndex(siteId: string, signal: AbortSignal): Promise<ExperimentIndexRow[]> {
  const db = createClient()
  const demo = siteId.startsWith('demo-')
  if ((db._isMock && !demo) || Boolean(db._isDemo) !== demo) throw new Error('Experiments unavailable')
  const query = db.from('experiments').select(`id,name,description,status,start_date,end_date,conversion,roi,preview_url,hypothesis,campaign_id,
    experiment_segments(participants,segment:segments(id,name,site_id))`).eq('site_id', siteId).order('created_at', { ascending: false })
  const { data, error } = await (demo ? query : query.abortSignal(signal))
  if (signal.aborted) throw new Error('Experiment read cancelled')
  if (error || !Array.isArray(data)) throw new Error('Experiments unavailable')
  const rows = data as DbRow[]
  const ids = [...new Set(rows.flatMap(row => row.campaign_id ? [row.campaign_id] : []))]
  const labels = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 100) {
    const campaigns = db.from('campaigns').select('id,title').eq('site_id', siteId).in('id', ids.slice(i, i + 100))
    const { data: matches, error: labelError } = await (demo ? campaigns : campaigns.abortSignal(signal))
    if (signal.aborted) throw new Error('Experiment read cancelled')
    if (labelError) break // An unavailable label must not hide an authorized experiment.
    for (const campaign of matches ?? []) labels.set(campaign.id, campaign.title)
  }
  return rows.map(({ campaign_id, experiment_segments, ...row }) => {
    const title = campaign_id && labels.get(campaign_id)
    return { ...row, campaign: title ? { title } : null,
      segments: (experiment_segments ?? []).flatMap(({ segment, participants }) => segment?.site_id === siteId
        ? [{ id: segment.id, name: segment.name, participants: participants ?? 0 }] : []) }
  })
}