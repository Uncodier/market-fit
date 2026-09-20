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

  const { data: role, error: roleError } = await supabase.rpc(
    "current_user_site_role",
    { p_site_id: siteId }
  )

  if (roleError || typeof role !== "string") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  if (options.requireManager && !SITE_MANAGER_ROLES.has(role)) {
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
