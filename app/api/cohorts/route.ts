import { NextResponse } from "next/server";
import { format, subDays, format as formatDate } from "date-fns";
import { createServiceApiClient } from "@/lib/supabase/server-client";
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access";
import {
  normalizedRequestCacheKey,
  readThroughJsonCache,
} from "@/lib/redis/json-cache";

function analyticsAccessRequest(request: Request) {
  const url = new URL(request.url);
  const endValue = url.searchParams.get("endDate");
  const endDate = endValue ? new Date(endValue) : new Date();

  if (!endValue) url.searchParams.set("endDate", endDate.toISOString());
  if (!url.searchParams.has("startDate")) {
    const startDate = new Date(
      (Number.isFinite(endDate.getTime()) ? endDate : new Date()).getTime()
        - 30 * 24 * 60 * 60 * 1000
    );
    url.searchParams.set("startDate", startDate.toISOString());
  }

  return new Request(url, { headers: request.headers });
}

async function withAnalyticsCache(
  request: Request,
  namespace: string,
  load: (request: Request) => Promise<Response>
) {
  const scopedRequest = analyticsAccessRequest(request);
  const access = await requireAnalyticsAccess(scopedRequest);
  if (access.error) return access.error;

  try {
    const key = await normalizedRequestCacheKey(namespace, request);
    const result = await readThroughJsonCache({
      key,
      ttlSeconds: 45,
      compute: async () => {
        const response = await load(scopedRequest);
        if (!response.ok) throw response;
        return {
          body: await response.json(),
          headers: Object.fromEntries(response.headers.entries()),
        };
      },
    });

    if (result.status === "busy") {
      return NextResponse.json(
        { error: "Analytics are being refreshed" },
        { status: 503, headers: { "Retry-After": "2" } }
      );
    }

    const headers = new Headers(result.value.headers);
    headers.set("X-Cache", result.status.toUpperCase());
    return NextResponse.json(result.value.body, { headers });
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

interface SegmentDetails {
  id: string;
  name: string;
  audience?: string;
  engagement?: number;
  icp?: any;
  is_active?: boolean;
}

// Función para obtener datos específicos del segmento
async function getSegmentDetails(supabase: any, segmentId: string): Promise<SegmentDetails | null> {
  try {
    const { data, error } = await supabase
      .from("segments")
      .select("id, name, audience, engagement, icp, is_active")
      .eq("id", segmentId)
      .maybeSingle();
      
    if (error || !data) {
      console.error(`[getSegmentDetails] Error fetching segment ${segmentId}:`, error);
      return null;
    }
    
    console.log(`[Cohorts API] Found segment: ${data.name}`);
    return data;
  } catch (error) {
    console.error("Error fetching segment details:", error);
    return null;
  }
}

// Función para verificar que un segmento existe y pertenece al sitio
async function verifySegmentForSite(supabase: any, segmentId: string, siteId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("segments")
      .select("id")
      .eq("id", segmentId)
      .eq("site_id", siteId)
      .eq("is_active", true)
      .maybeSingle();
      
    return !error && data != null;
  } catch (error) {
    console.error(`Error verifying segment ${segmentId} for site ${siteId}:`, error);
    return false;
  }
}

async function getCohorts(request: Request) {
  const { searchParams } = new URL(request.url);
  const segmentId = searchParams.get("segmentId");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  if (!siteId) {
    console.error("[Cohorts API] Missing site ID");
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }

  
  try {
    console.log(`[Cohorts API] Received request for site: ${siteId}, segment: ${segmentId || 'all'}`);
    const supabase = createServiceApiClient(siteId);
    
    const { data: siteData, error: siteError } = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .maybeSingle();
      
    if (siteError || !siteData) {
      console.error(`[Cohorts API] Site not found: ${siteId}`, siteError);
      return NextResponse.json({ salesCohorts: [], usageCohorts: [] });
    }
    
    console.log(`[Cohorts API] Site found: ${siteId}`);
    
    const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    let salesQuery = supabase
      .from("sales")
      .select("id, lead_id, created_at, amount")
      .eq("site_id", siteId);
      
    if (startDateParam) {
      salesQuery = salesQuery.gte("created_at", startDate.toISOString());
    }
    if (endDateParam) {
      salesQuery = salesQuery.lte("created_at", endDate.toISOString());
    }
    
    const { data: salesData, error: salesError } = await salesQuery.limit(100);
    
    if (salesError) {
      console.error(`[Cohorts API] Error al verificar ventas:`, salesError);
      return NextResponse.json(
        { salesCohorts: [], usageCohorts: [] },
        { status: 500 }
      );
    }
    
    if (!salesData || salesData.length === 0) {
      console.log(`[Cohorts API] No hay ventas para el período especificado`);
      return NextResponse.json({ salesCohorts: [], usageCohorts: [] });
    }
    
    console.log(`[Cohorts API] Encontradas ${salesData.length} ventas para el sitio`);
    
    for (const sale of salesData) {
      if (!sale.lead_id) {
        sale.lead_id = "anonymous_lead";
      }
    }
    
    const salesWithoutLead = salesData.filter(sale => sale.lead_id === "anonymous_lead").length;
    const hasAnonymousLeads = salesWithoutLead > 0;
    
    if (segmentId && segmentId !== "all") {
      const isValidSegment = await verifySegmentForSite(supabase, segmentId, siteId);
      if (!isValidSegment) {
        console.log(`[Cohorts API] Segment ${segmentId} not found or not valid for site ${siteId}`);
        
        if (!hasAnonymousLeads) {
          return NextResponse.json({ salesCohorts: [], usageCohorts: [] });
        }
      }
    }
    
    if (segmentId && segmentId !== "all") {
      console.log(`[Cohorts API] Fetching segment details: ${segmentId}`);
      const segmentDetails = await getSegmentDetails(supabase, segmentId);
      
      if (!segmentDetails) {
        console.log(`[Cohorts API] Segment not found: ${segmentId}`);
        
        if (!hasAnonymousLeads) {
          return NextResponse.json({ salesCohorts: [], usageCohorts: [] });
        }
      }
    }
    
    const now = new Date();
    
    let cohortPeriods: { cohort: string, date: Date }[] = [];
    
    const formatPeriod = (date: Date) => {
      return `W${formatDate(date, "w")} ${formatDate(date, "yyyy")}`;
    };

    for (let i = 0; i < 8; i++) {
      const date = subDays(now, i * 7); // Always weekly intervals
      
      cohortPeriods.push({
        cohort: formatPeriod(date),
        date
      });
    }

    console.log(`[Cohorts API] Generated ${cohortPeriods.length} cohort periods: ${cohortPeriods.map(p => p.cohort).join(', ')}`);

    // Organizar las ventas por periodo y por lead
    const salesByPeriod = new Map<string, Set<string>>();

    // Para cada periodo, guardamos el conjunto de leads que compraron
    for (const sale of salesData) {
      const saleDate = new Date(sale.created_at);
      // Always use weekly period format for cohorts
      const periodKey = `W${formatDate(saleDate, "w")} ${formatDate(saleDate, "yyyy")}`;

      if (!salesByPeriod.has(periodKey)) {
        salesByPeriod.set(periodKey, new Set<string>());
      }

      const leadSet = salesByPeriod.get(periodKey)!;
      leadSet.add(sale.lead_id);
    }
    
    // Registro de los periodos con ventas
    const periodsWithSales = Array.from(salesByPeriod.keys());
    console.log(`[Cohorts API] Periodos con ventas: ${periodsWithSales.join(', ')}`);
    
    // Calcular la retención real para cada cohorte
    const salesCohorts = cohortPeriods.map((cohort, cohortIndex) => {
      const cohortKey = cohort.cohort;
      const hasDataForPeriod = salesByPeriod.has(cohortKey);
      
      // Si no hay datos para este periodo de cohorte, todos los valores son 0
      if (!hasDataForPeriod) {
        return {
          cohort: cohortKey,
          periods: Array(cohortIndex + 1).fill(0).map((_, i) => i === 0 ? null : 0)
        };
      }
      
      // Conjunto de leads que compraron en el periodo de cohorte
      const cohortLeads = salesByPeriod.get(cohortKey)!;
      const originalCount = cohortLeads.size;
      
      // Para cada periodo posterior, calcular cuántos leads repitieron
      // Older cohorts (higher cohortIndex) should show more periods of retention data
      const periods = Array.from({ length: cohortIndex + 1 }).map((_, periodIndex) => {
        // Primer valor siempre es 100% para el periodo 0 (el periodo de cohorte mismo)
        if (periodIndex === 0) return 100;
        
        // Para los periodos posteriores, necesitamos ver cuál corresponde
        const futurePeriodIndex = cohortIndex - periodIndex;
        if (futurePeriodIndex < 0) {
          // Si estamos fuera del rango de datos, no hay retención (0%)
          return 0;
        }
        
        const futurePeriod = cohortPeriods[futurePeriodIndex].cohort;
        if (!salesByPeriod.has(futurePeriod)) {
          // Si no hay ventas en el periodo futuro, la retención es 0%
          return 0;
        }
        
        // Conjunto de leads que compraron en el periodo futuro
        const futureLeads = salesByPeriod.get(futurePeriod)!;
        
        // Contar cuántos leads de la cohorte original compraron también en el periodo futuro
        let repeatingLeads = 0;
        cohortLeads.forEach(lead => {
          if (futureLeads.has(lead)) {
            repeatingLeads++;
          }
        });
        
        // Calcular el porcentaje de retención
        return originalCount > 0 ? Math.round((repeatingLeads / originalCount) * 100) : 0;
      });
      
      return {
        cohort: cohortKey,
        periods
      };
    }).filter(cohort => periodsWithSales.includes(cohort.cohort) || cohort.periods.some(p => p !== null && p > 0));
    
    // USAGE COHORTS: medir si los usuarios con al menos 1 factura pagada regresaron a USAR el sitio
    // NUEVO APPROACH: Leads que compraron -> buscar todos sus eventos
    
    let usageCohorts: any[] = [];
    
    // Paso 1: Obtener todos los lead_ids únicos que tienen ventas
    const leadsWithSales = Array.from(new Set(salesData.map(sale => sale.lead_id).filter(id => id && id !== "anonymous_lead")));
    console.log(`[Cohorts API] Leads únicos con ventas: ${leadsWithSales.length}`, leadsWithSales);
    
    if (leadsWithSales.length === 0) {
      console.log(`[Cohorts API] No hay leads con ventas, usando fallback`);
      usageCohorts = JSON.parse(JSON.stringify(salesCohorts));
    } else {
      // Paso 2: Primero obtener visitor_sessions para conseguir visitor_ids de los leads con ventas
      console.log(`[Cohorts API] Buscando visitor_sessions para leads con ventas...`);
      
      const { data: visitorSessions, error: visitorSessionsError } = await supabase
        .from("visitor_sessions")
        .select("visitor_id, lead_id, started_at")
        .eq("site_id", siteId)
        .in("lead_id", leadsWithSales)
        .not("visitor_id", "is", null);
        
      if (visitorSessionsError) {
        console.error(`[Cohorts API] Error al obtener visitor_sessions:`, visitorSessionsError);
        usageCohorts = JSON.parse(JSON.stringify(salesCohorts));
      } else {
        console.log(`[Cohorts API] Encontradas ${visitorSessions?.length || 0} visitor_sessions para leads con ventas`);
        
        // Extraer visitor_ids únicos
        const visitorIds = Array.from(new Set(visitorSessions?.map(vs => vs.visitor_id) || []));
        console.log(`[Cohorts API] Visitor_ids únicos encontrados: ${visitorIds.length}`);
        
        if (visitorIds.length === 0) {
          console.log(`[Cohorts API] No se encontraron visitor_ids, usando fallback`);
          usageCohorts = JSON.parse(JSON.stringify(salesCohorts));
        } else {
          // Paso 3: Buscar eventos de page view para estos visitor_ids
          let sessionsQuery = supabase
            .from("session_events")
            .select("visitor_id, created_at, event_type")
            .eq("site_id", siteId)
            .eq("event_type", "pageview")
            .in("visitor_id", visitorIds)
            .order("created_at", { ascending: false });
            
          const { data: allSessionsData, error: sessionsError } = await sessionsQuery.limit(10000);
          
          if (sessionsError) {
            console.error(`[Cohorts API] Error al obtener eventos de page view:`, sessionsError);
            usageCohorts = JSON.parse(JSON.stringify(salesCohorts));
          } else {
            console.log(`[Cohorts API] Encontrados ${allSessionsData?.length || 0} eventos de page view para visitor_ids`);
            
            // Crear mapeo visitor_id -> lead_id para asociar eventos con leads
            const visitorToLead = new Map<string, string>();
            visitorSessions?.forEach(vs => {
              if (vs.visitor_id && vs.lead_id) {
                visitorToLead.set(vs.visitor_id, vs.lead_id);
              }
            });
            
            // Organizar TODOS los eventos por lead_id y fecha
            const sessionsByUserAndWeek = new Map<string, Set<string>>();
            
            if (allSessionsData && allSessionsData.length > 0) {
              for (const event of allSessionsData) {
                const leadId = visitorToLead.get(event.visitor_id);
                if (!leadId) continue; // Skip si no podemos mapear a lead_id
                
                const eventDate = new Date(event.created_at);
                const weekKey = `W${formatDate(eventDate, "w")} ${formatDate(eventDate, "yyyy")}`;
                
                if (!sessionsByUserAndWeek.has(leadId)) {
                  sessionsByUserAndWeek.set(leadId, new Set<string>());
                }
                
                sessionsByUserAndWeek.get(leadId)!.add(weekKey);
              }
            }
            
            // Calcular usage cohorts: usuarios que compraron en semana X -> ¿tuvieron eventos en semanas X+1, X+2, etc.?
            usageCohorts = cohortPeriods.map((cohort, cohortIndex) => {
              const cohortKey = cohort.cohort;
              const hasDataForPeriod = salesByPeriod.has(cohortKey);
              
              // Si no hay ventas para este periodo de cohorte, todos los valores son 0
              if (!hasDataForPeriod) {
                return {
                  cohort: cohortKey,
                  periods: Array(cohortIndex + 1).fill(0).map((_, i) => i === 0 ? null : 0)
                };
              }
              
              // Conjunto de leads que compraron en el periodo de cohorte (base del cohort)
              const cohortLeads = salesByPeriod.get(cohortKey)!;
              const originalCount = cohortLeads.size;
              
              // Para cada semana posterior, calcular cuántos del cohort original tuvieron EVENTOS
              const periods = Array.from({ length: cohortIndex + 1 }).map((_, periodIndex) => {
                // Primer valor siempre es 100% para el periodo 0 (semana de compra)
                if (periodIndex === 0) return 100;
                
                // Calcular qué semana estamos evaluando
                const weeksAfterPurchase = periodIndex;
                const futureWeekIndex = cohortIndex - weeksAfterPurchase;
                
                if (futureWeekIndex < 0) {
                  // Si estamos fuera del rango temporal, no hay datos
                  return 0;
                }
                
                const futureWeek = cohortPeriods[futureWeekIndex].cohort;
                
                // Contar cuántos usuarios del cohort original tuvieron eventos en esta semana futura
                let usersWithEvents = 0;
                
                cohortLeads.forEach(leadId => {
                  const userWeeks = sessionsByUserAndWeek.get(leadId);
                  if (userWeeks && userWeeks.has(futureWeek)) {
                    usersWithEvents++;
                  }
                });
                
                // Calcular el porcentaje de retención de USO
                const retentionRate = originalCount > 0 ? Math.round((usersWithEvents / originalCount) * 100) : 0;
                
                console.log(`[Cohorts API] Usage cohort ${cohortKey}, semana +${weeksAfterPurchase} (${futureWeek}): ${usersWithEvents}/${originalCount} usuarios activos (${retentionRate}%)`);
                
                return retentionRate;
              });
              
              return {
                cohort: cohortKey,
                periods
              };
            }).filter(cohort => periodsWithSales.includes(cohort.cohort) || cohort.periods.some(p => p !== null && p > 0));
          }
        }
      }
    }
    
    interface CohortWithPeriods {
      cohort: string;
      periods: (number | null)[];
    }
    
    interface CohortWithWeeks {
      cohort: string;
      weeks: (number | null)[];
    }
    
    const finalSalesCohorts = salesCohorts.map((cohort: CohortWithPeriods): CohortWithWeeks => ({
      cohort: cohort.cohort,
      weeks: cohort.periods
    }));
    
    const finalUsageCohorts = usageCohorts.map((cohort: CohortWithPeriods): CohortWithWeeks => ({
      cohort: cohort.cohort,
      weeks: cohort.periods
    }));
    
    console.log(`[Cohorts API] Period: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);
    console.log(`[Cohorts API] Returning sales cohorts: ${finalSalesCohorts.length}, usage cohorts: ${finalUsageCohorts.length}`);
    
    if (hasAnonymousLeads) {
      console.log(`[Cohorts API] Ventas sin lead_id asignadas a anonymous_lead e incluidas en cohortes por fecha`);
      
      const periodsWithAnonymousData = periodsWithSales.join(', ');
      console.log(`[Cohorts API] Periodos que incluyen ventas anónimas: ${periodsWithAnonymousData}`);
    }
    
    return NextResponse.json({ 
      salesCohorts: finalSalesCohorts, 
      usageCohorts: finalUsageCohorts 
    });
  } catch (error) {
    console.error("Error in cohorts API:", error);
    
    console.log("[Cohorts API] Returning empty data due to error");
    return NextResponse.json(
      { salesCohorts: [], usageCohorts: [] },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return withAnalyticsCache(request, "cohorts", getCohorts);
}