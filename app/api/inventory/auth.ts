import "server-only"

import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { lookupCurrentUserSiteRole, SiteRoleLookupError } from "@/lib/auth/site-role-lookup"

type InventoryAccess = Awaited<ReturnType<typeof requireSiteAccess>>

function denied(error: string, status: number): InventoryAccess {
  return { error: NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } }) }
}

function jwtClaims(token: string): Record<string, unknown> | null {
  if (token.length > 16_384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null
  try {
    const claims: unknown = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"))
    return claims && typeof claims === "object" && !Array.isArray(claims) ? claims as Record<string, unknown> : null
  } catch { return null }
}

/** Delegated user JWT boundary. A present invalid header never falls back to cookies. */
export async function requireInventoryApiAccess(request: Request, siteId: string): Promise<InventoryAccess> {
  if (!z.string().uuid().safeParse(siteId).success) return denied("Invalid site", 400)
  const authorization = request.headers.get("authorization")
  if (authorization === null) return requireSiteAccess(request, siteId, { allowLocationScoped: true })
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(authorization)
  const token = match?.[1]
  const claims = token ? jwtClaims(token) : null
  // Decoded claims can only deny here. Supabase Auth must validate the token below.
  if (!token || claims?.role !== "authenticated" || !z.string().uuid().safeParse(claims.sub).success) {
    return denied("Unauthorized", 401)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // Fail closed if a privileged key was mistakenly placed in public configuration.
  if (!url || !key || (!key.startsWith("sb_publishable_") && jwtClaims(key)?.role !== "anon")) {
    return denied("Inventory authentication is unavailable", 503)
  }
  try {
    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user || user.is_anonymous || user.role !== "authenticated" || user.id !== claims.sub) {
      return denied("Unauthorized", 401)
    }
    const role = await lookupCurrentUserSiteRole(supabase, siteId)
    if (!role) return denied("Forbidden", 403)
    return { supabase, role, userId: user.id, userEmail: user.email ?? null }
  } catch (error) {
    if (error instanceof SiteRoleLookupError) return denied(error.message, error.status)
    return denied("Unauthorized", 401)
  }
}