import type { SupabaseClient } from "@supabase/supabase-js"
import { CALLBACK_NETWORK_TO_OUTSTAND, getOutstandNetworkFromPath } from "@/app/api/social/network-map"

export type OutstandSocialAccount = {
  id: string
  orgId?: string
  nickname?: string
  network: string
  username?: string
  profile_picture_url?: string
  network_unique_id?: string
  customer_social_network_id?: number
  accountType?: string
  isActive?: number
  createdAt?: string
}

function mapOutstandRow(
  account: OutstandSocialAccount,
  uiPlatform: string
): Record<string, unknown> {
  return {
    id: account.id,
    orgId: account.orgId,
    nickname: account.nickname,
    platform: uiPlatform,
    network: account.network,
    username: account.username,
    profile_picture_url: account.profile_picture_url,
    network_unique_id: account.network_unique_id,
    customer_social_network_id: account.customer_social_network_id,
    accountType: account.accountType,
    isActive: true,
    createdAt: account.createdAt,
  }
}

function platformMatchesSlot(
  sm: Record<string, unknown>,
  pathNetwork: string,
  outstandNetwork: string
): boolean {
  const p = String(sm.platform || "").toLowerCase()
  const n = String(sm.network || "").toLowerCase()
  const path = pathNetwork.toLowerCase()
  if (p === path || (path === "twitter" && (p === "x" || n === "x"))) return true
  if (n && CALLBACK_NETWORK_TO_OUTSTAND[path] === n) return true
  return false
}

/**
 * Merges Outstand account metadata into site settings.social_media for accounts not yet stored by id.
 */
export function mergeOutstandIntoSocialMedia(
  existing: Record<string, unknown>[],
  accounts: OutstandSocialAccount[],
  pathNetwork: string
): { socialMedia: Record<string, unknown>[]; mergedCount: number } {
  const outstandNetwork = getOutstandNetworkFromPath(pathNetwork)
  if (!outstandNetwork) {
    return { socialMedia: [...existing], mergedCount: 0 }
  }

  const relevant = accounts.filter((a) => a.network?.toLowerCase() === outstandNetwork)
  const uiPlatform =
    pathNetwork.toLowerCase() === "x" ? "twitter" : pathNetwork.toLowerCase()

  const socialMedia = existing.map((row) => ({ ...row }))
  let mergedCount = 0

  for (const account of relevant) {
    const byId = socialMedia.findIndex((sm) => sm.id === account.id)
    if (byId >= 0) {
      socialMedia[byId] = {
        ...socialMedia[byId],
        ...mapOutstandRow(account, String(socialMedia[byId].platform || uiPlatform)),
      }
      continue
    }

    const stubIdx = socialMedia.findIndex(
      (sm) =>
        platformMatchesSlot(sm, pathNetwork, outstandNetwork) &&
        (!sm.id || String(sm.id).trim() === "")
    )

    if (stubIdx >= 0) {
      const prevPlatform = String(socialMedia[stubIdx].platform || uiPlatform)
      socialMedia[stubIdx] = {
        ...socialMedia[stubIdx],
        ...mapOutstandRow(account, prevPlatform),
      }
      mergedCount += 1
      continue
    }

    socialMedia.push(mapOutstandRow(account, uiPlatform))
    mergedCount += 1
  }

  return { socialMedia, mergedCount }
}

export async function fetchOutstandAccountsForTenant(
  tenantId: string,
  network: string
): Promise<{ accounts: OutstandSocialAccount[]; error?: string }> {
  const outstandApiUrl = process.env.OUTSTAND_API_URL || "https://api.outstand.so"
  const outstandApiKey = process.env.OUTSTAND_API_KEY
  if (!outstandApiKey) {
    return { accounts: [], error: "Outstand API key not configured" }
  }

  const url = new URL(`${outstandApiUrl}/v1/social-accounts`)
  url.searchParams.set("tenantId", tenantId)
  url.searchParams.set("network", network)
  url.searchParams.set("limit", "100")

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${outstandApiKey}`,
    },
  })

  const text = await response.text()
  if (!response.ok) {
    let errMsg = text || response.statusText
    try {
      const j = JSON.parse(text) as { error?: string; message?: string }
      errMsg = j.error || j.message || errMsg
    } catch {
      // keep raw
    }
    return { accounts: [], error: errMsg }
  }

  let data: { data?: OutstandSocialAccount[] }
  try {
    data = JSON.parse(text) as { data?: OutstandSocialAccount[] }
  } catch {
    return { accounts: [], error: "Invalid JSON from Outstand" }
  }

  const list = Array.isArray(data.data) ? data.data : []
  return { accounts: list }
}

export type SyncImplicitCallbackResult =
  | { ok: true; mergedCount: number; accountsFound: number }
  | { ok: false; message: string }

/**
 * When Outstand redirects without ?session= or ?error=, list tenant accounts on Outstand
 * and merge any new rows into settings.social_media.
 */
export async function syncImplicitOutstandCallback(params: {
  supabase: SupabaseClient
  siteId: string
  pathNetwork: string
}): Promise<SyncImplicitCallbackResult> {
  const { supabase, siteId, pathNetwork } = params
  const outstandNetwork = getOutstandNetworkFromPath(pathNetwork)
  if (!outstandNetwork) {
    return { ok: false, message: `Invalid network: ${pathNetwork}` }
  }

  const { accounts, error } = await fetchOutstandAccountsForTenant(siteId, outstandNetwork)
  if (error) {
    return { ok: false, message: error }
  }

  if (accounts.length === 0) {
    return {
      ok: false,
      message:
        "Connection could not be verified: no social accounts returned for this site on Outstand yet.",
    }
  }

  const { data: settingsRow, error: settingsError } = await supabase
    .from("settings")
    .select("id, social_media")
    .eq("site_id", siteId)
    .maybeSingle()

  if (settingsError || !settingsRow) {
    return {
      ok: false,
      message: settingsError?.message || "Could not load site settings for this tenant.",
    }
  }

  const existing = Array.isArray(settingsRow.social_media)
    ? (settingsRow.social_media as Record<string, unknown>[])
    : []

  const { socialMedia, mergedCount } = mergeOutstandIntoSocialMedia(existing, accounts, pathNetwork)

  const { error: updateError } = await supabase
    .from("settings")
    .update({
      social_media: socialMedia,
      updated_at: new Date().toISOString(),
    })
    .eq("site_id", siteId)

  if (updateError) {
    return { ok: false, message: updateError.message }
  }

  return { ok: true, mergedCount, accountsFound: accounts.length }
}
