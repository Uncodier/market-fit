import type { QueryResult } from '../_shared/query-result';
import type { LeadIdRow, AmountRow } from '../_shared/marketing-query-types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { findOrCreateKpi, calculateTrend } from './kpi';

type ComparisonInput = {
  supabase: SupabaseClient;
  siteId: string;
  userId: string | null;
  segmentId: string | null;
  skipKpiCreation: boolean;
  standardizedStart: Date;
  standardizedEnd: Date;
  standardizedPrevStart: Date;
  standardizedPrevEnd: Date;
  hasRealData: boolean;
  ltvValue: number;
};

export async function comparePreviousPeriod({
  supabase, siteId, userId, segmentId, skipKpiCreation, standardizedStart, standardizedEnd, standardizedPrevStart, standardizedPrevEnd, hasRealData, ltvValue
}: ComparisonInput) {
  // Get previous period LTV for comparison
  let previousValue = 0;
  let percentChange = 0;
  
  // Create a Supabase admin client for writing to the KPIs table
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  if (userId && !skipKpiCreation && hasRealData) {
    // First try to find existing KPI for previous period
    const { kpi: prevKpi } = await findOrCreateKpi(
      supabase,
      supabaseAdmin,
      {
        siteId,
        userId,
        segmentId: segmentId !== 'all' ? segmentId : null,
        periodStart: standardizedPrevStart,
        periodEnd: standardizedPrevEnd,
        type: "ltv",
        name: "Customer Lifetime Value",
        value: 0, // Will be updated if needed
        previousValue: undefined
      }
    );
    
    if (prevKpi) {
      // If we found an existing KPI, use its value
      previousValue = prevKpi.value;
      console.log(`[LTV API] Found previous KPI with value: $${previousValue}`);
    } else {
      // Calculate previous period LTV
      let prevPurchaseTasksQuery = supabase
        .from('tasks')
        .select('id, amount, lead_id')
        .eq('site_id', siteId)
        .eq('stage', 'purchase')
        .eq('status', 'completed')
        .gte('created_at', standardizedPrevStart.toISOString())
        .lte('created_at', standardizedPrevEnd.toISOString());
      
      // If segmentId is provided and not 'all', we need to filter tasks by leads with that segment
      if (segmentId && segmentId !== 'all') {
        // First, get all leads with the specified segment
        const { data: prevSegmentLeads }: QueryResult<LeadIdRow[]> = await supabase
          .from('leads')
          .select('id')
          .eq('site_id', siteId)
          .eq('segment_id', segmentId);
        
        if (prevSegmentLeads && prevSegmentLeads.length > 0) {
          // Get the lead IDs to filter tasks
          const leadIds = prevSegmentLeads.map(lead => lead.id);
          // Filter tasks by these lead IDs
          prevPurchaseTasksQuery = prevPurchaseTasksQuery.in('lead_id', leadIds);
        }
      }
      
      const { data: prevPurchaseTasks }: QueryResult<(AmountRow & { lead_id: string | null })[]> = await prevPurchaseTasksQuery;
      
      let prevLeadsQuery = supabase
        .from('leads')
        .select('id')
        .eq('site_id', siteId)
        .eq('status', 'converted')
        .gte('created_at', standardizedPrevStart.toISOString())
        .lte('created_at', standardizedPrevEnd.toISOString());
      
      // If segmentId is provided, filter by segment
      if (segmentId && segmentId !== 'all') {
        prevLeadsQuery = prevLeadsQuery.eq('segment_id', segmentId);
      }
      
      const { data: prevConvertedLeads }: QueryResult<LeadIdRow[]> = await prevLeadsQuery;
      
      if (prevPurchaseTasks && prevPurchaseTasks.length > 0 && 
          prevConvertedLeads && prevConvertedLeads.length > 0) {
        // Calculate previous LTV
        const prevTotalAmount = prevPurchaseTasks.reduce((sum, task) => sum + (task.amount || 0), 0);
        previousValue = Math.round(prevTotalAmount / prevConvertedLeads.length);
      }
      
      // Store the previous period LTV
      if (hasRealData) {
        await findOrCreateKpi(
          supabase,
          supabaseAdmin,
          {
            siteId,
            userId,
            segmentId: segmentId !== 'all' ? segmentId : null,
            periodStart: standardizedPrevStart,
            periodEnd: standardizedPrevEnd,
            type: "ltv",
            name: "Customer Lifetime Value",
            value: previousValue,
            previousValue: undefined
          }
        );
      }
    }
    
    // Create or update the current period KPI
    if (hasRealData) {
      const { kpi: currentKpi } = await findOrCreateKpi(
        supabase,
        supabaseAdmin,
        {
          siteId,
          userId,
          segmentId: segmentId !== 'all' ? segmentId : null,
          periodStart: standardizedStart,
          periodEnd: standardizedEnd,
          type: "ltv",
          name: "Customer Lifetime Value",
          value: ltvValue,
          previousValue
        }
      );
      
      if (currentKpi) {
        // Use the stored trend value if available
        percentChange = currentKpi.trend;
      } else {
        // Calculate trend if KPI creation failed
        percentChange = calculateTrend(ltvValue, previousValue);
      }
    }
  }
  return { previousValue, percentChange };
}
