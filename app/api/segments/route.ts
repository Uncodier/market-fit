import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("siteId")

    if (!siteId) {
      return NextResponse.json(
        { error: "Site ID is required" },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    const { data, error } = await supabase
      .from("segments")
      .select("id, name, description")
      .eq("site_id", siteId)
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching segments:", error)
      return NextResponse.json(
        { error: "Failed to fetch segments" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Unexpected error in segments API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 