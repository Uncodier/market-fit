import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { SAVED_LIST_PAGE_SIZE, savedListSnapshotSchema } from '@/app/people/saved-list-types'
import { savedPersonProfile } from './saved-person-profile'

const uuid = z.string().uuid()
const pageSchema = z.coerce.number().int().min(1).max(100_000)
const headers = { 'Cache-Control': 'private, no-store' }
const memberSchema = z.object({
  person_id: z.string(), processing_status: z.enum(['pending', 'completed']),
  outcome: z.enum(['matched', 'no_match', 'needs_review']).nullable(),
  leads: z.object({ id: uuid, site_id: uuid, name: z.string().nullable(),
    position: z.string().nullable(), company: z.unknown(), profile: z.unknown() }).nullable(),
})
const parentSchema = z.object({ id: uuid, name: z.string().nullable(), status: z.string() })

/** Read persisted members, not a provider search; RLS authorizes every list and lead. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = new URL(request.url).searchParams
    const id = uuid.safeParse((await context.params).id)
    const site = uuid.safeParse(params.get('site_id'))
    const page = pageSchema.safeParse(params.get('page') ?? '1')
    if (!id.success || !site.success || !page.success || params.getAll('site_id').length !== 1
      || params.getAll('page').length > 1 || [...params.keys()].some(k => !['site_id', 'page'].includes(k))) {
      return NextResponse.json({ error: 'Invalid saved list request' }, { status: 400, headers })
    }
    const access = await requireSiteAccess(request, site.data)
    if (access.error) return access.error
    const parent = await access.supabase.from('icp_mining').select('id,name,status')
      .eq('id', id.data).eq('site_id', site.data).maybeSingle()
    if (parent.error) throw new Error('List read unavailable')
    if (!parent.data) return NextResponse.json({ error: 'List unavailable' }, { status: 404, headers })
    const parsedParent = parentSchema.parse(parent.data)
    const offset = (page.data - 1) * SAVED_LIST_PAGE_SIZE
    const [members, completed] = await Promise.all([
      access.supabase.from('icp_mining_people')
        .select('person_id,processing_status,outcome,leads(id,site_id,name,position,company,profile:metadata->finder->person)', { count: 'exact' })
        .eq('icp_mining_id', id.data).eq('site_id', site.data).order('ordinal', { ascending: true })
        .range(offset, offset + SAVED_LIST_PAGE_SIZE - 1),
      access.supabase.from('icp_mining_people').select('ordinal', { count: 'exact', head: true })
        .eq('icp_mining_id', id.data).eq('site_id', site.data).eq('processing_status', 'completed'),
    ])
    if (members.error || completed.error || members.count == null || completed.count == null) throw new Error('Members unavailable')
    if (completed.count > members.count) throw new Error('Invalid member counts')
    const rows = z.array(memberSchema).max(SAVED_LIST_PAGE_SIZE).parse(members.data)
    if (rows.some(row => row.leads && row.leads.site_id !== site.data)) throw new Error('Invalid lead scope')
    const snapshot = savedListSnapshotSchema.parse({
      id: id.data, siteId: site.data, name: parsedParent.name?.trim() || `List ${id.data.slice(0, 8)}…`,
      status: parsedParent.status, total: members.count, completed: completed.count,
      page: page.data, pageSize: SAVED_LIST_PAGE_SIZE,
      members: rows.map(row => ({ personId: row.person_id, processing: row.processing_status, outcome: row.outcome,
        lead: row.leads ? { id: row.leads.id, name: row.leads.name } : null,
        result: savedPersonProfile(row.person_id, row.leads) })),
    })
    return NextResponse.json(snapshot, { headers })
  } catch {
    return NextResponse.json({ error: 'Could not load saved list members' }, { status: 503, headers })
  }
}