/**
 * Maps URL path segment (/api/social/callback/:network) to Outstand API network slug.
 */
export const CALLBACK_NETWORK_TO_OUTSTAND: Record<string, string> = {
  facebook: "facebook",
  linkedin: "linkedin",
  tiktok: "tiktok",
  instagram: "instagram",
  threads: "threads",
  twitter: "x",
  x: "x",
  youtube: "youtube",
}

export function getOutstandNetworkFromPath(pathNetwork: string | undefined): string | null {
  if (!pathNetwork) return null
  return CALLBACK_NETWORK_TO_OUTSTAND[pathNetwork.toLowerCase()] ?? null
}
