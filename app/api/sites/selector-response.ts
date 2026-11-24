import 'server-only'
import { NextResponse } from 'next/server'
import type { createUserSupabase } from '@/lib/auth/site-member-request'
import { readSelectorSites } from '@/lib/sites/selector-cache'
import { readPages, SITE_LIST_COLUMNS, type SiteRow, type SitesQuery } from '@/lib/sites/list-accessible-sites'
import { SitesRequestTiming } from './request-timing'

/** Verify location before even reading presentation metadata from cache. */
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
  // Membership flags can lag a billing expiry. The user-scoped RPC reaches
  // current_user_site_role and checks the effective license at read time.
  const result = await timing.measure('list', () => readSelectorSites(userId, databaseSignal =>
    readPages<SiteRow>(() => userClient.rpc('get_my_accessible_sites', {}, { get: true, count: 'exact' })
      .select(SITE_LIST_COLUMNS) as unknown as SitesQuery, 'id', databaseSignal), fresh))
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