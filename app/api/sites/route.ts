import { NextResponse } from "next/server"
import { createServiceSupabase, createUserSupabase } from "@/lib/auth/site-member-request"
import { listAccessibleSitesForUser } from "@/lib/sites/list-accessible-sites"

export async function GET() {
  try {
    const supabase = await createUserSupabase()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    const { sites, error } = await listAccessibleSitesForUser(createServiceSupabase(), user.id)
    if (error) {
      return NextResponse.json({ success: false, error }, { status: 500 })
    }

    return NextResponse.json({ success: true, sites })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sites"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
