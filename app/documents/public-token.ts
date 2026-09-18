import { randomBytes } from "crypto"

export const DEFAULT_PUBLIC_ACCESS_TOKEN_TTL_DAYS = 30
const MAX_PUBLIC_ACCESS_TOKEN_TTL_DAYS = 365

/** URL-safe unguessable token for public document links. */
export function generatePublicAccessToken(): string {
  return randomBytes(24).toString("base64url")
}

export function isValidPublicAccessToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== "string") return false
  return /^[A-Za-z0-9_-]{20,64}$/.test(token)
}

export function isPublicAccessTokenActive(
  record: {
    public_access_token_expires_at?: string | null
    public_access_token_revoked_at?: string | null
  },
  now = new Date()
): boolean {
  if (record.public_access_token_revoked_at) return false
  if (!record.public_access_token_expires_at) return true
  return new Date(record.public_access_token_expires_at).getTime() > now.getTime()
}

export function resolvePublicAccessTokenTtlDays(
  configuredValue = process.env.PUBLIC_DOCUMENT_TOKEN_TTL_DAYS
): number {
  const parsed = Number(configuredValue)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_PUBLIC_ACCESS_TOKEN_TTL_DAYS
  }
  return Math.min(Math.floor(parsed), MAX_PUBLIC_ACCESS_TOKEN_TTL_DAYS)
}

export function getPublicAccessTokenExpiresAt(
  now = new Date(),
  ttlDays = resolvePublicAccessTokenTtlDays()
): string {
  return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString()
}

export type PublicDocPrefix = "q" | "i" | "so" | "vb"

export function buildPublicDocPath(prefix: PublicDocPrefix, token: string): string {
  return `/${prefix}/${encodeURIComponent(token)}`
}

export function buildPublicDocUrl(
  prefix: PublicDocPrefix,
  token: string,
  appUrl?: string
): string {
  const base = (appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://makinari.com").replace(
    /\/$/,
    ""
  )
  return `${base}${buildPublicDocPath(prefix, token)}`
}
