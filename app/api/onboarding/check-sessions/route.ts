import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");

  if (!siteId) {
    return NextResponse.json({ error: "Missing siteId parameter" }, { status: 400 });
  }

  // Validate that siteId is a valid UUID to prevent Postgres errors
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(siteId)) {
    return NextResponse.json({ hasSessions: false, error: "Invalid siteId parameter" }, { status: 400 });
  }

  const supabase = await createServiceClient(); // Use service client to bypass RLS

  try {
    const { data: visitorSessions, error } = await supabase
      .from('visitor_sessions')
      .select('id')
      .eq('site_id', siteId)
      .limit(1);

    if (error) {
      console.error("Error checking visitor sessions:", error);
      return NextResponse.json({ hasSessions: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ hasSessions: (visitorSessions?.length || 0) > 0 });
  } catch (error) {
    console.error("Unexpected error checking visitor sessions:", error);
    return NextResponse.json({ hasSessions: false, error: "An unexpected error occurred" }, { status: 500 });
  }
}

