import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access";
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache";

import { buildPerformanceSeries } from "@/lib/dashboard/performance-series"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const segmentId = searchParams.get("segmentId");

  if (!siteId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  const access = await requireAnalyticsAccess(request);
  if (access.error) return access.error;

  return readThroughAnalyticsResponseCache({
    request,
    namespace: "performance:metrics-overview:v4",
    siteId: access.siteId,
    load: async () => {
  try {
    const supabase = await createServiceClient();
    
    // Match the batch's UTC calendar boundaries. The sites table has no timezone
    // column; business-hours settings are not a reporting timezone contract.
    const timeZone = "UTC";
    
    // Calculate previous period for comparison
    const currentStart = new Date(startDate);
    const currentEnd = new Date(endDate);
    const periodLength = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - periodLength);

    // Get conversations data for current period
    let conversationsQuery = supabase
      .from("conversations")
      .select(segmentId && segmentId !== "all" ? "id, created_at, leads!inner(segment_id)" : "id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (segmentId && segmentId !== "all") {
      conversationsQuery = conversationsQuery.eq("leads.segment_id", segmentId);
    }

    // Get leads created for current period
    let leadsQuery = supabase
      .from("leads")
      .select("id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (segmentId && segmentId !== "all") {
      leadsQuery = leadsQuery.eq("segment_id", segmentId);
    }

    // Get leads in conversation (engagement) data for current period
    let engagementQuery = supabase
      .from("leads")
      .select(`
        id,
        conversations!inner(
          id,
          messages!inner(
            id,
            created_at,
            role
          )
        )
      `)
      .eq("site_id", siteId)
      .eq("conversations.messages.role", "user")
      .gte("conversations.messages.created_at", startDate)
      .lte("conversations.messages.created_at", endDate);

    if (segmentId && segmentId !== "all") {
      engagementQuery = engagementQuery.eq("segment_id", segmentId);
    }

    // Get tasks data for current period
    let tasksQuery = supabase
      .from("tasks")
      .select(segmentId && segmentId !== "all" ? "id, created_at, leads!inner(segment_id)" : "id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (segmentId && segmentId !== "all") {
      tasksQuery = tasksQuery.eq("leads.segment_id", segmentId);
    }

    // Get meetings data for current period
    // Include tasks with specific types (call, meeting, website_visit, demo, onboarding) OR stage='consideration'
    let meetingsQuery;
    if (segmentId && segmentId !== "all") {
      // Join with leads to filter by segment
      meetingsQuery = supabase
        .from("tasks")
        .select(`
          id,
          scheduled_date,
          leads!inner(
            segment_id
          )
        `)
        .eq("site_id", siteId)
        .or("type.in.(call,meeting,website_visit,demo,onboarding),stage.eq.consideration")
        .eq("leads.segment_id", segmentId)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate);
    } else {
      meetingsQuery = supabase
        .from("tasks")
        .select("id, scheduled_date")
        .eq("site_id", siteId)
        .or("type.in.(call,meeting,website_visit,demo,onboarding),stage.eq.consideration")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate);
    }

    // Get sales data for current period
    let salesQuery = supabase
      .from("sales")
      .select("id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (segmentId && segmentId !== "all") {
      salesQuery = salesQuery.eq("segment_id", segmentId);
    }

    const [
      { data: conversationsData, error: conversationsError },
      { data: leadsData, error: leadsError },
      { data: engagementData, error: engagementError },
      { data: tasksData, error: tasksError },
      { data: meetingsData, error: meetingsError },
      { data: salesData, error: salesError },
    ] = await Promise.all([conversationsQuery, leadsQuery, engagementQuery, tasksQuery, meetingsQuery, salesQuery]);

    // Handle errors
    if (conversationsError) {
      console.error("Error fetching conversations:", conversationsError);
    }
    if (leadsError) {
      console.error("Error fetching leads created:", leadsError);
    }
    if (engagementError) {
      console.error("Error fetching engagement:", engagementError);
    }
    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
    }
    if (meetingsError) {
      console.error("Error fetching meetings:", meetingsError);
    }
    if (salesError) {
      console.error("Error fetching sales:", salesError);
    }
    if (conversationsError || leadsError || engagementError || tasksError || meetingsError || salesError) {
      return NextResponse.json({ error: "Failed to load metrics overview" }, { status: 500 });
    }

    const chartData = buildPerformanceSeries({
      start: currentStart, end: currentEnd, timeZone,
      leads: leadsData || [], conversations: conversationsData || [],
      engagement: engagementData || [], tasks: tasksData || [],
      meetings: meetingsData || [], sales: salesData || [],
    });

    // Calculate totals for comparison
    const totalLeadsCreated = leadsData?.length || 0;
    const totalConversations = conversationsData?.length || 0;
    const totalEngagement = engagementData?.length || 0;
    const totalTasks = tasksData?.length || 0;
    const totalMeetings = meetingsData?.length || 0;
    const totalSales = salesData?.length || 0;

    // Get previous period data for comparison
    let prevLeadsQuery = supabase
      .from("leads")
      .select("id")
      .eq("site_id", siteId)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());
    if (segmentId && segmentId !== "all") prevLeadsQuery = prevLeadsQuery.eq("segment_id", segmentId);

    let prevConversationsQuery = supabase
      .from("conversations")
      .select(segmentId && segmentId !== "all" ? "id, leads!inner(segment_id)" : "id")
      .eq("site_id", siteId)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());
    if (segmentId && segmentId !== "all") prevConversationsQuery = prevConversationsQuery.eq("leads.segment_id", segmentId);

    let prevEngagementQuery = supabase
      .from("leads")
      .select(`
        id,
        conversations!inner(
          id,
          messages!inner(
            id,
            created_at,
            role
          )
        )
      `)
      .eq("site_id", siteId)
      .eq("conversations.messages.role", "user")
      .gte("conversations.messages.created_at", previousStart.toISOString())
      .lte("conversations.messages.created_at", previousEnd.toISOString());
    if (segmentId && segmentId !== "all") prevEngagementQuery = prevEngagementQuery.eq("segment_id", segmentId);

    let prevTasksQuery = supabase
      .from("tasks")
      .select(segmentId && segmentId !== "all" ? "id, leads!inner(segment_id)" : "id")
      .eq("site_id", siteId)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());
    if (segmentId && segmentId !== "all") prevTasksQuery = prevTasksQuery.eq("leads.segment_id", segmentId);

    // Get previous period meetings data
    // Include tasks with specific types (call, meeting, website_visit, demo, onboarding) OR stage='consideration'
    let prevMeetingsQuery;
    if (segmentId && segmentId !== "all") {
      // Join with leads to filter by segment
      prevMeetingsQuery = supabase
        .from("tasks")
        .select(`
          id,
          leads!inner(
            segment_id
          )
        `)
        .eq("site_id", siteId)
        .or("type.in.(call,meeting,website_visit,demo,onboarding),stage.eq.consideration")
        .eq("leads.segment_id", segmentId)
        .gte("scheduled_date", previousStart.toISOString())
        .lte("scheduled_date", previousEnd.toISOString());
    } else {
      prevMeetingsQuery = supabase
        .from("tasks")
        .select("id")
        .eq("site_id", siteId)
        .or("type.in.(call,meeting,website_visit,demo,onboarding),stage.eq.consideration")
        .gte("scheduled_date", previousStart.toISOString())
        .lte("scheduled_date", previousEnd.toISOString());
    }


    let prevSalesQuery = supabase
      .from("sales")
      .select("id")
      .eq("site_id", siteId)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());
    if (segmentId && segmentId !== "all") prevSalesQuery = prevSalesQuery.eq("segment_id", segmentId);
    const [
      { data: prevLeadsData, error: prevLeadsError },
      { data: prevConversationsData, error: prevConversationsError },
      { data: prevEngagementData, error: prevEngagementError },
      { data: prevTasksData, error: prevTasksError },
      { data: prevMeetingsData, error: prevMeetingsError },
      { data: prevSalesData, error: prevSalesError },
    ] = await Promise.all([prevLeadsQuery, prevConversationsQuery, prevEngagementQuery, prevTasksQuery, prevMeetingsQuery, prevSalesQuery]);

    if (prevLeadsError || prevConversationsError || prevEngagementError || prevTasksError || prevMeetingsError || prevSalesError) {
      return NextResponse.json({ error: "Failed to load metrics overview" }, { status: 500 });
    }

    const prevTotalLeadsCreated = prevLeadsData?.length || 0;
    const prevTotalConversations = prevConversationsData?.length || 0;
    const prevTotalEngagement = prevEngagementData?.length || 0;
    const prevTotalTasks = prevTasksData?.length || 0;
    const prevTotalMeetings = prevMeetingsData?.length || 0;
    const prevTotalSales = prevSalesData?.length || 0;

    // Calculate overall percentage change (average of all metrics)
    const totalCurrent = totalLeadsCreated + totalConversations + totalEngagement + totalTasks + totalMeetings + totalSales;
    const totalPrevious = prevTotalLeadsCreated + prevTotalConversations + prevTotalEngagement + prevTotalTasks + prevTotalMeetings + prevTotalSales;
    
    const percentChange = totalPrevious > 0 
      ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 
      : totalCurrent > 0 ? 100 : 0;

    return NextResponse.json({
      actual: totalCurrent,
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly",
      chartData,
      breakdown: {
        leadsCreated: totalLeadsCreated,
        conversations: totalConversations,
        engagement: totalEngagement,
        tasks: totalTasks,
        meetings: totalMeetings,
        sales: totalSales
      }
    });

  } catch (error) {
    console.error("Error in metrics overview API:", error);
    return NextResponse.json({ error: "Failed to load metrics overview" }, { status: 500 });
  }
    },
  });
}
