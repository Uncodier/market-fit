import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subDays, subMonths, format, startOfMonth, endOfMonth, subQuarters, subYears } from 'date-fns';
import { createApiClient, createServiceApiClient } from "@/lib/supabase/server-client";
import crypto from 'crypto';

interface KpiData {
  id: string;
  name: string;
  description: string | null;
  value: number;
  previous_value: number;
  unit: string;
  type: string;
  period_start: string;
  period_end: string;
  segment_id: string | null;
  is_highlighted: boolean;
  target_value: number | null;
  metadata: any;
  site_id: string;
  user_id: string | null;
  trend: number;
  benchmark: number | null;
}

// Helper function to format date for DB
function formatDateForDb(date: Date): string {
  return date.toISOString();
}

// Helper function to calculate trend percentage
function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

// Helper function to standardize period dates
function standardizePeriodDates(
  periodStart: Date,
  periodEnd: Date
): { periodStart: Date; periodEnd: Date; periodType: string } {
  const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 3600 * 24));
  
  let periodType = "monthly";
  
  // Solo usamos las fechas originales sin ajustarlas
  // El tipo de período se determina basado en la duración pero no afecta las fechas
  if (daysDiff <= 1) {
    periodType = "daily";
  } else if (daysDiff <= 7) {
    periodType = "weekly";
  } else if (daysDiff <= 31) {
    periodType = "monthly";
  } else if (daysDiff <= 90) {
    periodType = "quarterly";
  } else {
    periodType = "yearly";
  }
  
  // Siempre devolvemos las fechas originales sin modificar
  return { periodStart, periodEnd, periodType };
}

// Helper function to check if a KPI exists and create it if it doesn't
async function findOrCreateKpi(
  supabase: any,
  supabaseAdmin: any,
  kpiParams: {
    siteId: string,
    userId: string | null,
    segmentId: string | null,
    periodStart: Date,
    periodEnd: Date,
    type: string,
    name: string,
    value: number,
    previousValue?: number
  }
): Promise<{ kpi: any, created: boolean }> {
  // Get the period type and standardize dates for consistency
  const { periodStart, periodEnd, periodType } = standardizePeriodDates(
    kpiParams.periodStart,
    kpiParams.periodEnd
  );
  
  // Format dates consistently for DB
  const formattedStart = formatDateForDb(periodStart);
  const formattedEnd = formatDateForDb(periodEnd);
  
  // Create a deterministic ID for this KPI based on its key attributes
  // This ensures the same KPI always has the same ID, preventing duplicates
  const segmentPart = kpiParams.segmentId ? kpiParams.segmentId : "00000000-0000-0000-0000-000000000000";
  
  const idBase = `${kpiParams.type}:${kpiParams.name}:${kpiParams.siteId}:${formattedStart}:${formattedEnd}:${segmentPart}`;
  
  // Create a consistent UUID v5 from the string
  const deterministicId = crypto.createHash('md5').update(idBase).digest('hex');
  const kpiId = [
    deterministicId.substring(0, 8),
    deterministicId.substring(8, 12),
    deterministicId.substring(12, 16),
    deterministicId.substring(16, 20),
    deterministicId.substring(20, 32),
  ].join('-');
  
  console.log(`Finding/creating KPI with deterministic ID: ${kpiId} for ${idBase}`);
  
  // Create query parameters
  const queryParams = {
    type: kpiParams.type,
    name: kpiParams.name,
    site_id: kpiParams.siteId,
    period_start: formattedStart,
    period_end: formattedEnd
  };
  
  // Build query to find existing KPI by attributes
  let query = supabase
    .from("kpis")
    .select("*")
    .match(queryParams);
    
  // Handle segment ID specifically
  if (kpiParams.segmentId) {
    query = query.eq("segment_id", kpiParams.segmentId);
  } else {
    query = query.is("segment_id", null);
  }
  
  try {
    // First try to find by ID directly - fastest lookup
    const { data: existingKpiById, error: idError } = await supabase
      .from("kpis")
      .select("*")
      .eq("id", kpiId)
      .maybeSingle();
    
    if (!idError && existingKpiById) {
      console.log(`Found existing KPI by ID: ${existingKpiById.id}`);
      return { kpi: existingKpiById, created: false };
    }
    
    // If ID lookup failed, try attributes lookup
    const { data: existingKpi, error: fetchError } = await query;
    
    if (fetchError) {
      console.error("Error checking for existing KPI:", fetchError);
    } else if (existingKpi && existingKpi.length > 0) {
      console.log(`Found existing KPI by attributes: ${existingKpi[0].id}`);
      return { kpi: existingKpi[0], created: false };
    }
    
    // Only create KPI if we have a user ID
    if (!kpiParams.userId) {
      console.log("Skipping KPI creation: no user ID provided");
      return { kpi: null, created: false };
    }
    
    // Prepare KPI data with our deterministic ID
    const trend = kpiParams.previousValue !== undefined ? 
      calculateTrend(kpiParams.value, kpiParams.previousValue) : 0;
    
    const newKpi: Partial<KpiData> = {
      id: kpiId, // Use our deterministic ID
      name: kpiParams.name,
      description: `${kpiParams.name} for ${periodType} period`,
      value: kpiParams.value,
      previous_value: kpiParams.previousValue || 0,
      unit: "currency",
      type: kpiParams.type,
      period_start: formattedStart,
      period_end: formattedEnd,
      segment_id: kpiParams.segmentId,
      is_highlighted: true,
      target_value: null,
      metadata: {
        period_type: periodType,
        currency: "USD"
      },
      site_id: kpiParams.siteId,
      user_id: kpiParams.userId,
      trend,
      benchmark: null
    };
    
    // Try to insert with upsert semantics - will update existing records with same ID
    console.log(`Creating new KPI with ID: ${kpiId}`);
    const { data: insertedKpi, error: insertError } = await supabaseAdmin
      .from("kpis")
      .upsert(newKpi)
      .select()
      .maybeSingle();
    
    if (insertError) {
      console.error("Error inserting KPI:", insertError);
      
      // Last chance - query again to see if it exists
      const { data: finalCheckKpi } = await query;
      if (finalCheckKpi && finalCheckKpi.length > 0) {
        console.log(`Found KPI in final check: ${finalCheckKpi[0].id}`);
        return { kpi: finalCheckKpi[0], created: false };
      }
      
      return { kpi: null, created: false };
    }
    
    console.log(`Successfully created KPI with ID: ${insertedKpi.id}`);
    return { kpi: insertedKpi, created: true };
  } catch (error) {
    console.error("Exception during KPI creation:", error);
    
    // Final fallback check
    try {
      const { data: recoveryCheckKpi } = await query;
      if (recoveryCheckKpi && recoveryCheckKpi.length > 0) {
        console.log(`Found KPI during recovery: ${recoveryCheckKpi[0].id}`);
        return { kpi: recoveryCheckKpi[0], created: false };
      }
    } catch (recoveryError) {
      console.error("Error during recovery check:", recoveryError);
    }
    
    return { kpi: null, created: false };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const userId = searchParams.get('userId');
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  const segmentId = searchParams.get('segmentId');
  const skipKpiCreation = searchParams.get('skipKpiCreation') === 'true';
  
  // Log raw parameters and dates
  console.log(`[CAC API] Request parameters: `, {
    siteId,
    userId,
    startDate: startDateStr,
    endDate: endDateStr,
    segmentId,
    skipKpiCreation
  });
  
  // Validate required parameters
  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }
  
  console.log('[CAC API] Request for site ID:', siteId, segmentId ? `and segment ID: ${segmentId}` : '');
  
  try {
    // Usar el cliente de servicio con permisos elevados para evitar restricciones RLS
    const supabase = createServiceApiClient();
    
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
      .select('id, budget')
      .eq('site_id', siteId)
      .gte('created_at', standardizedStart.toISOString())
      .lte('created_at', standardizedEnd.toISOString());
    
    // If segmentId is provided, filter by segment
    if (segmentId && segmentId !== 'all') {
      campaignQuery = campaignQuery.eq('segment_id', segmentId);
    }
    
    const { data: campaigns, error: campaignsError } = await campaignQuery;
    
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
    
    const { data: transactions, error: transactionsError } = await transactionsQuery;
    
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
      const debugQuery = await supabase
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
    let salesQuery = supabase
      .from('sales')
      .select('id, lead_id, amount, created_at, status')
      .eq('site_id', siteId)
      .gte('created_at', standardizedStart.toISOString())
      .lte('created_at', standardizedEnd.toISOString())
      .not('lead_id', 'is', null); // Solo ventas asociadas a leads
      
    // If segmentId is provided, filter by segment
    if (segmentId && segmentId !== 'all') {
      salesQuery = salesQuery.eq('segment_id', segmentId);
    }
    
    // Log the sales query range
    console.log(`[CAC API] Sales query range: ${standardizedStart.toISOString()} to ${standardizedEnd.toISOString()}`);
    
    const { data: sales, error: salesError } = await salesQuery;
    
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
      const debugQuery = await supabase
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
    
    // Sum all campaign budgets (como respaldo si no hay transacciones)
    const totalCampaignBudget = campaigns?.reduce((sum, campaign) => {
      // Access the allocated property from the budget object
      const budgetAmount = campaign.budget?.allocated || 0;
      return sum + budgetAmount;
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
          .select('id, budget')
          .eq('site_id', siteId)
          .gte('created_at', standardizedPrevStart.toISOString())
          .lte('created_at', standardizedPrevEnd.toISOString());
        
        // If segmentId is provided, filter by segment
        if (segmentId && segmentId !== 'all') {
          prevCampaignQuery = prevCampaignQuery.eq('segment_id', segmentId);
        }
        
        const { data: prevCampaigns } = await prevCampaignQuery;
        
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
        
        const { data: prevTransactions } = await prevTransactionsQuery;
        
        if (prevTransactions && prevTransactions.length > 0) {
          console.log(`[CAC API] Previous period: Found ${prevTransactions.length} transactions`);
        }
        
        // Obtener ventas con lead_id para el periodo anterior
        let prevSalesQuery = supabase
          .from('sales')
          .select('id, lead_id, amount')
          .eq('site_id', siteId)
          .gte('created_at', standardizedPrevStart.toISOString())
          .lte('created_at', standardizedPrevEnd.toISOString())
          .not('lead_id', 'is', null); // Solo ventas asociadas a leads
          
        // If segmentId is provided, filter by segment
        if (segmentId && segmentId !== 'all') {
          prevSalesQuery = prevSalesQuery.eq('segment_id', segmentId);
        }
        
        const { data: prevSales } = await prevSalesQuery;
        
        // Contar ventas únicas por lead_id para no duplicar conversiones
        const prevUniqueLeadIds = new Set(prevSales?.map(sale => sale.lead_id) || []);
        const prevSalesCount = prevUniqueLeadIds.size;
        
        if (prevSales && prevSales.length > 0) {
          console.log(`[CAC API] Previous period: Found ${prevSalesCount} unique leads with sales`);
        }
        
        // Sum previous campaign budgets
        const prevTotalCampaignBudget = prevCampaigns?.reduce((sum, campaign) => {
          // Access the allocated property from the budget object
          const budgetAmount = campaign.budget?.allocated || 0;
          return sum + budgetAmount;
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