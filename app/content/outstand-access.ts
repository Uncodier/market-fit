import "server-only"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import {
  accountIdSchema, isRecord, matchesOutstandSite, OutstandBoundaryError, siteIdSchema,
} from "./outstand-contract"

export async function authorizeOutstandSite(input: unknown, command: "insert" | "select") {
  const parsedSite = siteIdSchema.safeParse(input)
  if (!parsedSite.success) throw new OutstandBoundaryError(400, "Invalid site ID.")
  const siteId = parsedSite.data
  // Demo data is not evidence of permission to publish or read real social posts.
  const supabase = await createClient(true)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user?.id) throw new OutstandBoundaryError(401, "Sign in to access social posts.")

  const { data: role, error: roleError } = await supabase.rpc("current_user_site_role", { p_site_id: siteId })
  if (roleError || !["owner", "admin", "collaborator", "marketing"].includes(role) ||
    !await userCanOnSite(supabase, siteId, command)) {
    throw new OutstandBoundaryError(403, "You do not have permission to access social posts in this site.")
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || session?.user?.id !== user.id || typeof session?.access_token !== "string" ||
    !session.access_token || session.access_token.length > 8192 || /\s/.test(session.access_token)) {
    throw new OutstandBoundaryError(401, "Sign in again to access social posts.")
  }
  return { siteId, supabase, token: session.access_token as string }
}

type StoredAccount = { id: string; aliases: string[]; active: boolean }

function storedAccount(row: Record<string, unknown>, active: boolean, page = false): StoredAccount | null {
  const id = accountIdSchema.safeParse(page ? row.id : row.account_id || row.accountId || row.id)
  if (!id.success) return null
  return {
    id: id.data,
    aliases: [page ? row.name : row.accountName, row.username].filter((value): value is string =>
      typeof value === "string" && value.length > 0),
    active: active && row.isActive !== false && row.isActive !== 0,
  }
}

export async function resolveOutstandAccounts(
  access: Awaited<ReturnType<typeof authorizeOutstandSite>>, selectors: string[],
): Promise<string[]> {
  const { data, error } = await access.supabase.from("settings")
    .select("site_id, social_media").eq("site_id", access.siteId).maybeSingle()
  if (error) throw new OutstandBoundaryError(503, "Unable to verify connected social accounts.")
  if (!isRecord(data) || data.site_id !== access.siteId || !Array.isArray(data.social_media)) {
    throw new OutstandBoundaryError(403, "No verified social accounts are available in this site.")
  }

  // These are the same account/page structures used by both publishing dialogs.
  // Never use a platform name or a client-provided account mapping as authority.
  const accounts: StoredAccount[] = []
  for (const entry of data.social_media) {
    if (!isRecord(entry) || !matchesOutstandSite(entry, access.siteId)) continue
    const pages = Array.isArray(entry.connectedPages) ? entry.connectedPages : []
    const active = entry.isActive === true || entry.isActive === 1 ||
      (entry.isActive === undefined && pages.length > 0)
    if (pages.length) {
      for (const page of pages) {
        if (!isRecord(page) || !matchesOutstandSite(page, access.siteId)) continue
        const account = storedAccount(page, active, true)
        if (account) accounts.push(account)
      }
    } else {
      const account = storedAccount(entry, active)
      if (account) accounts.push(account)
    }
  }

  const ids = selectors.map(selector => {
    const exact = accounts.filter(account => account.id === selector)
    const matches = exact.length ? exact : accounts.filter(account => account.aliases.includes(selector))
    if (!matches.length || matches.some(account => !account.active) || new Set(matches.map(account => account.id)).size !== 1) {
      throw new OutstandBoundaryError(403, "Select an unambiguous, active social account connected to this site.")
    }
    return matches[0].id
  })
  return Array.from(new Set(ids))
}