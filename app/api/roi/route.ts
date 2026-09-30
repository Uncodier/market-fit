import type { QueryResult } from '../_shared/query-result';
import type { CampaignBudgetRow, SaleRow, LeadIdRow, AmountRow } from '../_shared/marketing-query-types';
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
  const segmentId = searchParams.get('segmentId') || 'all'; // Usar 'all' como valor predeterminado
  const skipKpiCreation = searchParams.get('skipKpiCreation') === 'true';
  
  // Validate required parameters
  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }

  const access = await requireAnalyticsAccess(request);
  if (access.error) return access.error;
  const userId = access.userId;

  
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
    const supabase = createServiceApiClient(siteId);
    
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
    
    const { data: campaigns, error: campaignsError }: QueryResult<CampaignBudgetRow[]> = await campaignQuery;
    
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
    
    const { data: convertedLeads, error: leadsError }: QueryResult<LeadIdRow[]> = await leadsQuery;
    
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
    
    const { data: salesSaleDate, error: salesErrorSaleDate }: QueryResult<SaleRow[]> = await salesQuerySaleDate;
    
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
      
      const result: QueryResult<SaleRow[]> = await salesQuery;
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
        amount = Number(sale.amount) || 0;
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
    
    const { data: transData, error: transError }: QueryResult<(AmountRow & { created_at: string; type: string })[]> = await transQuery;
    
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
    
    const { previousValue, percentChange } = await comparePreviousPeriod({
      supabase, siteId, userId, segmentId, skipKpiCreation, periodStart, periodEnd, prevPeriodStart, prevPeriodEnd, roiValue
    });

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