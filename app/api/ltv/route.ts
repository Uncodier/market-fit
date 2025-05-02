import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
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
      .single();
    
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
      .single();
    
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
  const cookieStore = cookies();
  // Usar el cliente de servicio con permisos elevados para evitar restricciones RLS
  const supabase = createServiceApiClient();
  
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const userId = searchParams.get('userId');
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');
  const skipKpiCreation = searchParams.get('skipKpiCreation') === 'true';
  const segmentId = searchParams.get('segmentId');
  
  // Validate required parameters
  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }
  
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
    const { data: allSales, error: allSalesError } = await supabase
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
      const { data: segmentLeads } = await supabase
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
    
    const { data: purchaseTasks, error: tasksError } = await purchaseTasksQuery;
    
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
    
    const { data: convertedLeads, error: leadsError } = await leadsQuery;
    
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
    
    const { data: salesWithLeads, error: salesError } = await salesWithLeadsQuery;
    
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
      const [createdAtResult, saleDateResult] = await Promise.all([
        revenueQueryCreatedAt,
        revenueQuerySaleDate
      ]);
      
      const revenueByCreatedAt = createdAtResult.data || [];
      const revenueBySaleDate = saleDateResult.data || [];
      
      console.log(`[LTV API] Ventas encontradas por created_at: ${revenueByCreatedAt.length}, por sale_date: ${revenueBySaleDate.length}`);
      
      // Usar el conjunto que tenga más resultados, o combinarlos evitando duplicados
      let revenue: any[] = [];
      
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
        const totalRevenue = revenue.reduce((sum: number, sale: any) => sum + (parseFloat(sale.amount?.toString() || '0')), 0);
        
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
          const { data: prevSegmentLeads } = await supabase
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
        
        const { data: prevPurchaseTasks } = await prevPurchaseTasksQuery;
        
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
        
        const { data: prevConvertedLeads } = await prevLeadsQuery;
        
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