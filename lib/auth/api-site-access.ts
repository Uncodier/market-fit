import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const SITE_MANAGER_ROLES = new Set(["owner", "admin"])

type SiteAccessOptions = {
  requireManager?: boolean
}

type SiteAccessResult =
  | {
      error: NextResponse
      role?: undefined
      supabase?: undefined
      userEmail?: undefined
      userId?: undefined
    }
  | {
      error?: undefined
      role: string
      supabase: Awaited<ReturnType<typeof createClient>>
      userEmail: string | null
      userId: string
    }

function hasAuthenticationCredentials(request: Request): boolean {
  const authorization = request.headers?.get?.("authorization")
  const cookie = request.headers?.get?.("cookie")
  return Boolean(authorization?.trim() || cookie?.trim())
}

export function isSiteManagerRole(role: unknown): role is string {
  return typeof role === "string" && SITE_MANAGER_ROLES.has(role)
}

export async function getCurrentUserSiteRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string
): Promise<string | null> {
  const { data: role, error } = await supabase.rpc(
    "current_user_site_role",
    { p_site_id: siteId }
  )

  return error || typeof role !== "string" ? null : role
}

export async function requireSiteAccess(
  request: Request,
  siteId: string,
  options: SiteAccessOptions = {}
): Promise<SiteAccessResult> {
  if (!hasAuthenticationCredentials(request)) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const supabase = await createClient(true)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const role = await getCurrentUserSiteRole(supabase, siteId)
  if (!role) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  if (options.requireManager && !isSiteManagerRole(role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return {
    role,
    supabase,
    userEmail: user.email ?? null,
    userId: user.id,
  }
}
