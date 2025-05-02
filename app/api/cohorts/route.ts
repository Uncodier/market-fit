import { createApiClient } from "@/lib/supabase/server-client";
import { NextResponse } from "next/server";
import { format, subDays, subMonths, startOfMonth, format as formatDate } from "date-fns";
import { createServiceApiClient } from "@/lib/supabase/server-client";

// Función auxiliar para crear variación en datos de cohorte
function createVariation(baseValue: number, maxVariation: number, seed: number): number {
  const variation = (Math.sin(seed) + 1) * maxVariation - maxVariation / 2;
  return Math.round(Math.max(0, Math.min(100, baseValue + variation)));
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
      .single();
      
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
      .single();
      
    return !error && data != null;
  } catch (error) {
    console.error(`Error verifying segment ${segmentId} for site ${siteId}:`, error);
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const segmentId = searchParams.get("segmentId");
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  const userId = searchParams.get("userId");
  
  if (!siteId) {
    console.error("[Cohorts API] Missing site ID");
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }
  
  try {
    console.log(`[Cohorts API] Received request for site: ${siteId}, segment: ${segmentId || 'all'}`);
    // Usar el cliente con permisos de servicio
    const supabase = createServiceApiClient();
    
    // Verificar que el sitio existe antes de continuar
    const { data: siteData, error: siteError } = await supabase
      .from("sites")
      .select("id")
      .eq("id", siteId)
      .single();
      
    if (siteError || !siteData) {
      console.error(`[Cohorts API] Site not found: ${siteId}`, siteError);
      return NextResponse.json({ salesCohorts: [], usageCohorts: [] });
    }
    
    console.log(`[Cohorts API] Site found: ${siteId}`);
    
    // Parámetros para las fechas
    const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Determinar el periodo apropiado basado en el rango de fechas
    const daysDifference = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    let periodType = 'day';
    
    if (daysDifference > 180) {
      periodType = 'quarter'; // Trimestre para rangos mayores a 6 meses
    } else if (daysDifference > 60) {
      periodType = 'month'; // Mes para rangos mayores a 2 meses
    } else if (daysDifference > 14) {
      periodType = 'week'; // Semana para rangos mayores a 2 semanas
    } else {
      periodType = 'day'; // Día para rangos cortos
    }
    
    console.log(`[Cohorts API] Periodo determinado: ${periodType} basado en un rango de ${daysDifference} días`);
    
    // Comprobar si hay ventas sin lead_id asignado
    let salesQuery = supabase
      .from("sales")
      .select("id, lead_id, created_at, amount")
      .eq("site_id", siteId);
      
    // Aplicar filtros de fecha si están disponibles
    if (startDateParam) {
      salesQuery = salesQuery.gte("created_at", format(startDate, "yyyy-MM-dd"));
    }
    if (endDateParam) {
      salesQuery = salesQuery.lte("created_at", format(endDate, "yyyy-MM-dd"));
    }
    
    const { data: salesData, error: salesError } = await salesQuery.limit(100);
    
    if (salesError) {
      console.error(`[Cohorts API] Error al verificar ventas:`, salesError);
      return NextResponse.json({ salesCohorts: [], usageCohorts: [] });
    }
    
    if (!salesData || salesData.length === 0) {
      console.log(`[Cohorts API] No hay ventas para el período especificado`);
      return NextResponse.json({ salesCohorts: [], usageCohorts: [] });
    }
    
    console.log(`[Cohorts API] Encontradas ${salesData.length} ventas para el sitio`);
    
    // Verificar si hay ventas sin lead_id asignado y asignarlas a anonymous_lead
    for (const sale of salesData) {
      if (!sale.lead_id) {
        sale.lead_id = "anonymous_lead";
      }
    }
    
    const salesWithoutLead = salesData.filter(sale => sale.lead_id === "anonymous_lead").length;
    const hasAnonymousLeads = salesWithoutLead > 0;
    
    if (hasAnonymousLeads) {
      console.log(`[Cohorts API] Asignadas ${salesWithoutLead} ventas sin lead_id a "anonymous_lead"`);
      
      // Mostrar algunas ventas para debug
      if (salesData.length > 0) {
        const sampleSale = salesData.find(sale => sale.lead_id === "anonymous_lead");
        if (sampleSale) {
          console.log(`[Cohorts API] Ejemplo de venta anónima:`, sampleSale);
        }
      }
    }
    
    // Si se solicitó un segmento específico, verificamos que exista
    if (segmentId && segmentId !== "all") {
      // Verificar que el segmento pertenece al sitio
      const isValidSegment = await verifySegmentForSite(supabase, segmentId, siteId);
      if (!isValidSegment) {
        console.log(`[Cohorts API] Segment ${segmentId} not found or not valid for site ${siteId}`);
        
        // Si no es válido pero hay ventas sin lead, mostramos la cohorte Unassigned
        if (!hasAnonymousLeads) {
          return NextResponse.json({ salesCohorts: [], usageCohorts: [] });
        }
      }
    }
    
    // Obtener datos específicos del segmento si se ha seleccionado uno
    let segmentDetails = null;
    if (segmentId && segmentId !== "all") {
      // Obtener detalles del segmento
      console.log(`[Cohorts API] Fetching segment details: ${segmentId}`);
      segmentDetails = await getSegmentDetails(supabase, segmentId);
      
      if (!segmentDetails) {
        console.log(`[Cohorts API] Segment not found: ${segmentId}`);
        
        // Si no se encontró pero hay ventas sin lead, mostramos la cohorte Unassigned
        if (!hasAnonymousLeads) {
          return NextResponse.json({ salesCohorts: [], usageCohorts: [] });
        }
      }
    }
    
    // Generar cohortes con fechas actuales (últimos 8 meses)
    const cohortMonths: { cohort: string, date: Date }[] = [];
    const now = new Date();
    
    // Generar los periodos para el análisis de cohortes
    let cohortPeriods: { cohort: string, date: Date }[] = [];
    
    // Función para formatear el periodo según el tipo
    const formatPeriod = (date: Date) => {
      switch (periodType) {
        case 'day':
          return formatDate(date, "dd MMM");
        case 'week':
          return `W${formatDate(date, "w")} ${formatDate(date, "yyyy")}`;
        case 'month':
          return formatDate(date, "MMM yyyy");
        case 'quarter':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          return `Q${quarter} ${formatDate(date, "yyyy")}`;
        default:
          return formatDate(date, "MMM yyyy");
      }
    };
    
    // Generar periodos para los últimos 8 intervalos
    for (let i = 0; i < 8; i++) {
      let date;
      switch (periodType) {
        case 'day':
          date = subDays(now, i);
          break;
        case 'week':
          date = subDays(now, i * 7);
          break;
        case 'month':
          date = subMonths(now, i);
          break;
        case 'quarter':
          date = subMonths(now, i * 3);
          break;
        default:
          date = subMonths(now, i);
      }
      
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
      let periodKey;
      
      // Determinar a qué periodo pertenece esta venta
      switch (periodType) {
        case 'day':
          periodKey = formatDate(saleDate, "dd MMM");
          break;
        case 'week':
          periodKey = `W${formatDate(saleDate, "w")} ${formatDate(saleDate, "yyyy")}`;
          break;
        case 'month':
          periodKey = formatDate(saleDate, "MMM yyyy");
          break;
        case 'quarter':
          const quarter = Math.floor(saleDate.getMonth() / 3) + 1;
          periodKey = `Q${quarter} ${formatDate(saleDate, "yyyy")}`;
          break;
        default:
          periodKey = formatDate(saleDate, "MMM yyyy");
      }
      
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
          periods: Array(8 - cohortIndex).fill(0).map((_, i) => i === 0 ? null : 0)
        };
      }
      
      // Conjunto de leads que compraron en el periodo de cohorte
      const cohortLeads = salesByPeriod.get(cohortKey)!;
      const originalCount = cohortLeads.size;
      
      // Para cada periodo posterior, calcular cuántos leads repitieron
      const periods = Array.from({ length: 8 - cohortIndex }).map((_, periodIndex) => {
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
    
    // Similar para cohortes de uso (en este caso, uso = compra repetida)
    const usageCohorts = JSON.parse(JSON.stringify(salesCohorts));
    
    // Definir la interfaz para los objetos de cohorte
    interface CohortWithPeriods {
      cohort: string;
      periods: (number | null)[];
    }
    
    interface CohortWithWeeks {
      cohort: string;
      weeks: (number | null)[];
    }
    
    // Adaptamos los nombres para mantener compatibilidad con el frontend
    const finalSalesCohorts = salesCohorts.map((cohort: CohortWithPeriods): CohortWithWeeks => ({
      cohort: cohort.cohort,
      weeks: cohort.periods
    }));
    
    const finalUsageCohorts = usageCohorts.map((cohort: CohortWithPeriods): CohortWithWeeks => ({
      cohort: cohort.cohort,
      weeks: cohort.periods
    }));
    
    // Registro de la solicitud
    console.log(`[Cohorts API] Period: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);
    console.log(`[Cohorts API] Returning sales cohorts: ${finalSalesCohorts.length}, usage cohorts: ${finalUsageCohorts.length}`);
    
    if (hasAnonymousLeads) {
      console.log(`[Cohorts API] Ventas sin lead_id asignadas a anonymous_lead e incluidas en cohortes por fecha`);
      
      // Registrar los periodos con datos anónimos
      const periodsWithAnonymousData = periodsWithSales.join(', ');
      console.log(`[Cohorts API] Periodos que incluyen ventas anónimas: ${periodsWithAnonymousData}`);
    }
    
    return NextResponse.json({ 
      salesCohorts: finalSalesCohorts, 
      usageCohorts: finalUsageCohorts 
    });
  } catch (error) {
    console.error("Error in cohorts API:", error);
    
    // Generamos datos de demostración para el caso de error
    // Meses para las cohortes
    const cohortMonths = ["Jan 2023", "Feb 2023", "Mar 2023", "Apr 2023", 
                         "May 2023", "Jun 2023", "Jul 2023", "Aug 2023"];
    
    // Datos de cohorte de ventas por defecto
    const salesCohorts = [
      {
        cohort: "Jan 2023",
        weeks: [100, 85, 72, 68, 65, 63, 61, 60]
      },
      {
        cohort: "Feb 2023",
        weeks: [100, 82, 70, 65, 62, 60, 58]
      },
      {
        cohort: "Mar 2023",
        weeks: [100, 88, 76, 72, 69, 67]
      },
      {
        cohort: "Apr 2023",
        weeks: [100, 87, 75, 71, 68]
      },
      {
        cohort: "May 2023",
        weeks: [100, 86, 74, 70]
      },
      {
        cohort: "Jun 2023",
        weeks: [100, 89, 77]
      },
      {
        cohort: "Jul 2023",
        weeks: [100, 90]
      },
      {
        cohort: "Aug 2023",
        weeks: [100]
      }
    ];
    
    // Datos de cohorte de uso por defecto
    const usageCohorts = [
      {
        cohort: "Jan 2023",
        weeks: [100, 78, 65, 55, 48, 42, 38, 35]
      },
      {
        cohort: "Feb 2023",
        weeks: [100, 80, 68, 58, 50, 45, 42]
      },
      {
        cohort: "Mar 2023",
        weeks: [100, 82, 70, 60, 53, 48]
      },
      {
        cohort: "Apr 2023",
        weeks: [100, 83, 72, 62, 56]
      },
      {
        cohort: "May 2023",
        weeks: [100, 84, 73, 64]
      },
      {
        cohort: "Jun 2023",
        weeks: [100, 85, 75]
      },
      {
        cohort: "Jul 2023",
        weeks: [100, 87]
      },
      {
        cohort: "Aug 2023",
        weeks: [100]
      }
    ];
    
    console.log("[Cohorts API] Returning default data due to error");
    return NextResponse.json({ salesCohorts, usageCohorts });
  }
} 