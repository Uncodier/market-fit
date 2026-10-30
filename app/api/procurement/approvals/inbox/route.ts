import { z } from 'zod'
import { operationalRequestAccess, resultJson } from '../../requests/http'
import { procurementError } from '../../http'
import type { InboxRow } from '@/app/purchases/procurement/approvals/inbox-schema'
import { approvalStages } from '@/app/purchases/procurement/approvals/inbox-schema'
import { approvalRevisionState } from '../revision-state'

const filters = z.object({
  stage: z.enum(['all', 'requisition', 'publication', 'award', 'order']).default('all'),
  status: z.enum(['all', 'pending', 'approved', 'rejected', 'returned']).default('pending'),
  page: z.string().regex(/^\d{1,3}$/).default('0').transform(Number).refine(value => value <= 100),
})
type RequestRow = { id: string; title: string; status: 'submitted' | 'approved' | 'rejected' | 'returned'; revision: number; updated_at: string }
type EventRow = { id: string; target_id: string; event: 'publication' | 'award' | 'order'; status: 'pending' | 'approved' | 'rejected'; target_version: number; policy_revision: number; created_at: string }

export async function GET(request: Request) {
  try {
    const access = await operationalRequestAccess(request)
    if (access.error) return access.error
    const params = new URL(request.url).searchParams
    if ([...params.keys()].some(key => !['site_id', 'stage', 'status', 'page'].includes(key)) ||
      ['stage', 'status', 'page'].some(key => params.getAll(key).length > 1)) return procurementError('Invalid approval filters', 400)
    const parsed = filters.safeParse(Object.fromEntries(['stage', 'status', 'page'].flatMap(key => params.has(key) ? [[key, params.get(key)]] : [])))
    if (!parsed.success) return procurementError('Invalid approval filters', 400)
    const { stage, status, page } = parsed.data
    const needed = (page + 1) * 50
    // Stay below the PostgREST per-response row cap even for deep merged pages.
    const ranges = Array.from({ length: Math.ceil(needed / 500) }, (_, index) => [index * 500, Math.min((index + 1) * 500, needed) - 1] as const)
    // The first N of each sorted source suffice for the first N of their merged list.
    // Queries remain user-scoped: hidden documents never contribute rows or counts.
    const readRequests = async (): Promise<{ rows: InboxRow[]; count: number }> => {
      if (!['all', 'requisition'].includes(stage)) return { rows: [], count: 0 }
      const batches = await Promise.all(ranges.map(async ([start, end]) => {
      let query = access.supabase.from('procurement_requests').select('id,title,status,revision,updated_at', { count: 'exact' })
        .eq('site_id', access.siteId).in('status', ['submitted', 'approved', 'rejected', 'returned'])
      if (status !== 'all') query = query.eq('status', status === 'pending' ? 'submitted' : status)
      const result = await query.order('updated_at', { ascending: false }).order('id').range(start, end)
      if (result.error) throw new Error('Request read failed')
      return result
      }))
      return { count: batches[0].count ?? 0, rows: batches.flatMap(result => result.data ?? []).map((row: RequestRow) => ({
        id: `request:${row.id}`, target_id: row.id, stage: 'requisition', title: row.title,
        status: row.status === 'submitted' ? 'pending' : row.status, revision: row.revision, date: row.updated_at,
      })) }
    }
    const readEvents = async (): Promise<{ rows: InboxRow[]; count: number }> => {
      if (stage === 'requisition' || status === 'returned') return { rows: [], count: 0 }
      const batches = await Promise.all(ranges.map(async ([start, end]) => {
      let query = access.supabase.from('procurement_event_approvals')
        .select('id,target_id,event,status,target_version,policy_revision,created_at', { count: 'exact' }).eq('site_id', access.siteId)
        .in('event', ['publication', 'award', 'order'])
      if (stage !== 'all') query = query.eq('event', stage)
      if (status !== 'all') query = query.eq('status', status)
      const result = await query.order('created_at', { ascending: false }).order('id').range(start, end)
      if (result.error) throw new Error('Event read failed')
      return result
      }))
      const events = await approvalRevisionState<EventRow>(access.supabase, access.siteId, batches.flatMap(result => result.data ?? []))
      return { count: batches[0].count ?? 0, rows: events.map(row => ({
        id: `event:${row.id}`, target_id: row.target_id, stage: row.event,
        title: `${approvalStages[row.event]} · ${row.target_id.slice(0, 8)}`, status: row.status,
        revision: row.target_version, date: row.created_at, is_deprecated: row.is_deprecated,
      })) }
    }
    const sources = await Promise.all([readRequests(), readEvents()])
    const rows = sources.flatMap(source => source.rows).sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.id.localeCompare(b.id))
    return resultJson({ rows: rows.slice(page * 50, (page + 1) * 50), count: sources.reduce((sum, source) => sum + source.count, 0) })
  } catch { return procurementError('Unable to load the complete approvals inbox. No partial results are shown.', 503) }
}