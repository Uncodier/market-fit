import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const segmentId = searchParams.get("segmentId");

  if (!siteId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  try {
    const supabase = await createServiceClient();

    const currentStart = new Date(startDate);
    const currentEnd = new Date(endDate);
    const periodLength = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - periodLength);

    let currentQuery = supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .gte("created_at", currentStart.toISOString())
      .lte("created_at", currentEnd.toISOString());

    if (segmentId && segmentId !== "all") {
      currentQuery = currentQuery.eq("segment_id", segmentId);
    }

    const { count: currentCount, error: currentError } = await currentQuery;

    if (currentError) {
      console.error("Error fetching current sales:", currentError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly",
      });
    }

    let previousQuery = supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

    if (segmentId && segmentId !== "all") {
      previousQuery = previousQuery.eq("segment_id", segmentId);
    }

    const { count: previousCount, error: previousError } = await previousQuery;

    if (previousError) {
      console.error("Error fetching previous sales:", previousError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly",
      });
    }

    const actual = currentCount || 0;
    const previous = previousCount || 0;
    const percentChange =
      previous > 0 ? ((actual - previous) / previous) * 100 : actual > 0 ? 100 : 0;

    return NextResponse.json({
      actual,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly",
    });
  } catch (error) {
    console.error("Error in performance sales API:", error);
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly",
    });
  }
}
