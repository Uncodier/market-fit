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
    
    // Resolve site timezone (default to UTC)
    let timeZone = "UTC";
    const { data: siteRow } = await supabase
      .from("sites")
      .select("timezone")
      .eq("id", siteId)
      .maybeSingle();
    if (siteRow && (siteRow as any).timezone) {
      timeZone = (siteRow as any).timezone as string;
    }
    
    // Calculate previous period for comparison
    const currentStart = new Date(startDate);
    const currentEnd = new Date(endDate);
    const periodLength = currentEnd.getTime() - currentStart.getTime();
    const previousEnd = new Date(currentStart.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - periodLength);

    // Get conversations data for current period
    let conversationsQuery = supabase
      .from("conversations")
      .select("id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (segmentId && segmentId !== "all") {
      conversationsQuery = conversationsQuery.eq("segment_id", segmentId);
    }

    const { data: conversationsData, error: conversationsError } = await conversationsQuery;

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

    const { data: leadsData, error: leadsError } = await leadsQuery;

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

    const { data: engagementData, error: engagementError } = await engagementQuery;

    // Get tasks data for current period
    let tasksQuery = supabase
      .from("tasks")
      .select("id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (segmentId && segmentId !== "all") {
      tasksQuery = tasksQuery.eq("segment_id", segmentId);
    }

    const { data: tasksData, error: tasksError } = await tasksQuery;

    // Get meetings data for current period
    // Include tasks with specific types (call, meeting, website_visit, demo, onboarding) OR stage='consideration'
    let meetingsQuery = supabase
      .from("tasks")
      .select("id, scheduled_date")
      .eq("site_id", siteId)
      .or("type.in.(call,meeting,website_visit,demo,onboarding),stage.eq.consideration")
      .gte("scheduled_date", startDate)
      .lte("scheduled_date", endDate);

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
    }

    const { data: meetingsData, error: meetingsError } = await meetingsQuery;

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

    const { data: salesData, error: salesError } = await salesQuery;

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

    // Helpers to format date in site timezone as YYYY-MM-DD
    const formatDateInTZ = (d: Date) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(d);
      const y = parts.find(p => p.type === "year")?.value ?? "0000";
      const m = parts.find(p => p.type === "month")?.value ?? "01";
      const day = parts.find(p => p.type === "day")?.value ?? "01";
      return `${y}-${m}-${day}`;
    };

    // Group data by day for chart
    const chartData = [];
    const currentDate = new Date(currentStart);
    const endDateObj = new Date(currentEnd);

    while (currentDate <= endDateObj) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Use date string comparison in site timezone for reliable filtering
      const dayStartStr = formatDateInTZ(dayStart);
      const dayEndStr = formatDateInTZ(dayEnd);
      const currentDateStr = formatDateInTZ(currentDate);

      // Filter leads created for this day
      const dayLeads = (leadsData || []).filter(l => {
        const leadDateStr = formatDateInTZ(new Date(l.created_at));
        return leadDateStr >= dayStartStr && leadDateStr <= dayEndStr;
      });

      // Filter conversations for this day
      const dayConversations = conversationsData?.filter(conv => {
        const convDateStr = formatDateInTZ(new Date(conv.created_at));
        return convDateStr >= dayStartStr && convDateStr <= dayEndStr;
      }) || [];

      // Filter engagement (leads in conversation) for this day
      const dayEngagement = engagementData?.filter(lead => {
        // Check if any of the lead's conversations have messages from this day
        return lead.conversations?.some(conv => 
          conv.messages?.some(msg => {
            const msgDateStr = formatDateInTZ(new Date(msg.created_at));
            return msgDateStr >= dayStartStr && msgDateStr <= dayEndStr;
          })
        );
      }) || [];

      // Filter tasks for this day
      const dayTasks = tasksData?.filter(task => {
        const taskDateStr = formatDateInTZ(new Date(task.created_at));
        return taskDateStr >= dayStartStr && taskDateStr <= dayEndStr;
      }) || [];

      // Filter meetings for this day (using scheduled_date)
      const dayMeetings = meetingsData?.filter(meeting => {
        const meetingDateStr = formatDateInTZ(new Date(meeting.scheduled_date));
        return meetingDateStr >= dayStartStr && meetingDateStr <= dayEndStr;
      }) || [];

      // Filter sales for this day
      const daySales = salesData?.filter(sale => {
        const saleDateStr = formatDateInTZ(new Date(sale.created_at));
        return saleDateStr >= dayStartStr && saleDateStr <= dayEndStr;
      }) || [];

      chartData.push({
        date: currentDateStr,
        leadsCreated: dayLeads.length,
        conversations: dayConversations.length,
        engagement: dayEngagement.length,
        tasks: dayTasks.length,
        meetings: dayMeetings.length,
        sales: daySales.length
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate totals for comparison
    const totalLeadsCreated = leadsData?.length || 0;
    const totalConversations = conversationsData?.length || 0;
    const totalEngagement = engagementData?.length || 0;
    const totalTasks = tasksData?.length || 0;
    const totalMeetings = meetingsData?.length || 0;
    const totalSales = salesData?.length || 0;

    // Get previous period data for comparison
    const { data: prevLeadsData } = await supabase
      .from("leads")
      .select("id")
      .eq("site_id", siteId)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

    const { data: prevConversationsData } = await supabase
      .from("conversations")
      .select("id")
      .eq("site_id", siteId)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

    const { data: prevEngagementData } = await supabase
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

    const { data: prevTasksData } = await supabase
      .from("tasks")
      .select("id")
      .eq("site_id", siteId)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

    // Get previous period meetings data
    // Include tasks with specific types (call, meeting, website_visit, demo, onboarding) OR stage='consideration'
    let prevMeetingsQuery = supabase
      .from("tasks")
      .select("id")
      .eq("site_id", siteId)
      .or("type.in.(call,meeting,website_visit,demo,onboarding),stage.eq.consideration")
      .gte("scheduled_date", previousStart.toISOString())
      .lte("scheduled_date", previousEnd.toISOString());

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
    }

    const { data: prevMeetingsData } = await prevMeetingsQuery;

    const { data: prevSalesData } = await supabase
      .from("sales")
      .select("id")
      .eq("site_id", siteId)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

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
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly",
      chartData: [],
      breakdown: {
        leadsCreated: 0,
        conversations: 0,
        engagement: 0,
        tasks: 0,
        meetings: 0,
        sales: 0
      }
    });
  }
}
