import "server-only"

import { formatInTimeZone } from "date-fns-tz"
import { createClient } from "@/lib/supabase/server"
import { getSocialDateRange } from "./social-trends"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DAY_MS = 86_400_000

/** Only locally authored messages may cross the Server Action boundary. */
export class SocialActionError extends Error {}

export function socialActionError(error: unknown, fallback: string) {
  return error instanceof SocialActionError ? error.message : fallback
}

export function validateSocialSiteId(siteId: unknown): asserts siteId is string {
  if (typeof siteId !== "string" || !UUID_RE.test(siteId)) {
    throw new SocialActionError("Invalid site ID")
  }
}

export function validateSocialItemIds(contentId: unknown, postId: unknown) {
  if (contentId != null && (typeof contentId !== "string" || !UUID_RE.test(contentId))) {
    throw new SocialActionError("Invalid content ID")
  }
  // Provider IDs are opaque references, not URLs or PostgREST filter expressions.
  // Permit common short IDs, UUIDs, composite IDs and URNs, up to 512 characters.
  if (postId != null && (typeof postId !== "string" || !/^[a-z0-9][a-z0-9._:/-]{0,511}$/i.test(postId))) {
    throw new SocialActionError("Invalid post ID")
  }
}

export function validateSocialRange(startDate: Date, endDate: Date, timeZone: string) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)
    || !Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())
    || startDate.getTime() > endDate.getTime()) {
    throw new SocialActionError("Invalid date range")
  }
  try {
    if (typeof timeZone !== "string" || !timeZone || timeZone.length > 100) throw new Error()
    new Intl.DateTimeFormat("en-US", { timeZone }).format(startDate)
  } catch {
    throw new SocialActionError("Invalid time zone")
  }

  const calendarDay = (date: Date) => Date.parse(`${formatInTimeZone(date, timeZone, "yyyy-MM-dd")}T00:00:00Z`) / DAY_MS
  const days = calendarDay(endDate) - calendarDay(startDate) + 1
  if (!Number.isFinite(days) || days < 1) throw new SocialActionError("Invalid date range")
  if (days > 366) throw new SocialActionError("Date range cannot exceed 366 calendar days")
  const range = getSocialDateRange(startDate, endDate, timeZone)
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.start > range.end) {
    throw new SocialActionError("Invalid date range")
  }
  return range
}

export async function requireSocialSiteClient(siteId: string) {
  validateSocialSiteId(siteId)
  // Skip demo substitution; this remains a session-scoped, RLS-protected client.
  const client = await createClient(true)
  const { data, error } = await client.auth.getUser()
  if (error || !data?.user) throw new SocialActionError("Unauthorized")
  const { data: role, error: roleError } = await client.rpc("current_user_site_role", { p_site_id: siteId })
  if (roleError || typeof role !== "string" || !role) throw new SocialActionError("Forbidden")
  return client
}