import "server-only"
import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import { headers } from "next/headers"

/** Only the hosting edge's overwritten IP header is an admission identity. */
export async function publicCatalogClientBucket(serviceKey: string): Promise<string | undefined> {
  // Self-hosted deployments have no established trusted proxy contract here.
  if (process.env.VERCEL !== "1") return undefined
  try {
    const incoming = await headers()
    const ip = incoming.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    if (!ip || !isIP(ip)) return undefined
    // Keep the raw IP and incoming x-catalog-client-id out of the API transport.
    // Domain separation avoids reusing this pseudonym for other services.
    return createHmac("sha256", serviceKey).update(`catalog-search-client:v1:${ip}`).digest("hex")
  } catch {
    // Non-request work retains the API's aggregate service admission limit.
    return undefined
  }
}