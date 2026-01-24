import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Supabase client for /api/social/* that never clears or overwrites session
 * cookies with empty/maxAge=0. getSession() and refresh can trigger set('')
 * or remove(), which would log the user out during the OAuth flow (auth-url
 * before redirect, or pending/finalize after return). This client no-ops those
 * writes so the session is preserved.
 */
export async function createSocialSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
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
        remove(_name: string, _opts?: Record<string, unknown>) {
          // No-op: never clear session in social OAuth flow.
        },
      },
    }
  )
}
