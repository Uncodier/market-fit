import type { QueryResult } from '../_shared/query-result';
import type { CampaignBudgetRow, SaleRow, AmountRow } from '../_shared/marketing-query-types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { findOrCreateKpi, calculateTrend } from './kpi';

type ComparisonInput = {
  supabase: SupabaseClient;
  siteId: string;
  userId: string | null;
  segmentId: string | null;
  skipKpiCreation: boolean;
  periodStart: Date;
  periodEnd: Date;
  prevPeriodStart: Date;
  prevPeriodEnd: Date;
  roiValue: number;
};

export async function comparePreviousPeriod({
  supabase, siteId, userId, segmentId, skipKpiCreation, periodStart, periodEnd, prevPeriodStart, prevPeriodEnd, roiValue
}: ComparisonInput) {
  // Get previous period ROI for comparison
  let previousValue = 0;
  let percentChange = 0;
  
  // Create a Supabase admin client for writing to the KPIs table
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  console.log(`[ROI API] userId: ${userId}, skipKpiCreation: ${skipKpiCreation}`);
  
  // Always calculate the previous period properly, don't depend on userId for comparison
  let foundPreviousKpi = false;
  if (userId && !skipKpiCreation) {
    // First try to find existing KPI for previous period
    const { kpi: prevKpi } = await findOrCreateKpi(
      supabase,
      supabaseAdmin,
      {
        siteId,
        userId,
        segmentId: segmentId !== 'all' ? segmentId : null,
        periodStart: prevPeriodStart,
        periodEnd: prevPeriodEnd,
        type: "roi",
        name: "Return on Investment",
        value: 0, // Will be updated if needed
        previousValue: undefined
      }
    );
    
    if (prevKpi) {
      // If we found an existing KPI, use its value
      previousValue = prevKpi.value;
      foundPreviousKpi = true;
      console.log(`[ROI API] Found previous KPI with value: ${previousValue}%`);
    }
  }
  
  // If no previous KPI found or no userId, calculate from scratch
  if (!foundPreviousKpi) {
    console.log(`[ROI API] 🔄 Calculating previous period ROI from scratch...`);
    console.log(`[ROI API] Previous period range: ${prevPeriodStart.toISOString()} to ${prevPeriodEnd.toISOString()}`);
      // Calculate previous period ROI
      let prevCampaignQuery = supabase
        .from('campaigns')
        .select('id, budget, metadata')
        .eq('site_id', siteId)
        .gte('created_at', prevPeriodStart.toISOString())
        .lte('created_at', prevPeriodEnd.toISOString());
      
      // If segmentId is provided, filter by segment
      if (segmentId && segmentId !== 'all') {
        prevCampaignQuery = prevCampaignQuery.eq('segment_id', segmentId);
      }
      
      const { data: prevCampaigns }: QueryResult<CampaignBudgetRow[]> = await prevCampaignQuery;
      
      // Get previous period sales
      // Try sale_date first, then fallback to created_at
      const prevSaleDateStart = format(prevPeriodStart, 'yyyy-MM-dd');
      const prevSaleDateEnd = format(prevPeriodEnd, 'yyyy-MM-dd');
      
      // First try with sale_date
      let prevSalesQuerySaleDate = supabase
        .from('sales')
        .select('id, amount, created_at, status, sale_date')
        .eq('site_id', siteId)
        .gte('sale_date', prevSaleDateStart)
        .lte('sale_date', prevSaleDateEnd);
      
      // If segmentId is provided, filter by segment
      if (segmentId && segmentId !== 'all') {
        prevSalesQuerySaleDate = prevSalesQuerySaleDate.eq('segment_id', segmentId);
      }
      
      const { data: prevSalesSaleDate, error: prevSalesErrorSaleDate }: QueryResult<Omit<SaleRow, 'lead_id'>[]> = await prevSalesQuerySaleDate;
      
      // If sale_date query fails or returns no data, fallback to created_at
      let prevSales = prevSalesSaleDate;
      let prevSalesError = prevSalesErrorSaleDate;
      
      if (prevSalesErrorSaleDate || !prevSalesSaleDate || prevSalesSaleDate.length === 0) {
        console.log('[ROI API] Using created_at fallback for previous period sales query');
        
        let prevSalesQuery = supabase
          .from('sales')
          .select('id, amount, created_at, status, sale_date')
          .eq('site_id', siteId)
          .gte('created_at', prevPeriodStart.toISOString())
          .lte('created_at', prevPeriodEnd.toISOString());
        
        // If segmentId is provided, filter by segment
        if (segmentId && segmentId !== 'all') {
          prevSalesQuery = prevSalesQuery.eq('segment_id', segmentId);
        }
        
        const result: QueryResult<Omit<SaleRow, 'lead_id'>[]> = await prevSalesQuery;
        prevSales = result.data;
        prevSalesError = result.error;
      } else {
        console.log('[ROI API] Using sale_date for previous period sales query');
      }
      
      if (prevSalesError) {
        console.error('[ROI API] Error fetching previous sales:', prevSalesError);
      } else {
        console.log(`[ROI API] Found ${prevSales?.length || 0} sales for previous period ${prevPeriodStart.toISOString()} to ${prevPeriodEnd.toISOString()}`);
        if (prevSales && prevSales.length > 0) {
          console.log('[ROI API] First previous sale example:', JSON.stringify(prevSales[0]));
        }
      }
      
      // Calculate previous period costs and revenue - only for paid campaigns
      const prevTotalCampaignBudget = prevCampaigns?.reduce((sum, campaign) => {
        // Only count budget if campaign is marked as paid in metadata
        const isPaid = campaign.metadata?.payment_status?.status === 'paid';
        if (!isPaid) {
          console.log(`[ROI API] Skipping previous non-paid campaign budget (Campaign: ${campaign.id})`);
          return sum;
        }
        
        // Access the allocated property from the budget object
        const budgetAmount = campaign.budget?.allocated || 0;
        console.log(`[ROI API] Including previous paid campaign budget: $${budgetAmount} (Campaign: ${campaign.id})`);
        return sum + budgetAmount;
      }, 0) || 0;
      
      const prevTotalRevenue = prevSales?.reduce((sum, sale) => {
        const amount = parseFloat(sale.amount?.toString() || '0');
        return sum + amount;
      }, 0) || 0;
      
      console.log(`[ROI API] Previous total revenue: ${prevTotalRevenue}, from ${prevSales?.length || 0} sales`);
      
      // Get previous period transactions for alternative calculation
      let prevTransQuery = supabase
        .from('transactions')
        .select('id, amount, created_at, type')
        .eq('site_id', siteId)
        .gte('created_at', prevPeriodStart.toISOString())
        .lte('created_at', prevPeriodEnd.toISOString());
      
      // If segmentId is provided, filter by segment
      if (segmentId && segmentId !== 'all') {
        prevTransQuery = prevTransQuery.eq('segment_id', segmentId);
      }
      
      const { data: prevTransData, error: prevTransError }: QueryResult<(AmountRow & { created_at: string; type: string })[]> = await prevTransQuery;
      
      if (prevTransError) {
        console.error('[ROI API] Error fetching previous transactions:', prevTransError);
      } else {
        console.log(`[ROI API] Found ${prevTransData?.length || 0} transactions for previous period ${prevPeriodStart.toISOString()} to ${prevPeriodEnd.toISOString()}`);
        if (prevTransData && prevTransData.length > 0) {
          console.log('[ROI API] First previous transaction example:', JSON.stringify(prevTransData[0]));
        }
      }
      
      // Calculate previous ROI
      let prevTotalTransactions = 0;
      
      if (prevTransData && prevTransData.length > 0) {
        prevTotalTransactions = prevTransData.reduce((sum, transaction) => {
          const amount = parseFloat(transaction.amount?.toString() || '0');
          return sum + amount;
        }, 0) || 0;
        
        console.log(`[ROI API] Previous total transactions value: ${prevTotalTransactions}`);
      }
      
      // Calculate previous ROI prioritizing transaction data
      if (prevTotalTransactions > 0 && prevTotalRevenue > 0) {
        // Calculate previous ROI using transactions data
        previousValue = Math.round(((prevTotalRevenue - prevTotalTransactions) / prevTotalTransactions) * 100);
        console.log(`[ROI API] Calculated previous ROI (from transactions): ${previousValue}% (revenue: $${prevTotalRevenue}, transactions: $${prevTotalTransactions})`);
      }
      // Fallback to campaign budget only if no transaction data
      else if (prevTotalCampaignBudget > 0 && prevTotalRevenue > 0) {
        // Mostrar valores exactos para depuración del período anterior
        console.log(`[ROI API] PREV CALCULATION DEBUG - totalRevenue: ${prevTotalRevenue}, totalCampaignBudget: ${prevTotalCampaignBudget}`);
        console.log(`[ROI API] PREV CALCULATION DEBUG - difference: ${prevTotalRevenue - prevTotalCampaignBudget}, division: ${(prevTotalRevenue - prevTotalCampaignBudget) / prevTotalCampaignBudget}`);
        
        // Calculate previous ROI using campaign budget as fallback
        previousValue = Math.round(((prevTotalRevenue - prevTotalCampaignBudget) / prevTotalCampaignBudget) * 100);
        console.log(`[ROI API] Calculated previous alternative ROI (using campaign budget): ${previousValue}%`);
        
        // Verificación alternativa
        if (previousValue < 0 && prevTotalRevenue > prevTotalCampaignBudget) {
          console.error(`[ROI API] CALCULATION ERROR: Previous ROI es negativo (${previousValue}) pero revenue > budget!`);
        }
      } else if (prevTotalRevenue > 0) {
        // If revenue but no costs, use simplified value
        previousValue = 100;
        console.log(`[ROI API] Using previous simplified ROI: 100%`);
      } else {
        // Use fallback value for previous period
        previousValue = 0;
        console.log(`[ROI API] Using previous default ROI: 0%`);
      }
      
      // Store the previous period ROI (only if userId exists)
      if (userId && !skipKpiCreation) {
        await findOrCreateKpi(
          supabase,
          supabaseAdmin,
          {
            siteId,
            userId,
            segmentId: segmentId !== 'all' ? segmentId : null,
            periodStart: prevPeriodStart,
            periodEnd: prevPeriodEnd,
            type: "roi",
            name: "Return on Investment",
            value: previousValue,
            previousValue: undefined
          }
        );
      }
    }
    
    // Create or update the current period KPI (only if userId exists)
    let currentKpi = null;
    if (userId && !skipKpiCreation) {
      const kpiResult = await findOrCreateKpi(
        supabase,
        supabaseAdmin,
        {
          siteId,
          userId,
          segmentId: segmentId !== 'all' ? segmentId : null,
          periodStart: periodStart,
          periodEnd: periodEnd,
          type: "roi",
          name: "Return on Investment",
          value: roiValue,
          previousValue
        }
      );
      currentKpi = kpiResult.kpi;
    }
    
    // Calculate trend - ALWAYS recalculate to ensure accuracy
    percentChange = calculateTrend(roiValue, previousValue);
    console.log(`[ROI API] 📊 Calculated trend: current=${roiValue}%, previous=${previousValue}%, trend=${percentChange}%`);
    
    // Update the stored KPI with the correct trend if it exists
    if (currentKpi && currentKpi.trend !== percentChange) {
      console.log(`[ROI API] 🔄 Updating stored KPI trend from ${currentKpi.trend}% to ${percentChange}%`);
      // Note: The KPI will be updated with the correct trend on next creation/update
    }
  return { previousValue, percentChange };
}
