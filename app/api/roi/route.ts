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

/**
 * ROI Calculation Strategy:
 * 
 * This API calculates ROI using multiple strategies depending on available data:
 * 
 * 1. Standard ROI: ((Revenue - Transaction Costs) / Transaction Costs) * 100
 *    - Used when transaction data is available
 *    - Most accurate measure of marketing ROI based on actual expenditures
 * 
 * 2. Alternative ROI: ((Revenue - Campaign Budgets) / Campaign Budgets) * 100
 *    - Used as fallback when transaction data is unavailable
 *    - Less accurate as it uses budgeted amounts rather than actual expenditures
 * 
 * 3. Simplified ROI: 100%
 *    - Used when there is revenue but no cost data available
 *    - Represents a positive return but with unmeasured magnitude
 * 
 * 4. Default ROI: 0%
 *    - Used when no revenue or cost data is available
 *    - Represents no measurable return
 */

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
  let standardizedStart = periodStart;
  let standardizedEnd = periodEnd;
  
  if (daysDiff <= 1) {
    periodType = "daily";
    // Keep as is
  } else if (daysDiff <= 7) {
    periodType = "weekly";
    // Keep as is
  } else if (daysDiff <= 31) {
    periodType = "monthly";
    standardizedStart = startOfMonth(periodStart);
    standardizedEnd = endOfMonth(periodStart);
  } else if (daysDiff <= 90) {
    periodType = "quarterly";
    // First day of current quarter to last day of current quarter
    standardizedStart = startOfMonth(periodStart);
    standardizedEnd = endOfMonth(new Date(periodStart.getFullYear(), periodStart.getMonth() + 2, 1));
  } else {
    periodType = "yearly";
    standardizedStart = new Date(periodStart.getFullYear(), 0, 1);
    standardizedEnd = new Date(periodStart.getFullYear(), 11, 31);
  }
  
  return { periodStart: standardizedStart, periodEnd: standardizedEnd, periodType };
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
      
      // Validate that the site exists before creating KPI
      const { data: siteExists, error: siteError } = await supabase
        .from('sites')
        .select('id')
        .eq('id', kpiParams.siteId)
        .single();
      
      if (siteError || !siteExists) {
        console.log(`Skipping KPI creation: site ${kpiParams.siteId} does not exist`);
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
      unit: "percentage",
      type: kpiParams.type,
      period_start: formattedStart,
      period_end: formattedEnd,
      segment_id: kpiParams.segmentId,
      is_highlighted: true,
      target_value: null,
      metadata: {
        period_type: periodType,
        unit: "%"
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
  const segmentId = searchParams.get('segmentId') || 'all'; // Usar 'all' como valor predeterminado
  const skipKpiCreation = searchParams.get('skipKpiCreation') === 'true';
  
  // Validate required parameters
  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }
  
  console.log('[ROI API] Request parameters:', { 
    siteId, 
    userId, 
    segmentId, 
    startDate: startDateStr, 
    endDate: endDateStr 
  });
  
  // Log if this is a real request or test
  if (siteId && siteId !== '12345678-1234-1234-1234-123456789012') {
    console.log('[ROI API] 🔥 REAL REQUEST DETECTED with siteId:', siteId);
  } else {
    console.log('[ROI API] 🧪 Test request detected');
  }
  
  try {
    // Usar el cliente de servicio con permisos elevados para evitar restricciones RLS
    const supabase = createServiceApiClient();
    
    // Calculate period dates - utilizando UTC para evitar problemas de zona horaria
    let periodStart = startDateStr ? new Date(startDateStr) : subDays(new Date(), 30);
    let periodEnd = endDateStr ? new Date(endDateStr) : new Date();
    
    console.log('[ROI API] Raw period dates:', {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString()
    });

    // No estandarizamos las fechas para consultas, usamos las fechas tal como fueron proporcionadas
    // para evitar cualquier problema con la estandarización
    const periodType = getPeriodType(periodStart, periodEnd);
    
    // Calcular fechas para el período anterior manteniendo el mismo intervalo
    const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 3600 * 24));
    let prevPeriodStart = new Date(periodStart);
    let prevPeriodEnd = new Date(periodEnd);

    if (periodType === "daily") {
      prevPeriodStart = subDays(periodStart, 1);
      prevPeriodEnd = subDays(periodEnd, 1);
    } else if (periodType === "weekly") {
      prevPeriodStart = subDays(periodStart, 7);
      prevPeriodEnd = subDays(periodEnd, 7);
    } else if (periodType === "monthly") {
      prevPeriodStart = subMonths(periodStart, 1);
      prevPeriodEnd = subMonths(periodEnd, 1);
    } else if (periodType === "quarterly") {
      prevPeriodStart = subQuarters(periodStart, 1);
      prevPeriodEnd = subQuarters(periodEnd, 1);
    } else {
      prevPeriodStart = subYears(periodStart, 1);
      prevPeriodEnd = subYears(periodEnd, 1);
    }
    
    // STEP 1: Get all campaign transactions
    let campaignQuery = supabase
      .from('campaigns')
      .select('id, budget, created_at, metadata')
      .eq('site_id', siteId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());
    
    // If segmentId is provided and not 'all', filter by segment
    if (segmentId && segmentId !== 'all') {
      campaignQuery = campaignQuery.eq('segment_id', segmentId);
    }
    
    const { data: campaigns, error: campaignsError } = await campaignQuery;
    
    if (campaignsError) {
      console.error('[ROI API] Error fetching campaigns:', campaignsError);
      return NextResponse.json({ 
        error: 'Failed to fetch campaigns',
        details: campaignsError 
      }, { status: 500 });
    }

    // Debug: Imprimir qué consulta estamos ejecutando exactamente
    console.log(`[ROI API] Campaign query range: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    
    // Debug: Print what we found to troubleshoot campaigns
    console.log(`[ROI API] Found ${campaigns?.length || 0} campaigns for period ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    if (campaigns && campaigns.length > 0) {
      console.log('[ROI API] First campaign example:', JSON.stringify(campaigns[0]));
    }
    
    // STEP 2: Get all converted leads
    let leadsQuery = supabase
      .from('leads')
      .select('id')
      .eq('site_id', siteId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString())
      .eq('status', 'converted');
    
    // If segmentId is provided and not 'all', filter by segment
    if (segmentId && segmentId !== 'all') {
      leadsQuery = leadsQuery.eq('segment_id', segmentId);
    }
    
    const { data: convertedLeads, error: leadsError } = await leadsQuery;
    
    if (leadsError) {
      console.error('[ROI API] Error fetching converted leads:', leadsError);
      return NextResponse.json({ 
        error: 'Failed to fetch converted leads',
        details: leadsError 
      }, { status: 500 });
    }
    
    // STEP 3: Get sales data to calculate revenue
    // Try sale_date first, then fallback to created_at
    const saleDateStart = format(periodStart, 'yyyy-MM-dd');
    const saleDateEnd = format(periodEnd, 'yyyy-MM-dd');
    
    // First try with sale_date
    let salesQuerySaleDate = supabase
      .from('sales')
      .select('id, amount, created_at, status, lead_id, sale_date')
      .eq('site_id', siteId)
      .gte('sale_date', saleDateStart)
      .lte('sale_date', saleDateEnd);
    
    // If segmentId is provided and not 'all', filter by segment
    if (segmentId && segmentId !== 'all') {
      salesQuerySaleDate = salesQuerySaleDate.eq('segment_id', segmentId);
    }
    
    const { data: salesSaleDate, error: salesErrorSaleDate } = await salesQuerySaleDate;
    
    // If sale_date query fails or returns no data, fallback to created_at
    let sales = salesSaleDate;
    let salesError = salesErrorSaleDate;
    
    if (salesErrorSaleDate || !salesSaleDate || salesSaleDate.length === 0) {
      console.log('[ROI API] Using created_at fallback for current period sales query');
      
      let salesQuery = supabase
        .from('sales')
        .select('id, amount, created_at, status, lead_id, sale_date')
        .eq('site_id', siteId)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString());
      
      // If segmentId is provided and not 'all', filter by segment
      if (segmentId && segmentId !== 'all') {
        salesQuery = salesQuery.eq('segment_id', segmentId);
      }
      
      const result = await salesQuery;
      sales = result.data;
      salesError = result.error;
    } else {
      console.log('[ROI API] Using sale_date for current period sales query');
    }
    
    // Debug: Imprimir la consulta exacta para diagnosticar problemas
    console.log(`[ROI API] Sales query range: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    
    
    if (salesError) {
      console.error('[ROI API] Error fetching sales:', salesError);
      return NextResponse.json({ 
        error: 'Failed to fetch sales',
        details: salesError 
      }, { status: 500 });
    }

    // Debug: Print what we found to troubleshoot
    console.log(`[ROI API] Found ${sales?.length || 0} sales for period ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    
    // Filtrar ventas completadas y otras para diagnóstico
    const completedSales = sales?.filter(sale => sale.status === 'completed') || [];
    const otherSales = sales?.filter(sale => sale.status !== 'completed') || [];
    const salesWithLeadId = sales?.filter(sale => sale.lead_id) || [];
    const salesWithoutLeadId = sales?.filter(sale => !sale.lead_id) || [];
    
    console.log(`[ROI API] Sales breakdown: ${completedSales.length} completed, ${otherSales.length} other status`);
    console.log(`[ROI API] Sales by lead: ${salesWithLeadId.length} with lead_id, ${salesWithoutLeadId.length} without lead_id`);
    
    if (sales && sales.length > 0) {
      console.log('[ROI API] First sale example:', JSON.stringify(sales[0]));
    }
    
    // STEP 4: Calculate ROI
    let roiValue = 0;
    let alternativeRoiValue = null;
    
    // Sum campaign budgets ONLY for paid campaigns (costs)
    const totalCampaignBudget = campaigns?.reduce((sum, campaign) => {
      // Only count budget if campaign is marked as paid in metadata
      const isPaid = campaign.metadata?.payment_status?.status === 'paid';
      if (!isPaid) {
        console.log(`[ROI API] Skipping non-paid campaign budget (Campaign: ${campaign.id})`);
        return sum;
      }
      
      // Access the allocated property from the budget object
      const budgetAmount = campaign.budget?.allocated || 0;
      
      // Validar el valor para evitar valores negativos o inválidos
      if (typeof budgetAmount !== 'number' || isNaN(budgetAmount)) {
        console.error(`[ROI API] Invalid campaign budget amount: ${campaign.budget?.allocated}`);
        return sum;
      }
      
      // Asegurar que es positivo
      const validBudgetAmount = Math.max(0, budgetAmount);
      console.log(`[ROI API] Including paid campaign budget: $${validBudgetAmount} (Campaign: ${campaign.id})`);
      
      return sum + validBudgetAmount;
    }, 0) || 0;
    
    // Sum all sales (revenue) - incluyendo TODAS las ventas (no solo las completadas)
    const totalRevenue = sales?.reduce((sum, sale) => {
      // Parsear y validar el valor
      let amount = 0;
      try {
        amount = typeof sale.amount === 'number' ? sale.amount : parseFloat(sale.amount?.toString() || '0');
        if (isNaN(amount)) {
          console.error(`[ROI API] Invalid sale amount: ${sale.amount}`);
          amount = 0;
        }
      } catch (e) {
        console.error(`[ROI API] Error parsing sale amount: ${sale.amount}`, e);
        amount = 0;
      }
      
      // Asegurar que es positivo
      const validAmount = Math.max(0, amount);
      if (validAmount > 0) {
        console.log(`[ROI API] Sale ID ${sale.id}: amount = ${validAmount}`);
      }
      
      return sum + validAmount;
    }, 0) || 0;

    console.log(`[ROI API] Total campaign budget: ${totalCampaignBudget}`);
    console.log(`[ROI API] Total revenue: ${totalRevenue}, from ${sales?.length || 0} sales`);
    
    // STEP 5: Get transactions data to calculate alternative ROI (sales/transactions)
    const transQuery = supabase
      .from('transactions')
      .select('id, amount, created_at, type')
      .eq('site_id', siteId)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString());
    
    // Debug: Imprimir la consulta exacta para diagnosticar problemas
    console.log(`[ROI API] Transactions query range: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    
    if (segmentId && segmentId !== 'all') {
      transQuery.eq('segment_id', segmentId);
    }
    
    const { data: transData, error: transError } = await transQuery;
    
    console.log(`[ROI API] Found ${transData?.length || 0} transactions for period ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    if (transData && transData.length > 0) {
      console.log('[ROI API] First transaction example:', JSON.stringify(transData[0]));
    }

    // Ya no consultamos la tabla costs porque no existe
    
    let totalTransactions = 0;
    
    if (!transError && transData) {
      // Sum all transactions (costs)
      totalTransactions = transData.reduce((sum, transaction) => {
        const amount = parseFloat(transaction.amount?.toString() || '0');
        return sum + amount;
      }, 0) || 0;
      
      console.log(`[ROI API] Total transactions value: ${totalTransactions}`);
    } else if (transError) {
      console.error('[ROI API] Error fetching transactions:', transError);
    }
    
    // Calculate ROI based on transactions data if available
    if (totalTransactions > 0 && totalRevenue > 0) {
      // Calculate primary ROI using transactions data
      roiValue = Math.round(((totalRevenue - totalTransactions) / totalTransactions) * 100);
      console.log(`[ROI API] Calculated primary ROI (from transactions): ${roiValue}% (total revenue: $${totalRevenue}, total transactions: $${totalTransactions})`);
    }
    // Fallback to campaign budget only if no transaction data is available
    else if (totalCampaignBudget > 0 && totalRevenue > 0) {
      // Mostrar valores exactos para depuración
      console.log(`[ROI API] CALCULATION DEBUG - totalRevenue: ${totalRevenue}, totalCampaignBudget: ${totalCampaignBudget}`);
      console.log(`[ROI API] CALCULATION DEBUG - difference: ${totalRevenue - totalCampaignBudget}, division: ${(totalRevenue - totalCampaignBudget) / totalCampaignBudget}`);
      
      // Calculate ROI as percentage: ((Revenue - Cost) / Cost) * 100
      roiValue = Math.round(((totalRevenue - totalCampaignBudget) / totalCampaignBudget) * 100);
      console.log(`[ROI API] Calculated alternative ROI (using campaign budget): ${roiValue}% (total revenue: $${totalRevenue}, campaign budget: $${totalCampaignBudget})`);
      
      // Verificación alternativa
      if (roiValue < 0 && totalRevenue > totalCampaignBudget) {
        console.error(`[ROI API] CALCULATION ERROR: ROI es negativo (${roiValue}) pero revenue > budget!`);
      }
    } else if (totalRevenue > 0) {
      // Si hay ingresos pero no hay presupuesto ni transacciones, usamos una medida simplificada
      roiValue = 100;
      console.log(`[ROI API] Using simplified ROI: 100% (total revenue: $${totalRevenue}, no cost data available)`);
    } else {
      // If no campaign budget, no transactions, and no revenue, ROI cannot be calculated
      roiValue = 0;
      console.log('[ROI API] Using default ROI: 0% (no revenue data available)');
    }
    
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
        
        const { data: prevCampaigns } = await prevCampaignQuery;
        
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
        
        const { data: prevSalesSaleDate, error: prevSalesErrorSaleDate } = await prevSalesQuerySaleDate;
        
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
          
          const result = await prevSalesQuery;
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
        
        const { data: prevTransData, error: prevTransError } = await prevTransQuery;
        
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
    
    // Final logging before response
    console.log(`[ROI API] 🎯 FINAL CALCULATION: current=${roiValue}%, previous=${previousValue}%, change=${percentChange}%`);
    
    const responseData = {
      actual: roiValue,
      unit: "%",
      percentChange,
      periodType,
      details: {
        campaignCount: campaigns?.length || 0,
        campaignBudget: totalCampaignBudget,
        convertedLeadsCount: convertedLeads?.length || 0,
        totalRevenue: totalRevenue,
        alternativeRoi: alternativeRoiValue,
        transactionsCount: transData?.length || 0,
        totalTransactions: totalTransactions
      }
    };
    
    console.log('[ROI API] Response data:', responseData);
    
    // Return the ROI data
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('[ROI API] Error calculating ROI:', error);
    return NextResponse.json({ 
      error: 'Failed to calculate ROI',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Nueva función para determinar el tipo de período sin estandarizar las fechas
function getPeriodType(periodStart: Date, periodEnd: Date): string {
  const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 3600 * 24));
  
  if (daysDiff <= 1) {
    return "daily";
  } else if (daysDiff <= 7) {
    return "weekly";
  } else if (daysDiff <= 31) {
    return "monthly";
  } else if (daysDiff <= 90) {
    return "quarterly";
  } else {
    return "yearly";
  }
} 