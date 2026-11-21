import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { readSupervisorDirectory, SupervisorDirectoryError } from '@/lib/agents/supervisor-directory'

const uuid = z.string().uuid().transform(id => id.toLowerCase())
const input = z.object({ siteId: uuid, agentId: uuid.optional() }).strict()
const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  const params = input.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!params.success) return Response.json({ error: 'Invalid site or agent' }, { status: 400, headers })
  try {
    const { siteId, agentId } = params.data
    const access = await requireSiteAccess(request, siteId)
    if (access.error) return access.error
    return Response.json(await readSupervisorDirectory(access.supabase, siteId, agentId, request.signal), { headers })
  } catch (error) {
    return Response.json({ error: 'Supervisor options unavailable' }, { headers, status: error instanceof SupervisorDirectoryError ? error.status : 503 })
  }
}