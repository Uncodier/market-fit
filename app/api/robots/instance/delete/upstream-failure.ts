import { z } from "zod"
import { decodeRequestBody, readLimitedRequestBody } from "@/lib/http/read-limited-request-body"

const knownFailures = {
  deletion_failed: {
    status: 500,
    message: "The deletion API reported a database error. Refresh the instance list and contact support before trying again.",
  },
  AUTH_ERROR: {
    status: 500,
    message: "The deletion API encountered an authentication error. Refresh the instance list and contact support before trying again.",
  },
  provider_stop_failed: {
    status: 502,
    message: "Provider stop could not be confirmed. No database deletion was attempted. Verify provider state before trying again.",
  },
  RATE_LIMIT_UNAVAILABLE: {
    status: 503,
    message: "Instance deletion admission is temporarily unavailable. Refresh the instance list before trying again.",
  },
  RATE_LIMITED: {
    status: 429,
    message: "Too many requests. Refresh the instance list and wait before trying again.",
  },
} as const

const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.enum([
    "deletion_failed", "AUTH_ERROR", "provider_stop_failed", "RATE_LIMIT_UNAVAILABLE", "RATE_LIMITED",
  ]) }),
})

/** Recognize only fixed code/status pairs; never forward provider messages or SQL. */
export async function readUpstreamFailure(response: Response) {
  try {
    if (!response.headers.get("content-type")?.includes("application/json")) return null
    const body = await readLimitedRequestBody(response as unknown as Request, 4_096)
    const result = errorSchema.safeParse(JSON.parse(decodeRequestBody(body)))
    if (!result.success) return null
    const code = result.data.error.code
    const failure = knownFailures[code]
    return response.status === failure.status ? { code, message: failure.message } : null
  } catch {
    return null
  } finally {
    // An invalid response must not trigger another destructive request.
    void response.body?.cancel().catch(() => {})
  }
}