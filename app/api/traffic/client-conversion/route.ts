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
      
      let allLeads: any[] = [];
      let hasMoreLeads = true;
      let fromLeads = 0;
      const stepLeads = 1000;
  
      while (hasMoreLeads) {
        let leadsQuery = supabase
          .from('leads')
          .select('id, created_at')
          .eq('site_id', siteId)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .range(fromLeads, fromLeads + stepLeads - 1);
  
        if (segmentId && segmentId !== 'all') {
          leadsQuery = leadsQuery.eq('segment_id', segmentId);
        }
  
        const { data: batchLeads, error: leadsError } = await leadsQuery;
  
        if (leadsError) {
          console.error('[ClientConversion API] Error fetching leads:', leadsError);
          return NextResponse.json({
            actual: 0,
            percentChange: 0,
            periodType: "monthly"
          });
        }
  
        if (batchLeads && batchLeads.length > 0) {
          allLeads = [...allLeads, ...batchLeads];
          fromLeads += stepLeads;
          if (batchLeads.length < stepLeads) {
            hasMoreLeads = false;
          }
        } else {
          hasMoreLeads = false;
        }
      }
  
      const totalLeads = allLeads.length;
      console.log(`[ClientConversion API] Found ${totalLeads} total leads`);

    if (totalLeads === 0) {
      return NextResponse.json({
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      });
    }

    // Get leads that have at least one sale (invoice)
    const leadIds = allLeads.map(lead => lead.id) || [];
    
    // Process sales in chunks of 500 to avoid overly large IN clauses
    const CHUNK_SIZE = 500;
    let leadsWithSales: any[] = [];
    
    for (let i = 0; i < leadIds.length; i += CHUNK_SIZE) {
      const chunk = leadIds.slice(i, i + CHUNK_SIZE);
      
      const { data: chunkSales, error: salesError } = await supabase
        .from('sales')
        .select('lead_id')
        .in('lead_id', chunk)
        .not('lead_id', 'is', null);

      if (salesError) {
        console.error('[ClientConversion API] Error fetching sales:', salesError);
        return NextResponse.json({
          actual: 0,
          percentChange: 0,
          periodType: "monthly"
        });
      }
      
      if (chunkSales) {
        leadsWithSales = [...leadsWithSales, ...chunkSales];
      }
    }

    // Count unique leads that have at least one sale
    const uniqueLeadsWithSales = new Set(leadsWithSales.map(sale => sale.lead_id)).size;
    
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
    let prevLeads: any[] = [];
    let hasMorePrevLeads = true;
    let fromPrevLeads = 0;
    const stepPrevLeads = 1000;

    while (hasMorePrevLeads) {
      let prevLeadsQuery = supabase
        .from('leads')
        .select('id, created_at')
        .eq('site_id', siteId)
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString())
        .range(fromPrevLeads, fromPrevLeads + stepPrevLeads - 1);

      if (segmentId && segmentId !== 'all') {
        prevLeadsQuery = prevLeadsQuery.eq('segment_id', segmentId);
      }

      const { data: batchPrevLeads, error: prevLeadsError } = await prevLeadsQuery;
      
      if (prevLeadsError) {
        break;
      }

      if (batchPrevLeads && batchPrevLeads.length > 0) {
        prevLeads = [...prevLeads, ...batchPrevLeads];
        fromPrevLeads += stepPrevLeads;
        if (batchPrevLeads.length < stepPrevLeads) {
          hasMorePrevLeads = false;
        }
      } else {
        hasMorePrevLeads = false;
      }
    }
    
    const prevTotalLeads = prevLeads.length;
    let previousConversionRate = 0;

    if (prevTotalLeads > 0) {
      const prevLeadIds = prevLeads.map(lead => lead.id) || [];
      
      const CHUNK_SIZE = 500;
      let prevLeadsWithSales: any[] = [];
      
      for (let i = 0; i < prevLeadIds.length; i += CHUNK_SIZE) {
        const chunk = prevLeadIds.slice(i, i + CHUNK_SIZE);
        
        const { data: chunkSales } = await supabase
          .from('sales')
          .select('lead_id')
          .in('lead_id', chunk)
          .not('lead_id', 'is', null);
          
        if (chunkSales) {
          prevLeadsWithSales = [...prevLeadsWithSales, ...chunkSales];
        }
      }

      const prevUniqueLeadsWithSales = new Set(prevLeadsWithSales.map(sale => sale.lead_id)).size;
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