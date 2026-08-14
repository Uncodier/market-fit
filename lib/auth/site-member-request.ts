import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { isAdminScreenRole } from "@/lib/auth/screen-access"

export async function createUserSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component; middleware refreshes the session.
          }
        },
      },
    }
  )
}

export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type SiteMemberAccess =
  | { error: NextResponse }
  | {
      error?: undefined
      supabase: Awaited<ReturnType<typeof createUserSupabase>>
      userId: string
      isOwner: boolean
      isAdmin: boolean
      isMember: boolean
    }

export async function getSiteMemberAccess(siteId: string): Promise<SiteMemberAccess> {
  const supabase = await createUserSupabase()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 }) }
  }

  const admin = createServiceSupabase()
  const { data: siteData, error: siteError } = await admin
    .from("sites")
    .select("name, user_id")
    .eq("id", siteId)
    .single()

  if (siteError || !siteData) {
    return { error: NextResponse.json({ success: false, error: "Site not found or access denied" }, { status: 404 }) }
  }

  const { data: membershipCheck } = await admin
    .from("site_members")
    .select("role")
    .eq("site_id", siteId)
    .eq("user_id", user.id)
    .maybeSingle()

  const isOwner = siteData.user_id === user.id
  const isAdmin = isAdminScreenRole(membershipCheck?.role)
  return { supabase, userId: user.id, isOwner, isAdmin, isMember: !!membershipCheck }
}

export function denyUnlessTeamManager(access: SiteMemberAccess): NextResponse | null {
  if (access.error) return access.error
  if (!access.isOwner && !access.isAdmin) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions to manage site members" },
      { status: 403 }
    )
  }
  return null
}
