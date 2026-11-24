import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

const paramsSchema = z.object({ site_id: z.string().uuid(), user_id: z.string().uuid().optional(),
  view: z.literal('unread').optional() }).strict()
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function readNotifications(request: Request) {
  try {
    const query = new URL(request.url).searchParams
    const params = paramsSchema.safeParse(Object.fromEntries(query))
    if (!params.success || [...query.keys()].some(key => query.getAll(key).length !== 1)) return json({ error: 'Invalid notification query' }, 400)
    const { site_id: siteId, user_id: expectedActor, view } = params.data
    const access = await requireSiteAccess(request, siteId)
    if (access.error) { access.error.headers.set('Cache-Control', 'private, no-store'); return access.error }
    if (expectedActor && access.userId !== expectedActor) return json({ error: 'Forbidden' }, 403)
    const table = access.supabase.from('notifications')
    // Count the same newest page as the inbox. Do not count unread notices outside
    // that window or download their bodies, links, titles, or entity identifiers.
    const select = view === 'unread' ? table.select('is_read') : table.select('*')
    const { data, error } = await select.eq('site_id', siteId).eq('user_id', access.userId)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1000).abortSignal(request.signal)
    if (error || !Array.isArray(data)) return json({ error: 'Notifications unavailable' }, 503)
    return view === 'unread' ? json({ unreadCount: data.filter(row => !row.is_read).length }) : json({ notifications: data })
  } catch { return json({ error: 'Notifications unavailable' }, 503) }
}