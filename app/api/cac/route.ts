import type { QueryResult } from '../_shared/query-result';
import type { CampaignBudgetRow, TransactionRow, SaleRow } from '../_shared/marketing-query-types';
import { comparePreviousPeriod } from './comparison';
import { NextRequest, NextResponse } from 'next/server';
import { subDays, subMonths, format, subQuarters, subYears } from 'date-fns';
import { createServiceApiClient } from '@/lib/supabase/server-client';
import { requireAnalyticsAccess } from '@/lib/auth/api-analytics-access';
import { standardizePeriodDates } from './kpi';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  const segmentId = searchParams.get('segmentId');
  const skipKpiCreation = searchParams.get('skipKpiCreation') === 'true';
  
  // Log raw parameters and dates
  console.log(`[CAC API] Request parameters: `, {
    siteId,
    startDate: startDateStr,
    endDate: endDateStr,
    segmentId,
    skipKpiCreation
  });
  
  // Validate required parameters
  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }
  
  const access = await requireAnalyticsAccess(request);
  if (access.error) return access.error;
  const userId = access.userId;

  
  console.log('[CAC API] Request for site ID:', siteId, segmentId ? `and segment ID: ${segmentId}` : '');
  
  try {
    // Usar el cliente de servicio con permisos elevados para evitar restricciones RLS
    const supabase = createServiceApiClient(siteId);
    
    // Calculate period dates
    let periodStart = startDateStr ? new Date(startDateStr) : subDays(new Date(), 30);
    let periodEnd = endDateStr ? new Date(endDateStr) : new Date();
    
    // Log raw period dates
    console.log(`[CAC API] Raw period dates:`, {
      startDate: startDateStr,
      endDate: endDateStr,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });
    
    // Standardize dates for consistency
    const { periodStart: standardizedStart, periodEnd: standardizedEnd, periodType } = 
      standardizePeriodDates(periodStart, periodEnd);
    
    // Log standardized dates
    console.log(`[CAC API] Standardized period dates:`, {
      standardizedStart: standardizedStart.toISOString(),
      standardizedEnd: standardizedEnd.toISOString(),
      periodType
    });
    
    // Calculate previous period dates based on current period length
    let standardizedPrevStart: Date;
    let standardizedPrevEnd: Date;
    
    if (periodType === "daily") {
      standardizedPrevStart = subDays(standardizedStart, 1);
      standardizedPrevEnd = subDays(standardizedEnd, 1);
    } else if (periodType === "weekly") {
      standardizedPrevStart = subDays(standardizedStart, 7);
      standardizedPrevEnd = subDays(standardizedEnd, 7);
    } else if (periodType === "monthly") {
      standardizedPrevStart = subMonths(standardizedStart, 1);
      standardizedPrevEnd = subMonths(standardizedEnd, 1);
    } else if (periodType === "quarterly") {
      standardizedPrevStart = subQuarters(standardizedStart, 1);
      standardizedPrevEnd = subQuarters(standardizedEnd, 1);
    } else {
      standardizedPrevStart = subYears(standardizedStart, 1);
      standardizedPrevEnd = subYears(standardizedEnd, 1);
    }
    
    // STEP 1: Get all campaign transactions
    let campaignQuery = supabase
      .from('campaigns')
      .select('id, budget, metadata')
      .eq('site_id', siteId)
      .gte('created_at', standardizedStart.toISOString())
      .lte('created_at', standardizedEnd.toISOString());
    
    // If segmentId is provided, filter by segment
    if (segmentId && segmentId !== 'all') {
      campaignQuery = campaignQuery.eq('segment_id', segmentId);
    }
    
    const { data: campaigns, error: campaignsError }: QueryResult<CampaignBudgetRow[]> = await campaignQuery;
    
    if (campaignsError) {
      console.error('[CAC API] Error fetching campaigns:', campaignsError);
      return NextResponse.json({ 
        error: 'Failed to fetch campaigns',
        details: campaignsError 
      }, { status: 500 });
    }
    
    // STEP 1B: Get real transaction costs
    let transactionsQuery = supabase
      .from('transactions')
      .select('id, amount, type, campaign_id')
      .eq('site_id', siteId)
      .gte('created_at', standardizedStart.toISOString())
      .lte('created_at', standardizedEnd.toISOString());
      
    // If segmentId is provided, filter by segment
    if (segmentId && segmentId !== 'all') {
      transactionsQuery = transactionsQuery.eq('segment_id', segmentId);
    }
    
    // Log the transaction query range
    console.log(`[CAC API] Transactions query range: ${standardizedStart.toISOString()} to ${standardizedEnd.toISOString()}`);
    
    const { data: transactions, error: transactionsError }: QueryResult<TransactionRow[]> = await transactionsQuery;
    
    if (transactionsError) {
      console.error('[CAC API] Error fetching transactions:', transactionsError);
      return NextResponse.json({ 
        error: 'Failed to fetch transactions',
        details: transactionsError 
      }, { status: 500 });
    }
    
    console.log(`[CAC API] Found ${transactions?.length || 0} transactions`);
    if (transactions && transactions.length > 0) {
      console.log(`[CAC API] First transaction example:`, JSON.stringify(transactions[0]));
    } else {
      console.log(`[CAC API] No transactions found in date range`);
      
      // Debug query with broader date range to verify if there are any transactions
      const debugQuery: QueryResult<(TransactionRow & { created_at: string })[]> = await supabase
        .from('transactions')
        .select('id, amount, type, campaign_id, created_at')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(5);
        
      console.log(`[CAC API] Debug: Found ${debugQuery.data?.length || 0} transactions in site`);
      if (debugQuery.data && debugQuery.data.length > 0) {
        console.log(`[CAC API] Debug: First transaction example:`, JSON.stringify(debugQuery.data[0]));
        console.log(`[CAC API] Debug: Date ranges issue detected - transactions exist but not in specified range. Range start: ${standardizedStart.toISOString()}, Range end: ${standardizedEnd.toISOString()}`);
        // Log the created_at dates of found transactions to compare with our range
        debugQuery.data.forEach((transaction, index) => {
          console.log(`[CAC API] Debug: Transaction ${index+1} created_at: ${transaction.created_at}`);
          // Check if this transaction would be included in our range
          const transactionDate = new Date(transaction.created_at);
          const inRange = transactionDate >= standardizedStart && transactionDate <= standardizedEnd;
          console.log(`[CAC API] Debug: Transaction ${index+1} in range: ${inRange} (${transaction.created_at})`);
        });
      }
    }
    
    // STEP 2: Obtener ventas con lead_id como principal fuente de conversiones
    // En lugar de consultar leads convertidos, vamos directamente a sales
    // Try sale_date first, then fallback to created_at
    const saleDateStart = format(standardizedStart, 'yyyy-MM-dd');
    const saleDateEnd = format(standardizedEnd, 'yyyy-MM-dd');
    
    // First try with sale_date
    let salesQuerySaleDate = supabase
      .from('sales')
      .select('id, lead_id, amount, created_at, status, sale_date')
      .eq('site_id', siteId)
      .gte('sale_date', saleDateStart)
      .lte('sale_date', saleDateEnd)
      .not('lead_id', 'is', null); // Solo ventas asociadas a leads
      
    // If segmentId is provided, filter by segment
    if (segmentId && segmentId !== 'all') {
      salesQuerySaleDate = salesQuerySaleDate.eq('segment_id', segmentId);
    }
    
    const { data: salesSaleDate, error: salesErrorSaleDate }: QueryResult<SaleRow[]> = await salesQuerySaleDate;
    
    // If sale_date query fails or returns no data, fallback to created_at
    let sales = salesSaleDate;
    let salesError = salesErrorSaleDate;
    
    if (salesErrorSaleDate || !salesSaleDate || salesSaleDate.length === 0) {
      console.log('[CAC API] Using created_at fallback for sales query');
      
      let salesQuery = supabase
        .from('sales')
        .select('id, lead_id, amount, created_at, status, sale_date')
        .eq('site_id', siteId)
        .gte('created_at', standardizedStart.toISOString())
        .lte('created_at', standardizedEnd.toISOString())
        .not('lead_id', 'is', null); // Solo ventas asociadas a leads
        
      // If segmentId is provided, filter by segment
      if (segmentId && segmentId !== 'all') {
        salesQuery = salesQuery.eq('segment_id', segmentId);
      }
      
      const result: QueryResult<SaleRow[]> = await salesQuery;
      sales = result.data;
      salesError = result.error;
    } else {
      console.log('[CAC API] Using sale_date for sales query');
    }
    
    // Log the sales query range
    console.log(`[CAC API] Sales query range: ${standardizedStart.toISOString()} to ${standardizedEnd.toISOString()}`);
    
    
    if (salesError) {
      console.error('[CAC API] Error fetching sales:', salesError);
      return NextResponse.json({ 
        error: 'Failed to fetch sales',
        details: salesError 
      }, { status: 500 });
    }
    
    console.log(`[CAC API] Found ${sales?.length || 0} sales with lead_id`);
    if (sales && sales.length > 0) {
      console.log(`[CAC API] First sale example:`, JSON.stringify(sales[0]));
    } else {
      console.log(`[CAC API] No sales with lead_id found in date range`);
      
      // Debug query with broader date range to verify if there are any sales
      const debugQuery: QueryResult<Omit<SaleRow, 'sale_date'>[]> = await supabase
        .from('sales')
        .select('id, lead_id, amount, created_at, status')
        .eq('site_id', siteId)
        .not('lead_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);
        
      console.log(`[CAC API] Debug: Found ${debugQuery.data?.length || 0} sales with lead_id in site`);
      if (debugQuery.data && debugQuery.data.length > 0) {
        console.log(`[CAC API] Debug: First sale example:`, JSON.stringify(debugQuery.data[0]));
        console.log(`[CAC API] Debug: Date ranges issue detected - sales exist but not in specified range. Range start: ${standardizedStart.toISOString()}, Range end: ${standardizedEnd.toISOString()}`);
        // Log the created_at dates of found sales to compare with our range
        debugQuery.data.forEach((sale, index) => {
          console.log(`[CAC API] Debug: Sale ${index+1} created_at: ${sale.created_at}`);
          // Check if this sale would be included in our range
          const saleDate = new Date(sale.created_at);
          const inRange = saleDate >= standardizedStart && saleDate <= standardizedEnd;
          console.log(`[CAC API] Debug: Sale ${index+1} in range: ${inRange} (${sale.created_at})`);
        });
      }
    }
    
    // Contar ventas únicas por lead_id para no duplicar conversiones
    const uniqueLeadIds = new Set(sales?.map(sale => sale.lead_id) || []);
    const salesCount = uniqueLeadIds.size;
    console.log(`[CAC API] Found ${salesCount} unique leads with sales`);
    
    // STEP 3: Calculate CAC
    let cacValue = 0;
    let hasRealData = false;
    let conversionCount = salesCount;
    
    // Sum all real transaction costs
    const totalTransactionCosts = transactions?.reduce((sum, transaction) => {
      return sum + (transaction.amount || 0);
    }, 0) || 0;
    
    // Sum campaign budgets ONLY for paid campaigns (como respaldo si no hay transacciones)
    const totalCampaignBudget = campaigns?.reduce((sum, campaign) => {
      // Only count budget if campaign is marked as paid in metadata
      const isPaid = campaign.metadata?.payment_status?.status === 'paid';
      if (isPaid) {
        const budgetAmount = campaign.budget?.allocated || 0;
        console.log(`[CAC API] Including paid campaign budget: $${budgetAmount} (Campaign: ${campaign.id})`);
        return sum + budgetAmount;
      } else {
        console.log(`[CAC API] Skipping non-paid campaign budget (Campaign: ${campaign.id})`);
        return sum;
      }
    }, 0) || 0;
    
    console.log(`[CAC API] Total campaign budget: $${totalCampaignBudget}, Total transaction costs: $${totalTransactionCosts}, Conversion count: ${conversionCount}`);
    
    // Use transaction costs for CAC calculation if available, otherwise fallback to campaign budget
    const costValue = totalTransactionCosts > 0 ? totalTransactionCosts : totalCampaignBudget;
    
    if (conversionCount > 0 && costValue > 0) {
      // Calculate CAC as total costs divided by number of converted leads or sales
      cacValue = Math.round(costValue / conversionCount);
      hasRealData = true;
      console.log(`[CAC API] Calculated CAC: $${cacValue} (conversions: ${conversionCount}, ${totalTransactionCosts > 0 ? 'transaction costs' : 'campaign budget'}: $${costValue})`);
    } else {
      // No real data
      console.log('[CAC API] No valid data for CAC calculation in specified period');
      // Log more details about why we don't have real data
      if (conversionCount === 0) {
        console.log('[CAC API] No conversions found (neither converted leads nor sales with leads)');
      }
      if (costValue === 0) {
        console.log('[CAC API] No costs found (neither transactions nor campaign budget)');
      }
      // Even if we have costs but no conversions, we should report the costs
      if (costValue > 0) {
        console.log(`[CAC API] Costs exist ($${costValue}) but no conversions found`);
      }
      // Show campaign details if available
      if (campaigns && campaigns.length > 0) {
        console.log(`[CAC API] First campaign example:`, JSON.stringify(campaigns[0]));
      }
    }
    
    let { percentChange } = await comparePreviousPeriod({
      supabase, siteId, userId, segmentId, skipKpiCreation, standardizedStart, standardizedEnd, standardizedPrevStart, standardizedPrevEnd, hasRealData, cacValue
    });

    // If no real data but we have campaign budget, return budget information with warning
    if (!hasRealData && costValue > 0) {
      return NextResponse.json({
        actual: -1, // Special value indicating infinite CAC (budget spent but no conversions)
        currency: "USD",
        percentChange: 0,
        periodType,
        noData: true,
        details: {
          campaignCount: campaigns?.length || 0,
          campaignBudget: totalCampaignBudget,
          transactionsCost: totalTransactionCosts,
          salesCount,
          warning: "Cannot calculate CAC - costs exist but no conversions"
        }
      });
    }
    
    // If no real data, return empty/zero response
    if (!hasRealData) {
      return NextResponse.json({
        actual: 0,
        currency: "USD",
        percentChange: 0,
        periodType,
        noData: true,
        details: {
          campaignCount: campaigns?.length || 0,
          campaignBudget: totalCampaignBudget,
          transactionsCost: totalTransactionCosts,
          salesCount
        }
      });
    }
    
    // For CAC, a negative trend is actually good (costs went down)
    // So we need to invert the sign of the percentage change
    percentChange = -percentChange;
    
    const responseData = {
      actual: cacValue,
      currency: "USD",
      percentChange,
      periodType,
      details: {
        campaignCount: campaigns?.length || 0,
        campaignBudget: totalCampaignBudget,
        transactionsCost: totalTransactionCosts,
        salesCount,
        conversionCount,
        costSource: totalTransactionCosts > 0 ? 'transactions' : 'campaign_budget'
      }
    };
    
    console.log('[CAC API] Response data:', responseData);
    
    // Return the CAC data
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('[CAC API] Error calculating CAC:', error);
    return NextResponse.json({ 
      error: 'Failed to calculate CAC',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 