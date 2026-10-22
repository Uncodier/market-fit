import "server-only"
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

const PREFIX = "mf:buyer:"
const TTL_SECONDS = 300
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function signature(payload: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("Buyer identification is unavailable.")
  return createHmac("sha256", secret).update(`buyer-identity:v1:${payload}`).digest("base64url")
}

/** A bearer proof for order attribution only, never login or access to account data. */
export function issueBuyerIdentityToken(userId: string, now = Date.now()): { code: string; expiresAt: number } {
  if (!UUID.test(userId)) throw new Error("Invalid buyer identity.")
  const expiresAt = Math.floor(now / 1000) + TTL_SECONDS
  const payload = Buffer.from(JSON.stringify({ v: 1, sub: userId, exp: expiresAt, nonce: randomUUID() })).toString("base64url")
  return { code: `${PREFIX}${payload}.${signature(payload)}`, expiresAt: expiresAt * 1000 }
}

export function verifyBuyerIdentityToken(code: unknown, now = Date.now()): string | null {
  if (typeof code !== "string" || code.length > 1024 || !code.startsWith(PREFIX)) return null
  const [payload, provided, extra] = code.slice(PREFIX.length).split(".")
  if (!payload || !provided || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{43}$/.test(provided)) return null
  const expected = Buffer.from(signature(payload))
  const actual = Buffer.from(provided)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    const seconds = Math.floor(now / 1000)
    return value.v === 1 && typeof value.sub === "string" && UUID.test(value.sub) &&
      Number.isSafeInteger(value.exp) && value.exp > seconds && value.exp <= seconds + TTL_SECONDS &&
      typeof value.nonce === "string" && UUID.test(value.nonce) ? value.sub : null
  } catch {
    return null
  }
}