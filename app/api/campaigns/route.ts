import { NextResponse, NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const siteId = url.searchParams.get("siteId")

    console.log("API Campaigns: Received request for siteId:", siteId)

    if (!siteId) {
      return NextResponse.json({ error: "siteId is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from("campaigns")
      .select("id, title, description")
      .eq("site_id", siteId)
      .order("title")

    if (error) {
      console.error("Error fetching campaigns:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`API Campaigns: Found ${data?.length || 0} campaigns for site ${siteId}`)
    
    // Mostrar un ejemplo de la primera campaña si existe
    if (data && data.length > 0) {
      console.log("First campaign example:", {
        id: data[0].id,
        title: data[0].title
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in campaigns API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 