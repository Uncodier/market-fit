import type { QueryResult } from '../_shared/query-result';
import type { SaleRow, LeadIdRow, AmountRow } from '../_shared/marketing-query-types';
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
  const skipKpiCreation = searchParams.get('skipKpiCreation') === 'true';
  const segmentId = searchParams.get('segmentId');
  
  // Validate required parameters
  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }

  const access = await requireAnalyticsAccess(request);
  if (access.error) return access.error;
  const userId = access.userId;

  // Usar el cliente de servicio con permisos elevados para evitar restricciones RLS
  const supabase = createServiceApiClient(siteId);

  
  console.log('[LTV API] Request for site ID:', siteId, segmentId ? `and segment ID: ${segmentId}` : '');
  
  try {
    // Calculate period dates
    let periodStart = startDateStr ? new Date(startDateStr) : subDays(new Date(), 30);
    let periodEnd = endDateStr ? new Date(endDateStr) : new Date();
    
    // Si las fechas están en formato YYYY-MM-DD, podemos tener problemas con la zona horaria
    // Asegurar que las fechas son procesadas correctamente
    const dateFormatPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (startDateStr && dateFormatPattern.test(startDateStr)) {
      // Formato YYYY-MM-DD, necesitamos ajustar la hora para evitar problemas de zona horaria
      periodStart = new Date(startDateStr + 'T00:00:00.000Z');
    }
    if (endDateStr && dateFormatPattern.test(endDateStr)) {
      // Formato YYYY-MM-DD, fijar al final del día
      periodEnd = new Date(endDateStr + 'T23:59:59.999Z');
    }
    
    const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 3600 * 24));
    
    // Log raw period dates for debugging
    console.log(`[LTV API] Raw period dates: startDate=${startDateStr}, endDate=${endDateStr}`);
    console.log(`[LTV API] Parsed period dates: periodStart=${periodStart.toISOString()}, periodEnd=${periodEnd.toISOString()}`);
    
    // Verificar que hay ventas en la base de datos (sin filtro de fechas)
    const { data: allSales, error: allSalesError }: QueryResult<Omit<SaleRow, 'sale_date'>[]> = await supabase
      .from('sales')
      .select('id, amount, lead_id, created_at, status')
      .eq('site_id', siteId)
      .limit(5);
      
    if (allSalesError) {
      console.error('[LTV API] Error fetching all sales:', allSalesError);
    } else {
      console.log(`[LTV API] Total sales in database (sample of 5): ${allSales?.length || 0}`);
      if (allSales && allSales.length > 0) {
        console.log(`[LTV API] First sale example: ${JSON.stringify(allSales[0])}`);
      }
    }
    
    // Standardize dates for consistency
    const { periodStart: standardizedStart, periodEnd: standardizedEnd, periodType } = 
      standardizePeriodDates(periodStart, periodEnd);
      
    console.log(`[LTV API] Standardized period dates: standardizedStart=${standardizedStart.toISOString()}, standardizedEnd=${standardizedEnd.toISOString()}, type=${periodType}`);
    
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
    
    // STEP 1: Get all purchase tasks with status completed
    let purchaseTasksQuery = supabase
      .from('tasks')
      .select('id, amount, lead_id')
      .eq('site_id', siteId)
      .eq('stage', 'purchase')
      .eq('status', 'completed')
      .gte('created_at', standardizedStart.toISOString())
      .lte('created_at', standardizedEnd.toISOString());

    // If segmentId is provided and not 'all', we need to filter tasks by leads with that segment
    if (segmentId && segmentId !== 'all') {
      // First, get all leads with the specified segment
      const { data: segmentLeads }: QueryResult<LeadIdRow[]> = await supabase
        .from('leads')
        .select('id')
        .eq('site_id', siteId)
        .eq('segment_id', segmentId);
      
      if (segmentLeads && segmentLeads.length > 0) {
        // Get the lead IDs to filter tasks
        const leadIds = segmentLeads.map(lead => lead.id);
        // Filter tasks by these lead IDs
        purchaseTasksQuery = purchaseTasksQuery.in('lead_id', leadIds);
      }
    }
    
    const { data: purchaseTasks, error: tasksError }: QueryResult<(AmountRow & { lead_id: string | null })[]> = await purchaseTasksQuery;
    
    if (tasksError) {
      console.error('[LTV API] Error fetching purchase tasks:', tasksError);
      return NextResponse.json({ 
        error: 'Failed to fetch purchase tasks',
        details: tasksError 
      }, { status: 500 });
    }
    
    // STEP 2: Get all converted leads
    let leadsQuery = supabase
      .from('leads')
      .select('id')
      .eq('site_id', siteId)
      .eq('status', 'converted')
      .gte('created_at', standardizedStart.toISOString())
      .lte('created_at', standardizedEnd.toISOString());
    
    // If segmentId is provided, filter by segment
    if (segmentId && segmentId !== 'all') {
      leadsQuery = leadsQuery.eq('segment_id', segmentId);
    }
    
    const { data: convertedLeads, error: leadsError }: QueryResult<LeadIdRow[]> = await leadsQuery;
    
    if (leadsError) {
      console.error('[LTV API] Error fetching converted leads:', leadsError);
      return NextResponse.json({ 
        error: 'Failed to fetch converted leads',
        details: leadsError 
      }, { status: 500 });
    }
    
    // Debug information
    console.log(`[LTV API] Found ${purchaseTasks?.length || 0} purchase tasks and ${convertedLeads?.length || 0} converted leads`);
    
    // PASO ADICIONAL: Buscar ventas con leads directamente para tener otra fuente de datos
    // Esto es útil en caso de que no hay tareas de compra o leads convertidos
    let salesWithLeadsQuery = supabase
      .from('sales')
      .select('id, amount, lead_id')
      .eq('site_id', siteId)
      .eq('status', 'completed')
      .not('lead_id', 'is', null)
      .gte('created_at', standardizedStart.toISOString())
      .lte('created_at', standardizedEnd.toISOString());
    
    if (segmentId && segmentId !== 'all') {
      // Intentar filtrar por segment_id si la columna existe
      try {
        const { data: testData } = await supabase
          .from('sales')
          .select('segment_id')
          .limit(1);
        
        if (testData && testData.length > 0 && 'segment_id' in testData[0]) {
          salesWithLeadsQuery = salesWithLeadsQuery.eq('segment_id', segmentId);
        }
      } catch (error) {
        console.log('[LTV API] Could not filter sales by segment_id');
      }
    }
    
    const { data: salesWithLeads, error: salesError }: QueryResult<Pick<SaleRow, 'id' | 'amount' | 'lead_id'>[]> = await salesWithLeadsQuery;
    
    if (!salesError && salesWithLeads && salesWithLeads.length > 0) {
      console.log(`[LTV API] Found ${salesWithLeads.length} sales with lead_id`);
    } else {
      console.log(`[LTV API] No sales with lead_id found`);
    }
    
    // STEP 3: Calculate LTV
    let ltvValue = 0;
    let hasRealData = false;
    
    // If we have converted leads and purchase tasks
    if (convertedLeads && convertedLeads.length > 0 && purchaseTasks && purchaseTasks.length > 0) {
      // Sum all purchase amounts
      const totalPurchaseAmount = purchaseTasks.reduce((sum, task) => {
        return sum + (task.amount || 0);
      }, 0);
      
      // Calculate LTV as average purchase amount per converted lead
      ltvValue = Math.round(totalPurchaseAmount / convertedLeads.length);
      hasRealData = true;
      
      console.log(`[LTV API] Calculated LTV: $${ltvValue} (total purchases: $${totalPurchaseAmount}, converted leads: ${convertedLeads.length})`);
    } 
    // Segundo método: Si tenemos ventas con lead_id
    else if (salesWithLeads && salesWithLeads.length > 0) {
      // Obtener leads únicos de las ventas
      const uniqueLeadIds = new Set();
      salesWithLeads.forEach(sale => {
        if (sale.lead_id) {
          uniqueLeadIds.add(sale.lead_id);
        }
      });
      
      // Calcular el total de ventas
      const totalSalesAmount = salesWithLeads.reduce((sum, sale) => {
        return sum + (parseFloat(sale.amount?.toString() || '0'));
      }, 0);
      
      // Si tenemos leads únicos, calculamos el LTV como total ventas / número de leads únicos
      if (uniqueLeadIds.size > 0) {
        ltvValue = Math.round(totalSalesAmount / uniqueLeadIds.size);
        hasRealData = true;
        console.log(`[LTV API] Calculated LTV from sales with lead_id: $${ltvValue} (total sales: $${totalSalesAmount}, unique leads: ${uniqueLeadIds.size})`);
      }
    }
    // Tercer método: Fallback a la aproximación original
    else {
      // Ahora creamos dos consultas: una basada en created_at y otra en sale_date
      // y usaremos la que devuelva más resultados
      
      // 1. Consulta basada en created_at (la original)
      let revenueQueryCreatedAt = supabase
        .from('sales')
        .select('*')
        .eq('site_id', siteId)
        .eq('status', 'completed')
        .gte('created_at', standardizedStart.toISOString())
        .lte('created_at', standardizedEnd.toISOString());
      
      // 2. Consulta basada en sale_date (adicional)
      let revenueQuerySaleDate = supabase
        .from('sales')
        .select('*')
        .eq('site_id', siteId)
        .eq('status', 'completed')
        .gte('sale_date', startDateStr || standardizedStart.toISOString().split('T')[0])
        .lte('sale_date', endDateStr || standardizedEnd.toISOString().split('T')[0]);
      
      // Aplicar filtro de segmento si es necesario
      if (segmentId && segmentId !== 'all') {
        // Check if segment_id column exists in sales table
        const { data: salesColumns } = await supabase
          .from('sales')
          .select('segment_id')
          .limit(1)
          .maybeSingle();
        
        // If segment_id column exists, filter by it
        if (salesColumns && 'segment_id' in salesColumns) {
          revenueQueryCreatedAt = revenueQueryCreatedAt.eq('segment_id', segmentId);
          revenueQuerySaleDate = revenueQuerySaleDate.eq('segment_id', segmentId);
        } else {
          console.log('[LTV API] Warning: Could not filter sales by segment_id as column doesn\'t exist');
        }
      }
      
      // Ejecutar ambas consultas
      const [createdAtResult, saleDateResult]: [QueryResult<SaleRow[]>, QueryResult<SaleRow[]>] = await Promise.all([
        revenueQueryCreatedAt,
        revenueQuerySaleDate
      ]);
      
      const revenueByCreatedAt = createdAtResult.data || [];
      const revenueBySaleDate = saleDateResult.data || [];
      
      console.log(`[LTV API] Ventas encontradas por created_at: ${revenueByCreatedAt.length}, por sale_date: ${revenueBySaleDate.length}`);
      
      // Usar el conjunto que tenga más resultados, o combinarlos evitando duplicados
      let revenue: SaleRow[] = [];
      
      if (revenueByCreatedAt.length >= revenueBySaleDate.length) {
        revenue = revenueByCreatedAt;
        console.log('[LTV API] Usando resultados de consulta por created_at');
      } else {
        revenue = revenueBySaleDate;
        console.log('[LTV API] Usando resultados de consulta por sale_date');
      }
      
      // Debug sales data
      if (revenue && revenue.length > 0) {
        console.log(`[LTV API] Found ${revenue.length} sales records with date filter`);
        console.log(`[LTV API] First sale example:`, JSON.stringify(revenue[0]));
      } else {
        console.log(`[LTV API] No sales found for the period with any date filter`);
      }
      
      const revenueError = createdAtResult.error || saleDateResult.error;
      
      if (!revenueError && revenue && revenue.length > 0) {
        const totalRevenue = revenue.reduce((sum, sale) => sum + (parseFloat(sale.amount?.toString() || '0')), 0);
        
        // If we have converted leads but no purchases, use revenue
        if (convertedLeads && convertedLeads.length > 0) {
          ltvValue = Math.round(totalRevenue / convertedLeads.length);
          hasRealData = true;
          console.log(`[LTV API] Approximated LTV using revenue and converted leads: $${ltvValue} (using revenue: $${totalRevenue}, converted leads: ${convertedLeads.length})`);
        } else {
          // If we have sales but no converted leads, we'll use a different approach
          // First, try to count unique customers (lead_ids) from sales
          const uniqueCustomerIds = new Set();
          let salesWithLeadId = 0;
          
          revenue.forEach((sale: any) => {
            // Log para ver la estructura de cada venta y si tiene lead_id
            if (sale.lead_id) {
              uniqueCustomerIds.add(sale.lead_id);
              salesWithLeadId++;
            }
          });
          
          console.log(`[LTV API] Found ${salesWithLeadId} sales with lead_id out of ${revenue.length} total sales`);
          
          const uniqueCustomerCount = uniqueCustomerIds.size;
          
          if (uniqueCustomerCount > 0) {
            ltvValue = Math.round(totalRevenue / uniqueCustomerCount);
            hasRealData = true;
            console.log(`[LTV API] Approximated LTV using revenue and unique customers: $${ltvValue} (revenue: $${totalRevenue}, unique customers: ${uniqueCustomerCount})`);
          } else {
            // If we can't identify unique customers, use total sales count
            ltvValue = Math.round(totalRevenue / revenue.length);
            hasRealData = true;
            console.log(`[LTV API] Approximated LTV using revenue and sales count: $${ltvValue} (revenue: $${totalRevenue}, sales count: ${revenue.length})`);
          }
        }
      } else if (revenueError) {
        console.error('[LTV API] Error fetching sales:', revenueError);
      }
    }
    
    let { percentChange } = await comparePreviousPeriod({
      supabase, siteId, userId, segmentId, skipKpiCreation, standardizedStart, standardizedEnd, standardizedPrevStart, standardizedPrevEnd, hasRealData, ltvValue
    });

    // Return no data if there's no real data
    if (!hasRealData) {
      return NextResponse.json({
        actual: 0,
        currency: "USD",
        percentChange: 0,
        periodType,
        noData: true,
        details: {
          purchaseTasksCount: 0,
          convertedLeadsCount: 0
        }
      });
    }
    
    const responseData = {
      actual: ltvValue,
      currency: "USD",
      percentChange,
      periodType,
      details: {
        purchaseTasksCount: purchaseTasks?.length || 0,
        convertedLeadsCount: convertedLeads?.length || 0,
        salesWithLeadsCount: salesWithLeads?.length || 0,
        dataSource: hasRealData ? 
          (purchaseTasks?.length ? 'purchase_tasks' : 
           (salesWithLeads?.length ? 'sales_with_leads' : 'revenue')) : 'none'
      }
    };
    
    console.log('[LTV API] Response data:', responseData);
    console.log('[LTV API] Final LTV value type:', typeof ltvValue, 'value:', ltvValue);
    
    // Verificar que el valor final es un número válido
    if (typeof ltvValue !== 'number' || isNaN(ltvValue)) {
      console.error('[LTV API] Invalid LTV value detected, defaulting to 0');
      responseData.actual = 0;
    }
    
    // Return the LTV data
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('[LTV API] Error calculating LTV:', error);
    return NextResponse.json({ 
      error: 'Failed to calculate LTV',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 