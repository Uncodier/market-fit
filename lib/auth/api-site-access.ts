import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { userCanOnLocation } from "@/lib/permissions/location-access"
import { canAccessUnscopedSite } from "@/lib/permissions/location-boundary"
import type { PermissionCommand } from "@/lib/permissions/types"
import { lookupCurrentUserSiteRole, SiteRoleLookupError } from "./site-role-lookup"

const SITE_MANAGER_ROLES = new Set(["owner", "admin"])

type SiteAccessOptions = {
  requireManager?: boolean
  location?: { id: string | null; command: PermissionCommand }
  /** Only for audited user-scoped queries whose complete projection is RLS protected. */
  allowLocationScoped?: boolean
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
  return lookupCurrentUserSiteRole(supabase, siteId)
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

  let role: string | null
  try {
    role = await getCurrentUserSiteRole(supabase, siteId)
  } catch (error) {
    if (!(error instanceof SiteRoleLookupError)) throw error
    return { error: NextResponse.json({ error: error.message }, {
      status: error.status, headers: { "Cache-Control": "private, no-store" },
    }) }
  }
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

  if (options.location && !await userCanOnLocation(supabase, siteId, options.location.id, options.location.command)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  if (!options.location && !options.allowLocationScoped && !await canAccessUnscopedSite(supabase, siteId)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, {
        status: 403, headers: { "Cache-Control": "private, no-store" },
      }),
    }
  }

  return {
    role,
    supabase,
    userEmail: user.email ?? null,
    userId: user.id,
  }
}
