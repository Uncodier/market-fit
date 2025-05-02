import { createApiClient } from "@/lib/supabase/server-client";
import { NextResponse } from "next/server";
import { format, subDays, startOfDay, endOfDay, endOfMonth, startOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, startOfWeek, endOfWeek } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { KpiData } from "@/app/types";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import crypto from "crypto";

// Helper function to determine period type based on date range
function determinePeriodType(startDate: Date, endDate: Date): string {
  const diffInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays <= 1) return "daily";
  if (diffInDays <= 7) return "weekly";
  if (diffInDays <= 31) return "monthly";
  if (diffInDays <= 92) return "quarterly";
  if (diffInDays <= 366) return "yearly";
  return "custom";
}

// Helper function to normalize date to start of day - removes time component
function normalizeDate(date: Date): Date {
  return startOfDay(date);
}

// Helper function to standardize period dates based on period type
function standardizePeriodDates(startDate: Date, endDate: Date): { periodStart: Date, periodEnd: Date, periodType: string } {
  // First determine the period type
  const periodType = determinePeriodType(startDate, endDate);
  let periodStart = startDate;
  let periodEnd = endDate;
  
  // Standardize dates based on period type for consistent KPI creation
  switch (periodType) {
    case "daily":
      // Keep as is, already normalized to start of day
      break;
    case "weekly":
      periodStart = startOfWeek(startDate, { weekStartsOn: 1 }); // Start on Monday
      periodEnd = endOfWeek(endDate, { weekStartsOn: 1 }); // End on Sunday
      break;
    case "monthly":
      periodStart = startOfMonth(startDate);
      periodEnd = endOfMonth(endDate);
      break;
    case "quarterly":
      periodStart = startOfQuarter(startDate);
      periodEnd = endOfQuarter(endDate);
      break;
    case "yearly":
      periodStart = startOfYear(startDate);
      periodEnd = endOfYear(endDate);
      break;
    default:
      // For custom periods, keep as is
      break;
  }
  
  return { periodStart, periodEnd, periodType };
}

// Helper function to get previous period dates
function getPreviousPeriodDates(startDate: Date, endDate: Date): { prevStart: Date, prevEnd: Date } {
  const diffInDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const prevEnd = new Date(startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - diffInDays + 1);
  
  // Normalize both dates to start of day to avoid millisecond differences
  return { 
    prevStart: normalizeDate(prevStart), 
    prevEnd: normalizeDate(prevEnd) 
  };
}

// Helper function to calculate trend percentage
function calculateTrend(currentValue: number, previousValue: number): number {
  if (previousValue === 0) return currentValue > 0 ? 100 : 0;
  return parseFloat(((currentValue - previousValue) / previousValue * 100).toFixed(2));
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
  const segmentPart = kpiParams.segmentId && kpiParams.segmentId !== "all" 
    ? kpiParams.segmentId 
    : "00000000-0000-0000-0000-000000000000";
  
  const idBase = `${kpiParams.type}:${kpiParams.name}:${kpiParams.siteId}:${formattedStart}:${formattedEnd}:${segmentPart}`;
  
  // Create a consistent UUID v5 from the string (using a namespace UUID)
  // This creates a deterministic UUID that will be the same for identical parameters
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
  
  // Build query to find existing KPI by attributes (not using the deterministic ID yet)
  let query = supabase
    .from("kpis")
    .select("*")
    .match(queryParams);
    
  // Handle segment ID specifically
  if (kpiParams.segmentId && kpiParams.segmentId !== "all") {
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
      unit: "count",
      type: kpiParams.type,
      period_start: formattedStart,
      period_end: formattedEnd,
      segment_id: kpiParams.segmentId !== "all" ? kpiParams.segmentId : null,
      is_highlighted: true,
      target_value: null,
      metadata: {
        period_type: periodType
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

// Format date consistently for database storage
function formatDateForDb(date: Date): string {
  // Format to exactly match '2025-03-11 06:00:00+00' pattern
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+00`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const segmentId = searchParams.get("segmentId");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  const userId = searchParams.get("userId");
  const skipKpiCreation = searchParams.get("skipKpiCreation") === "true";
  
  if (!siteId) {
    return NextResponse.json(
      {
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      },
      { status: 400 }
    );
  }

  // Normalize dates to eliminate time component
  const startDate = normalizeDate(startDateParam ? new Date(startDateParam) : subDays(new Date(), 30));
  const endDate = normalizeDate(endDateParam ? new Date(endDateParam) : new Date());
  
  // Standardize dates for the period type
  const { periodStart, periodEnd, periodType } = standardizePeriodDates(startDate, endDate);
  
  // Calculate previous period based on standardized dates
  const diffInDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const prevEnd = new Date(periodStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - diffInDays + 1);
  
  // Standardize previous period dates too
  const { periodStart: standardizedPrevStart, periodEnd: standardizedPrevEnd } = standardizePeriodDates(prevStart, prevEnd);
  
  try {
    // Use regular client for reading data
    const supabase = createApiClient();
    
    // Create admin client for writing data
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // First get previous period value - either from KPI or calculated
    let previousValue = 0;
    
    // Try to find existing KPI for previous period, or create it if needed
    if (userId && !skipKpiCreation) {
      // Only try to find or create KPI if we have a userId and not skipping KPI creation
      const { kpi: prevKpi } = await findOrCreateKpi(
        supabase,
        supabaseAdmin,
        {
          siteId,
          userId,
          segmentId,
          periodStart: standardizedPrevStart,
          periodEnd: standardizedPrevEnd,
          type: "engagement",
          name: "Active Users",
          value: 0, // This will be updated if we need to create
          previousValue: undefined
        }
      );
      
      if (prevKpi) {
        // If we found an existing KPI, use its value
        previousValue = prevKpi.value;
      } else {
        // Calculate previous period value
        const prevUsersQuery = await fetchPreviousPeriodActiveUsers(
          supabase,
          siteId,
          segmentId,
          standardizedPrevStart, 
          standardizedPrevEnd
        );
        
        // If we successfully calculated a value, create the KPI only once
        if (prevUsersQuery.value !== null) {
          previousValue = prevUsersQuery.value;
          
          // Try creating the KPI again with the calculated value
          await findOrCreateKpi(
            supabase,
            supabaseAdmin,
            {
              siteId,
              userId,
              segmentId,
              periodStart: standardizedPrevStart,
              periodEnd: standardizedPrevEnd,
              type: "engagement",
              name: "Active Users",
              value: previousValue,
              previousValue: undefined
            }
          );
        }
      }
      
      // Create current period KPI if it doesn't exist already
      const currentUsersQuery = await fetchCurrentPeriodActiveUsers(
        supabase,
        siteId,
        segmentId,
        periodStart,
        periodEnd
      );
      
      const currentValue = currentUsersQuery.value || 0;
      
      // Check if we have actual data for the requested period
      const hasRealData = currentValue > 0 || currentUsersQuery.hasEvidence;
      
      // If we don't have real data, return zeroes
      if (!hasRealData) {
        return NextResponse.json({
          actual: 0,
          percentChange: 0,
          periodType,
          noData: true
        });
      }
      
      // Store current period KPI only if we have data for it
      if (hasRealData) {
        await findOrCreateKpi(
          supabase,
          supabaseAdmin,
          {
            siteId,
            userId,
            segmentId,
            periodStart: periodStart,
            periodEnd: periodEnd,
            type: "engagement",
            name: "Active Users",
            value: currentValue,
            previousValue
          }
        );
      }
      
      // Calculate trend
      const trend = calculateTrend(currentValue, previousValue);
      
      // Return the active users data
      const activeUsers = {
        actual: currentValue,
        percentChange: trend,
        periodType
      };
      
      return NextResponse.json(activeUsers);
    } else {
      // If no userId or skipping KPI creation, just calculate the values
      const prevUsersQuery = await fetchPreviousPeriodActiveUsers(
        supabase,
        siteId,
        segmentId,
        standardizedPrevStart, 
        standardizedPrevEnd
      );
      
      if (prevUsersQuery.value !== null) {
        previousValue = prevUsersQuery.value;
      }
      
      // Now calculate current period value (always dynamic)
      const currentUsersQuery = await fetchCurrentPeriodActiveUsers(
        supabase,
        siteId,
        segmentId,
        periodStart,
        periodEnd
      );
      
      const currentValue = currentUsersQuery.value || 0;
      
      // Check if we have actual data for the requested period
      const hasRealData = currentValue > 0 || currentUsersQuery.hasEvidence;
      
      // If we don't have real data, return zeroes
      if (!hasRealData) {
        return NextResponse.json({
          actual: 0,
          percentChange: 0,
          periodType,
          noData: true
        });
      }
      
      // Calculate trend
      const trend = calculateTrend(currentValue, previousValue);
      
      // Return the active users data without saving KPIs
      const activeUsers = {
        actual: currentValue,
        percentChange: trend,
        periodType
      };
      
      return NextResponse.json(activeUsers);
    }
  } catch (error) {
    console.error("Error in active users API:", error);
    return NextResponse.json(
      {
        actual: 0,
        percentChange: 0,
        periodType: "monthly"
      },
      { status: 500 }
    );
  }
}

// Helper function to fetch previous period active users
async function fetchPreviousPeriodActiveUsers(
  supabase: any,
  siteId: string,
  segmentId: string | null,
  startDate: Date,
  endDate: Date
): Promise<{ value: number | null, error: any, hasEvidence: boolean }> {
  try {
    console.log("[ActiveUsersAPI] Fetching previous period data from:", format(startDate, "yyyy-MM-dd"), "to:", format(endDate, "yyyy-MM-dd"));

    // Set para almacenar IDs de leads únicos
    const uniqueLeadIds = new Set<string>();
    // Variable para contar ventas anónimas (sin lead_id)
    let anonymousSalesCount = 0;

    // 1. Primero obtenemos los visitor_id de las sesiones (sin filtrar por segment)
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("session_events")
      .select("visitor_id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endOfDay(endDate), "yyyy-MM-dd'T'23:59:59.999'Z'"))
      .limit(10000);
    
    if (sessionsError) {
      console.error("Error fetching previous period sessions:", sessionsError);
      return { value: null, error: sessionsError, hasEvidence: false };
    }
    
    // Recolectar visitor_ids únicos
    const uniqueVisitorIds = new Set<string>();
    sessionsData?.forEach((session: { visitor_id?: string }) => {
      if (session.visitor_id) {
        uniqueVisitorIds.add(session.visitor_id);
      }
    });
    
    console.log("[ActiveUsersAPI] Found unique visitors from sessions:", uniqueVisitorIds.size);
    
    // Si hay visitors, obtenemos los leads asociados
    if (uniqueVisitorIds.size > 0) {
      // Convertir el Set en un array para la consulta
      const visitorIdsArray = Array.from(uniqueVisitorIds);
      
      // Obtenemos los leads asociados a esos visitors
      const { data: visitorData, error: visitorError } = await supabase
        .from("visitors")
        .select("lead_id")
        .in("id", visitorIdsArray)
        .not("lead_id", "is", null);
      
      if (visitorError) {
        console.error("Error fetching visitor leads:", visitorError);
        return { value: null, error: visitorError, hasEvidence: uniqueVisitorIds.size > 0 };
      }
      
      // Agregar lead_ids de visitors a nuestro Set de leads únicos
      visitorData?.forEach((visitor: { lead_id?: string }) => {
        if (visitor.lead_id) {
          uniqueLeadIds.add(visitor.lead_id);
        }
      });
      
      console.log("[ActiveUsersAPI] Found unique leads from visitors:", uniqueLeadIds.size);
    }
    
    // 2. Obtenemos todas las ventas en el periodo seleccionado
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("lead_id, id")
      .eq("site_id", siteId)
      .eq("status", "completed")
      .gte("sale_date", format(startDate, "yyyy-MM-dd"))
      .lte("sale_date", format(endOfDay(endDate), "yyyy-MM-dd"));
    
    if (salesError) {
      console.error("Error fetching sales:", salesError);
      return { value: null, error: salesError, hasEvidence: uniqueVisitorIds.size > 0 };
    }
    
    // Determine if we have evidence of activity, even if values are 0
    const hasEvidence = (sessionsData && sessionsData.length > 0) || 
                        (salesData && salesData.length > 0);
    
    if (salesData && salesData.length > 0) {
      // Separamos ventas con lead_id de las anónimas
      const salesWithLeads = salesData.filter((sale: { lead_id?: string, id: string }) => sale.lead_id);
      
      // Solo contamos ventas anónimas si se solicita explícitamente datos de demostración
      anonymousSalesCount = 0;
      
      if (salesData.length - salesWithLeads.length > 0) {
        console.log("[ActiveUsersAPI] Ignoring anonymous sales (without lead_id):", salesData.length - salesWithLeads.length);
      }
      
      // Agregar lead_ids de ventas a nuestro Set de leads únicos
      salesWithLeads.forEach((sale: { lead_id?: string, id: string }) => {
        if (sale.lead_id) {
          uniqueLeadIds.add(sale.lead_id);
        }
      });
      
      console.log("[ActiveUsersAPI] Found unique leads from sales:", salesWithLeads.length);
      if (anonymousSalesCount > 0) {
        console.log("[ActiveUsersAPI] Counting anonymous sales (without lead_id):", anonymousSalesCount);
      }
    }
    
    console.log("[ActiveUsersAPI] Total combined unique leads:", uniqueLeadIds.size);
    
    // Si estamos filtrando por segmento, necesitamos verificar qué leads pertenecen a ese segmento
    if (segmentId && segmentId !== "all" && uniqueLeadIds.size > 0) {
      console.log("[ActiveUsersAPI] Filtering leads by segment:", segmentId);
      
      const leadIdsArray = Array.from(uniqueLeadIds);
      
      // Consultar qué leads están en el segmento especificado
      const { data: leadSegmentData, error: leadSegmentError } = await supabase
        .from("lead_segments")
        .select("lead_id")
        .in("lead_id", leadIdsArray)
        .eq("segment_id", segmentId);
      
      if (leadSegmentError) {
        console.error("Error fetching lead segments:", leadSegmentError);
        return { value: null, error: leadSegmentError, hasEvidence };
      }
      
      // Contar solo los leads que están en el segmento
      const segmentLeadIds = new Set<string>();
      leadSegmentData?.forEach((item: { lead_id: string }) => {
        if (item.lead_id) {
          segmentLeadIds.add(item.lead_id);
        }
      });
      
      console.log("[ActiveUsersAPI] Previous period unique leads in segment:", segmentLeadIds.size);
      
      // Cuando filtramos por segmento, no contamos ventas anónimas porque no podemos
      // saber si pertenecen a ese segmento
      return { value: segmentLeadIds.size, error: null, hasEvidence };
    }
    
    // Total de clientes: leads identificados + ventas anónimas
    const totalActiveClients = uniqueLeadIds.size + anonymousSalesCount;
    console.log("[ActiveUsersAPI] Previous period total active clients:", totalActiveClients);
    return { value: totalActiveClients, error: null, hasEvidence };
  } catch (err) {
    console.error("Exception fetching previous period active users:", err);
    return { value: null, error: err, hasEvidence: false };
  }
}

// Helper function to fetch current period active users
async function fetchCurrentPeriodActiveUsers(
  supabase: any,
  siteId: string,
  segmentId: string | null,
  startDate: Date,
  endDate: Date
): Promise<{ value: number | null, error: any, hasEvidence: boolean }> {
  try {
    console.log("[ActiveUsersAPI] Fetching current period data from:", format(startDate, "yyyy-MM-dd"), "to:", format(endDate, "yyyy-MM-dd"));

    // Set para almacenar IDs de leads únicos
    const uniqueLeadIds = new Set<string>();
    // Variable para contar ventas anónimas (sin lead_id)
    let anonymousSalesCount = 0;

    // 1. Primero obtenemos los visitor_id de las sesiones (sin filtrar por segment)
    const { data: sessionsData, error: sessionsError } = await supabase
      .from("session_events")
      .select("visitor_id, created_at")
      .eq("site_id", siteId)
      .gte("created_at", format(startDate, "yyyy-MM-dd"))
      .lte("created_at", format(endOfDay(endDate), "yyyy-MM-dd'T'23:59:59.999'Z'"))
      .limit(10000);
    
    if (sessionsError) {
      console.error("Error fetching current period sessions:", sessionsError);
      return { value: null, error: sessionsError, hasEvidence: false };
    }
    
    // Recolectar visitor_ids únicos
    const uniqueVisitorIds = new Set<string>();
    sessionsData?.forEach((session: { visitor_id?: string }) => {
      if (session.visitor_id) {
        uniqueVisitorIds.add(session.visitor_id);
      }
    });
    
    console.log("[ActiveUsersAPI] Found unique visitors from sessions:", uniqueVisitorIds.size);
    
    // Si hay visitors, obtenemos los leads asociados
    if (uniqueVisitorIds.size > 0) {
      // Convertir el Set en un array para la consulta
      const visitorIdsArray = Array.from(uniqueVisitorIds);
      
      // Obtenemos los leads asociados a esos visitors
      const { data: visitorData, error: visitorError } = await supabase
        .from("visitors")
        .select("lead_id")
        .in("id", visitorIdsArray)
        .not("lead_id", "is", null);
      
      if (visitorError) {
        console.error("Error fetching visitor leads:", visitorError);
        return { value: null, error: visitorError, hasEvidence: uniqueVisitorIds.size > 0 };
      }
      
      // Agregar lead_ids de visitors a nuestro Set de leads únicos
      visitorData?.forEach((visitor: { lead_id?: string }) => {
        if (visitor.lead_id) {
          uniqueLeadIds.add(visitor.lead_id);
        }
      });
      
      console.log("[ActiveUsersAPI] Found unique leads from visitors:", uniqueLeadIds.size);
    }
    
    // 2. Obtenemos todas las ventas en el periodo seleccionado
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("lead_id, id")
      .eq("site_id", siteId)
      .eq("status", "completed")
      .gte("sale_date", format(startDate, "yyyy-MM-dd"))
      .lte("sale_date", format(endOfDay(endDate), "yyyy-MM-dd"));
    
    if (salesError) {
      console.error("Error fetching sales:", salesError);
      return { value: null, error: salesError, hasEvidence: uniqueVisitorIds.size > 0 };
    }
    
    // Determine if we have evidence of activity, even if values are 0
    const hasEvidence = (sessionsData && sessionsData.length > 0) || 
                        (salesData && salesData.length > 0);
    
    if (salesData && salesData.length > 0) {
      // Separamos ventas con lead_id de las anónimas
      const salesWithLeads = salesData.filter((sale: { lead_id?: string, id: string }) => sale.lead_id);
      
      // Solo contamos ventas anónimas si se solicita explícitamente datos de demostración
      anonymousSalesCount = 0;
      
      if (salesData.length - salesWithLeads.length > 0) {
        console.log("[ActiveUsersAPI] Ignoring anonymous sales (without lead_id):", salesData.length - salesWithLeads.length);
      }
      
      // Agregar lead_ids de ventas a nuestro Set de leads únicos
      salesWithLeads.forEach((sale: { lead_id?: string, id: string }) => {
        if (sale.lead_id) {
          uniqueLeadIds.add(sale.lead_id);
        }
      });
      
      console.log("[ActiveUsersAPI] Found unique leads from sales:", salesWithLeads.length);
      if (anonymousSalesCount > 0) {
        console.log("[ActiveUsersAPI] Counting anonymous sales (without lead_id):", anonymousSalesCount);
      }
    }
    
    console.log("[ActiveUsersAPI] Total combined unique leads:", uniqueLeadIds.size);
    
    // Si estamos filtrando por segmento, necesitamos verificar qué leads pertenecen a ese segmento
    if (segmentId && segmentId !== "all" && uniqueLeadIds.size > 0) {
      console.log("[ActiveUsersAPI] Filtering leads by segment:", segmentId);
      
      const leadIdsArray = Array.from(uniqueLeadIds);
      
      // Consultar qué leads están en el segmento especificado
      const { data: leadSegmentData, error: leadSegmentError } = await supabase
        .from("lead_segments")
        .select("lead_id")
        .in("lead_id", leadIdsArray)
        .eq("segment_id", segmentId);
      
      if (leadSegmentError) {
        console.error("Error fetching lead segments:", leadSegmentError);
        return { value: null, error: leadSegmentError, hasEvidence };
      }
      
      // Contar solo los leads que están en el segmento
      const segmentLeadIds = new Set<string>();
      leadSegmentData?.forEach((item: { lead_id: string }) => {
        if (item.lead_id) {
          segmentLeadIds.add(item.lead_id);
        }
      });
      
      console.log("[ActiveUsersAPI] Current period unique leads in segment:", segmentLeadIds.size);
      
      // Cuando filtramos por segmento, no contamos ventas anónimas porque no podemos
      // saber si pertenecen a ese segmento
      return { value: segmentLeadIds.size, error: null, hasEvidence };
    }
    
    // Total de clientes: leads identificados + ventas anónimas
    const totalActiveClients = uniqueLeadIds.size + anonymousSalesCount;
    console.log("[ActiveUsersAPI] Current period total active clients:", totalActiveClients);
    return { value: totalActiveClients, error: null, hasEvidence };
  } catch (err) {
    console.error("Exception fetching current period active users:", err);
    return { value: null, error: err, hasEvidence: false };
  }
} 