import { NextResponse, NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const siteId = url.searchParams.get("siteId")

    if (!siteId) {
      return NextResponse.json({ error: "siteId is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("requirements")
      .select("id, title, description")
      .eq("site_id", siteId)
      .order("title")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in requirements API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 