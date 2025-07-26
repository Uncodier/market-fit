import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get("siteId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const segmentId = searchParams.get("segmentId");

  if (!siteId) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Start date and end date are required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  try {
    console.log(`[ClientConversion API] Calculating conversion for site: ${siteId}, segment: ${segmentId || 'all'}, dates: ${startDate} to ${endDate}`);
    
    // Get all leads from the period
    let leadsQuery = supabase
      .from('leads')
      .select('id, created_at')
      .eq('site_id', siteId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (segmentId && segmentId !== 'all') {
      leadsQuery = leadsQuery.eq('segment_id', segmentId);
    }

    const { data: allLeads, error: leadsError } = await leadsQuery;

    if (leadsError) {
      console.error('[ClientConversion API] Error fetching leads:', leadsError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    const totalLeads = allLeads?.length || 0;
    console.log(`[ClientConversion API] Found ${totalLeads} total leads`);

    if (totalLeads === 0) {
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    // Get leads that have at least one sale (invoice)
    const leadIds = allLeads?.map(lead => lead.id) || [];
    
    const { data: leadsWithSales, error: salesError } = await supabase
      .from('sales')
      .select('lead_id')
      .in('lead_id', leadIds)
      .not('lead_id', 'is', null);

    if (salesError) {
      console.error('[ClientConversion API] Error fetching sales:', salesError);
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    // Count unique leads that have at least one sale
    const uniqueLeadsWithSales = new Set(leadsWithSales?.map(sale => sale.lead_id) || []).size;
    
    // Calculate conversion rate
    const currentConversionRate = totalLeads > 0 ? (uniqueLeadsWithSales / totalLeads) * 100 : 0;
    
    console.log(`[ClientConversion API] ${uniqueLeadsWithSales} leads with sales out of ${totalLeads} total leads. Rate: ${currentConversionRate.toFixed(2)}%`);

    // Calculate previous period for comparison
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const periodLength = endDateObj.getTime() - startDateObj.getTime();
    const previousStart = new Date(startDateObj.getTime() - periodLength);
    const previousEnd = new Date(startDateObj.getTime());

    console.log(`[ClientConversion API] Previous period: ${previousStart.toISOString()} to ${previousEnd.toISOString()}`);

    // Get previous period leads
    let prevLeadsQuery = supabase
      .from('leads')
      .select('id, created_at')
      .eq('site_id', siteId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString());

    if (segmentId && segmentId !== 'all') {
      prevLeadsQuery = prevLeadsQuery.eq('segment_id', segmentId);
    }

    const { data: prevLeads, error: prevLeadsError } = await prevLeadsQuery;
    
    const prevTotalLeads = prevLeads?.length || 0;
    let previousConversionRate = 0;

    if (prevTotalLeads > 0) {
      const prevLeadIds = prevLeads?.map(lead => lead.id) || [];
      
      const { data: prevLeadsWithSales } = await supabase
        .from('sales')
        .select('lead_id')
        .in('lead_id', prevLeadIds)
        .not('lead_id', 'is', null);

      const prevUniqueLeadsWithSales = new Set(prevLeadsWithSales?.map(sale => sale.lead_id) || []).size;
      previousConversionRate = (prevUniqueLeadsWithSales / prevTotalLeads) * 100;
    }
    
    // Calculate percentage change
    let percentChange = 0;
    if (previousConversionRate > 0) {
      // Normal calculation when there's previous data
      percentChange = ((currentConversionRate - previousConversionRate) / previousConversionRate) * 100;
    } else if (currentConversionRate > 0) {
      // If no previous data but current data exists, show 100% growth
      percentChange = 100;
    }
    // If both are 0, percentChange remains 0

    const response = {
      actual: Math.round(currentConversionRate * 10) / 10, // Round to 1 decimal
      percentChange: Math.round(percentChange * 10) / 10,
      periodType: "monthly"
    };

    console.log(`[ClientConversion API] Returning data:`, response);
    return NextResponse.json(response);

  } catch (error) {
    console.error("Error fetching client conversion data:", error);
    
    return NextResponse.json({
      actual: 0,
      percentChange: 0,
      periodType: "monthly"
    });
  }
} 