import { randomBytes } from "crypto"

/** URL-safe unguessable token for public document links. */
export function generatePublicAccessToken(): string {
  return randomBytes(24).toString("base64url")
}

export function isValidPublicAccessToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== "string") return false
  return /^[A-Za-z0-9_-]{20,64}$/.test(token)
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
