import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { createUserSupabase } from '@/lib/auth/site-member-request'
import { readSelectorSites } from '@/lib/sites/selector-cache'
import { SitesRequestTiming } from './request-timing'

/** The global service fetch repeats this gate for every query. Here it is verified
 * once per request, before cache access or creating a narrowly scoped list client.
 */
export async function selectorResponse(
  userClient: Awaited<ReturnType<typeof createUserSupabase>>, userId: string, signal: AbortSignal, fresh = false,
  timing = new SitesRequestTiming(),
) {
  const { data, error } = await timing.measure('location', () =>
    userClient.rpc('current_user_has_location_restrictions').abortSignal(signal))
  if (signal.aborted) throw new Error('Project request aborted')
  if (error || typeof data !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Workspace access is temporarily unavailable' }, { status: 503 })
  }
  if (data) return NextResponse.json({ success: false, error: 'Unrestricted location access is required' }, { status: 403 })
  const result = await timing.measure('list', () => readSelectorSites(userId, databaseSignal => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: databaseSignal }) },
    },
  ), fresh))
  timing.record('redis_read', result.cacheReadMs)
  timing.record('redis_write', result.cacheFillMs)
  return NextResponse.json({ success: true, sites: result.sites, authoritative: result.authoritative,
    revalidateAfterMs: result.revalidateAfterMs }, {
    headers: {
      'X-Sites-Cache': result.cache,
      ...(result.cacheReason ? { 'X-Sites-Cache-Reason': result.cacheReason } : {}),
    },
  })
}