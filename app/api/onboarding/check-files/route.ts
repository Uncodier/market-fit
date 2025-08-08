import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");

  if (!siteId) {
    return NextResponse.json({ error: "Missing siteId parameter" }, { status: 400 });
  }

  const supabase = await createServiceClient(); // Use service client to bypass RLS

  try {
    // Check if any assets exist for this site (assets table is used for files)
    const { data: assets, error } = await supabase
      .from('assets')
      .select('id')
      .eq('site_id', siteId)
      .limit(1);

    if (error) {
      console.error("Error checking assets:", error);
      return NextResponse.json({ hasFiles: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ hasFiles: (assets?.length || 0) > 0 });
  } catch (error) {
    console.error("Unexpected error checking assets:", error);
    return NextResponse.json({ hasFiles: false, error: "An unexpected error occurred" }, { status: 500 });
  }
}

