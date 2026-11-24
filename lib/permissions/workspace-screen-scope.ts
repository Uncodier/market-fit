import type { SiteMemberRole } from './types'

const roles = new Set<string>(['owner', 'admin', 'marketing', 'collaborator'])
export type ScreenScope = {
  status: 'ready' | 'legacy'; role: SiteMemberRole | null; blockedScreens: string[]; locationRestricted: boolean
} | { status: 'denied' | 'unavailable' }

function validRole(role: unknown): role is SiteMemberRole { return typeof role === 'string' && roles.has(role) }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(v => typeof v === 'string') }

export function parseWorkspaceScreenScope(data: unknown, actor: string, site: string): ScreenScope {
  if (data === null) return { status: 'denied' }
  if (!data || typeof data !== 'object') return { status: 'unavailable' }
  const v = data as Record<string, unknown>
  if (v.actor_id !== actor || v.site_id !== site || !validRole(v.role) || !strings(v.blocked_screens) ||
      typeof v.location_restricted !== 'boolean') return { status: 'unavailable' }
  return { status: 'ready', role: v.role, blockedScreens: v.blocked_screens, locationRestricted: v.location_restricted }
}

type Result = { data: unknown; status?: number; error: { code?: string } | null }
export type AllowedWorkspaceListScope = { actorId: string; siteId: string; blockedScreens: readonly string[]; isAdmin: boolean }
interface Client {
  rpc: (name: string, args: { p_site_id: string }) => ReadBuilder
  from: (name: string) => { select: (fields: string) => MemberBuilder }
}
interface ReadBuilder extends PromiseLike<Result> {
  retry(enabled: boolean): ReadBuilder
  abortSignal(signal: AbortSignal): ReadBuilder
}
interface MemberBuilder { eq(field: string, value: string): MemberBuilder; maybeSingle(): ReadBuilder }

const failed = (response: Result): ScreenScope => ({ status: response.status === 401 || response.status === 403 ||
  response.error?.code === '42501' ? 'denied' : 'unavailable' })

export async function readWorkspaceScreenScope(client: Client, actor: string, site: string, signal: AbortSignal): Promise<ScreenScope> {
  const response = await client.rpc('read_workspace_screen_scope', { p_site_id: site }).retry(false).abortSignal(signal)
  if (!response.error) return parseWorkspaceScreenScope(response.data, actor, site)
  // Only a genuinely absent RPC permits the pre-migration navigation read. It
  // can never open the independent inbox path, even if a role is returned.
  if (signal.aborted || response.error.code !== 'PGRST202') return failed(response)
  const legacy = await client.from('site_members').select('role, blocked_screens')
    .eq('site_id', site).eq('user_id', actor).eq('status', 'active').maybeSingle().retry(false).abortSignal(signal)
  if (legacy.error) return failed(legacy)
  if (legacy.data === null) return { status: 'legacy', role: null, blockedScreens: [], locationRestricted: true }
  const row = legacy.data as Record<string, unknown>
  return validRole(row?.role) && strings(row.blocked_screens)
    ? { status: 'legacy', role: row.role, blockedScreens: row.blocked_screens, locationRestricted: true }
    : { status: 'unavailable' }
}