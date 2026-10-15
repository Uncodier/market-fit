import { z } from "zod"

export class MarketplaceRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

/** Bound buffered bytes rather than trusting Content-Length supplied by callers. */
export async function readMarketplaceBody(request: Request, limit = 256 * 1024) {
  const declared = Number(request.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > limit) {
    throw new MarketplaceRequestError("Request too large", 413)
  }
  if (!request.body) return ""
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new MarketplaceRequestError("Request too large", 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString("utf8")
}

export function parseMarketplaceJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    throw new MarketplaceRequestError("Invalid JSON", 400)
  }
}

export const marketplaceActionSchema = z.object({
  action: z.enum(["accept", "reject", "ready", "cancel"]),
  reason: z.string().trim().min(1).max(500).optional(),
  cooking_time_minutes: z.number().int().min(1).max(120).optional(),
}).strict().superRefine((value, context) => {
  if ((value.action === "reject" || value.action === "cancel") && !value.reason) {
    context.addIssue({ code: "custom", message: "A reason is required", path: ["reason"] })
  }
})

export type MarketplaceActionInput = z.infer<typeof marketplaceActionSchema>

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin) {
    throw new MarketplaceRequestError("Forbidden", 403)
  }
}