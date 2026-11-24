import { PostgrestClient } from '@supabase/postgrest-js'
import { createClient } from '@/lib/supabase/client'

export const siteId = '10000000-0000-4000-8000-000000000001'
export const actorId = '20000000-0000-4000-8000-000000000002'
export const otherId = '30000000-0000-4000-8000-000000000003'

// Installed SDK request builder, isolated HTTP transport. No real environment,
// database, credentials, permission store or external auth provider involved.
export function operationsFixture() {
  const controller = new AbortController()
  const input = { actorId, siteId, signal: controller.signal }
  const getUser = jest.fn().mockResolvedValue({ data: { user: { id: actorId } }, error: null })
  const bodies: Record<string, unknown> = {
    'rpc/current_user_site_role': 'collaborator', 'rpc/current_user_has_site_location_restrictions': false,
    'rpc/user_can': true, 'rpc/get_my_site_capabilities': { role: 'collaborator', select: true, is_owner: false },
    site_members: [{ role: 'collaborator', status: 'active', restrict_to_assigned_only: false }],
    sale_orders: [], reservations: [], shipments: [], inventory_levels: [], inventory_transfer_orders: [],
    inventory_movements: [], inventory_transfer_stock_events: [], remote_instances: [],
  }
  const failures: Record<string, number> = {}
  const calls: { path: string; params: URLSearchParams; init?: RequestInit }[] = []
  const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async (request, init) => {
    const url = new URL(String(request))
    const path = url.pathname.replace('/rest/v1/', '')
    calls.push({ path, params: url.searchParams, init })
    if (!Object.hasOwn(bodies, path)) throw new Error('Unexpected request in fixture')
    if (failures[path]) return Response.json({ code: '57014', message: 'Private error details' }, { status: failures[path] })
    return Response.json(bodies[path])
  })
  const db = Object.assign(new PostgrestClient('https://operations.example.invalid/rest/v1', { fetch: transport }), { auth: { getUser } })
  jest.mocked(createClient).mockReturnValue(db)
  return {
    input, controller, getUser, db, transport, calls, bodies, failures,
    paths: () => calls.map(c => c.path),
    params: (name: string) => {
      const call = calls.find(c => c.path === name)
      if (!call) throw new Error(`No request to ${name}`)
      return call.params
    },
  }
}