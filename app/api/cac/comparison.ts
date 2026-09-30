import type { QueryResult } from '../_shared/query-result';
import type { CampaignBudgetRow, TransactionRow, SaleRow } from '../_shared/marketing-query-types';
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
  cacValue: number;
};

export async function comparePreviousPeriod({
  supabase, siteId, userId, segmentId, skipKpiCreation, standardizedStart, standardizedEnd, standardizedPrevStart, standardizedPrevEnd, hasRealData, cacValue
}: ComparisonInput) {
  // Get previous period CAC for comparison
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
        type: "cac",
        name: "Customer Acquisition Cost",
        value: 0, // Will be updated if needed
        previousValue: undefined
      }
    );
    
    if (prevKpi) {
      // If we found an existing KPI, use its value
      previousValue = prevKpi.value;
      console.log(`[CAC API] Found previous KPI with value: $${previousValue}`);
    } else {
      // Calculate previous period CAC
      let prevCampaignQuery = supabase
        .from('campaigns')
        .select('id, budget, metadata')
        .eq('site_id', siteId)
        .gte('created_at', standardizedPrevStart.toISOString())
        .lte('created_at', standardizedPrevEnd.toISOString());
      
      // If segmentId is provided, filter by segment
      if (segmentId && segmentId !== 'all') {
        prevCampaignQuery = prevCampaignQuery.eq('segment_id', segmentId);
      }
      
      const { data: prevCampaigns }: QueryResult<CampaignBudgetRow[]> = await prevCampaignQuery;
      
      // Get previous period transaction costs
      let prevTransactionsQuery = supabase
        .from('transactions')
        .select('id, amount, type, campaign_id')
        .eq('site_id', siteId)
        .gte('created_at', standardizedPrevStart.toISOString())
        .lte('created_at', standardizedPrevEnd.toISOString());
        
      // If segmentId is provided, filter by segment
      if (segmentId && segmentId !== 'all') {
        prevTransactionsQuery = prevTransactionsQuery.eq('segment_id', segmentId);
      }
      
      const { data: prevTransactions }: QueryResult<TransactionRow[]> = await prevTransactionsQuery;
      
      if (prevTransactions && prevTransactions.length > 0) {
        console.log(`[CAC API] Previous period: Found ${prevTransactions.length} transactions`);
      }
      
      // Obtener ventas con lead_id para el periodo anterior
      // Try sale_date first, then fallback to created_at
      const prevSaleDateStart = format(standardizedPrevStart, 'yyyy-MM-dd');
      const prevSaleDateEnd = format(standardizedPrevEnd, 'yyyy-MM-dd');
      
      // First try with sale_date
      let prevSalesQuerySaleDate = supabase
        .from('sales')
        .select('id, lead_id, amount, sale_date')
        .eq('site_id', siteId)
        .gte('sale_date', prevSaleDateStart)
        .lte('sale_date', prevSaleDateEnd)
        .not('lead_id', 'is', null); // Solo ventas asociadas a leads
        
      // If segmentId is provided, filter by segment
      if (segmentId && segmentId !== 'all') {
        prevSalesQuerySaleDate = prevSalesQuerySaleDate.eq('segment_id', segmentId);
      }
      
      const { data: prevSalesSaleDate, error: prevSalesErrorSaleDate }: QueryResult<Pick<SaleRow, 'id' | 'amount' | 'lead_id' | 'sale_date'>[]> = await prevSalesQuerySaleDate;
      
      // If sale_date query fails or returns no data, fallback to created_at
      let prevSales = prevSalesSaleDate;
      
      if (prevSalesErrorSaleDate || !prevSalesSaleDate || prevSalesSaleDate.length === 0) {
        console.log('[CAC API] Using created_at fallback for previous period sales query');
        
        let prevSalesQuery = supabase
          .from('sales')
          .select('id, lead_id, amount, sale_date')
          .eq('site_id', siteId)
          .gte('created_at', standardizedPrevStart.toISOString())
          .lte('created_at', standardizedPrevEnd.toISOString())
          .not('lead_id', 'is', null); // Solo ventas asociadas a leads
          
        // If segmentId is provided, filter by segment
        if (segmentId && segmentId !== 'all') {
          prevSalesQuery = prevSalesQuery.eq('segment_id', segmentId);
        }
        
        const result: QueryResult<Pick<SaleRow, 'id' | 'amount' | 'lead_id' | 'sale_date'>[]> = await prevSalesQuery;
        prevSales = result.data;
      } else {
        console.log('[CAC API] Using sale_date for previous period sales query');
      }
      
      // Contar ventas únicas por lead_id para no duplicar conversiones
      const prevUniqueLeadIds = new Set(prevSales?.map(sale => sale.lead_id) || []);
      const prevSalesCount = prevUniqueLeadIds.size;
      
      if (prevSales && prevSales.length > 0) {
        console.log(`[CAC API] Previous period: Found ${prevSalesCount} unique leads with sales`);
      }
      
      // Sum previous campaign budgets ONLY for paid campaigns
      const prevTotalCampaignBudget = prevCampaigns?.reduce((sum, campaign) => {
        // Only count budget if campaign is marked as paid in metadata
        const isPaid = campaign.metadata?.payment_status?.status === 'paid';
        if (isPaid) {
          const budgetAmount = campaign.budget?.allocated || 0;
          console.log(`[CAC API] Including previous paid campaign budget: $${budgetAmount} (Campaign: ${campaign.id})`);
          return sum + budgetAmount;
        } else {
          console.log(`[CAC API] Skipping previous non-paid campaign budget (Campaign: ${campaign.id})`);
          return sum;
        }
      }, 0) || 0;
      
      // Sum previous transaction costs
      const prevTotalTransactionCosts = prevTransactions?.reduce((sum, transaction) => {
        return sum + (transaction.amount || 0);
      }, 0) || 0;
      
      // Use transaction costs if available, otherwise fallback to campaign budget
      const prevCostValue = prevTotalTransactionCosts > 0 ? prevTotalTransactionCosts : prevTotalCampaignBudget;
      
      console.log(`[CAC API] Previous period: Campaign budget: $${prevTotalCampaignBudget}, Transaction costs: $${prevTotalTransactionCosts}`);
      
      // Usar ventas como conversiones
      let prevConversionCount = prevSalesCount;
      
      if (prevConversionCount > 0 && prevCostValue > 0) {
        // Calculate previous CAC
        previousValue = Math.round(prevCostValue / prevConversionCount);
        console.log(`[CAC API] Previous period: Calculated CAC: $${previousValue} using ${prevTotalTransactionCosts > 0 ? 'transaction costs' : 'campaign budget'}`);
      }
      
      // Store the previous period CAC only if we have real data
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
            type: "cac",
            name: "Customer Acquisition Cost",
            value: previousValue,
            previousValue: undefined
          }
        );
      }
    }
    
    // Create or update the current period KPI only if we have real data
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
          type: "cac",
          name: "Customer Acquisition Cost",
          value: cacValue,
          previousValue
        }
      );
      
      if (currentKpi) {
        // Use the stored trend value if available
        percentChange = currentKpi.trend;
      } else {
        // Calculate trend if KPI creation failed
        percentChange = calculateTrend(cacValue, previousValue);
      }
    }
  }
  return { previousValue, percentChange };
}
