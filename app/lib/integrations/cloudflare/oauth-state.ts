import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

const STATE_TTL_MS = 10 * 60 * 1000

const stateSchema = z.object({
  siteId: z.string().uuid(),
  userId: z.string().uuid(),
  expiresAt: z.number().int().positive(),
  nonce: z.string().uuid(),
})

function secret(): string | null {
  return process.env.CLOUDFLARE_CLIENT_SECRET?.trim() || null
}

function signature(payload: string, signingSecret: string): string {
  return createHmac("sha256", signingSecret).update(payload).digest("base64url")
}

export function createCloudflareOAuthState(siteId: string, userId: string): string {
  const signingSecret = secret()
  if (!signingSecret) {
    throw new Error("Cloudflare OAuth is not configured")
  }
  const payload = Buffer.from(
    JSON.stringify({
      siteId,
      userId,
      expiresAt: Date.now() + STATE_TTL_MS,
      nonce: crypto.randomUUID(),
    })
  ).toString("base64url")
  return `${payload}.${signature(payload, signingSecret)}`
}

export function verifyCloudflareOAuthState(state: string): {
  siteId: string
  userId: string
} | null {
  const signingSecret = secret()
  const [payload, receivedSignature, extra] = state.split(".")
  if (!signingSecret || !payload || !receivedSignature || extra) return null

  const expectedSignature = signature(payload, signingSecret)
  const expected = Buffer.from(expectedSignature)
  const received = Buffer.from(receivedSignature)
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return null
  }

  try {
    const parsed = stateSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    )
    if (!parsed.success || parsed.data.expiresAt < Date.now()) return null
    return { siteId: parsed.data.siteId, userId: parsed.data.userId }
  } catch {
    return null
  }
}
