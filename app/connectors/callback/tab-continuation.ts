import { z } from "zod"

// sessionStorage is scoped to this top-level browsing context; cookies are not.
// Never put the nonce, session_uri, redirect URL or provider identity here.
const key = "mf.connector.tab.v1"
const marker = z.object({ attempt_id: z.string().uuid(), continuation: z.string().regex(/^[a-f0-9]{64}$/), expires: z.number().finite() }).strict()
type Marker = z.infer<typeof marker>

export function readTabAttempt(): Marker | null {
  try {
    const value = marker.safeParse(JSON.parse(sessionStorage.getItem(key) || "null"))
    return value.success && value.data.expires > Date.now() ? value.data : null
  } catch { return null }
}

// Synchronous test-and-set immediately before navigation. Even if two starts
// resolve out of order, only one of their links may leave this tab.
export function bindTabAttempt(attempt_id: string, continuation: string) {
  try {
    if (readTabAttempt()) return false
    sessionStorage.setItem(key, JSON.stringify(marker.parse({ attempt_id, continuation, expires: Date.now() + 600_000 })))
    return true
  } catch { return false }
}

export function clearCompletedTabAttempt(attemptId: string) {
  try { if (readTabAttempt()?.attempt_id === attemptId) sessionStorage.removeItem(key) } catch { /* Fail closed until expiry. */ }
}