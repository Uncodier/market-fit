import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export type ServiceAccessMode = 'workspace' | 'public' | 'system'

/** Only server-owned callsites may select public/system; never forward a request flag. */
export function locationGuardedServiceFetch(access: ServiceAccessMode = 'workspace'): typeof fetch {
  return async (input, init) => {
    if (access !== 'workspace') return fetch(input, init)
    let cookieStore: Awaited<ReturnType<typeof cookies>>
    try {
      cookieStore = await cookies()
    } catch {
      // Workers and public cached reads must opt into their own explicit contract.
      return deniedResponse(403, 'Workspace authorization context is required')
    }
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => undefined } },
    )
    const { data: { user }, error: authError } = await client.auth.getUser()
    if (authError || !user) return deniedResponse(401, 'Workspace authentication is required')
    const { data, error } = await client.rpc('current_user_has_location_restrictions')
    if (error || typeof data !== 'boolean') return deniedResponse(503, 'Location authorization could not be verified')
    if (data) return deniedResponse(403, 'This operation requires unrestricted location access')
    return fetch(input, init)
  }
}

function deniedResponse(status: number, message: string) {
  return new Response(JSON.stringify({ code: status === 403 ? '42501' : 'LOCATION_ACCESS_UNAVAILABLE', message }), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
  })
}