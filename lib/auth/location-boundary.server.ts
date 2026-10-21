import "server-only"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { readLocationRestrictionState } from "@/lib/permissions/location-boundary"

/** Private unscoped service/proxy boundary, not a replacement for resource ACLs. */
export async function requireUnrestrictedLocationAccess() {
  try {
    const supabase = await createClient(true)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user || user.is_anonymous) {
      return { error: denial("Unauthorized", 401) } as const
    }
    const restricted = await readLocationRestrictionState(supabase)
    if (restricted !== false) {
      return { error: denial("This operation requires unrestricted location access", 403) } as const
    }
    return { supabase, user } as const
  } catch {
    return { error: denial("Location authorization could not be verified", 403) } as const
  }
}

function denial(error: string, status: number) {
  return NextResponse.json({ error }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  })
}