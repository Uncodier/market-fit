import "server-only"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { readLocationRestrictionState } from "@/lib/permissions/location-boundary"

export class SocialLocationAccessError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? "Unauthorized" : "This operation requires unrestricted location access")
  }
}

/**
 * Supabase client for /api/social/* that never clears or overwrites session
 * cookies with empty/maxAge=0. getSession() and refresh can trigger set('')
 * or remove(), which would log the user out during the OAuth flow (auth-url
 * before redirect, or pending/finalize after return). This client no-ops those
 * writes so the session is preserved.
 */
export async function createSocialSupabaseClient() {
  const cookieStore = await cookies()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          if (value === "" || value == null || options?.maxAge === 0) return
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // ignore
          }
        },
        remove() {
          // No-op: never clear session in social OAuth flow.
        },
      },
    }
  )
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || user.is_anonymous) throw new SocialLocationAccessError(401)
  if (await readLocationRestrictionState(client) !== false) throw new SocialLocationAccessError(403)
  return client
}
