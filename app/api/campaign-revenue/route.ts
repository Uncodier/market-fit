export const dynamic = 'force-dynamic';

import { createServiceApiClient } from "@/lib/supabase/server-client";
import { NextResponse } from "next/server";
import { format, subDays } from "date-fns";

// Colores para campañas consistentes
const campaignColors = {
  social: "#6366f1", // Indigo
  email: "#ec4899",  // Pink
  content: "#14b8a6", // Teal
  paid: "#f59e0b",   // Amber
  referral: "#8b5cf6", // Purple
  organic: "#10b981", // Emerald
  partner: "#3b82f6", // Blue
  webinar: "#ef4444"  // Red
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");
  const shouldIgnoreDateRange = searchParams.get("ignoreRange") === "true";
  const useDemoData = searchParams.get("useDemoData") === "true";
  
  if (!siteId) {
    return NextResponse.json(
      { error: "Site ID is required" },
      { status: 400 }
    );
  }
  
  try {
    console.log(`[Campaign Revenue API] Consulta para sitio: ${siteId}`);
    
    // Cliente con permisos elevados
    const supabase = createServiceApiClient();
    
    // Fechas
    const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 30);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Validar contra fechas futuras
    const now = new Date();
    if (startDate > now || endDate > now) {
      console.warn(`[Campaign Revenue API] Future date detected in request - startDate: ${startDate.toISOString()}, endDate: ${endDate.toISOString()}`);
      return NextResponse.json({
        campaigns: [],
        debug: {
          message: "Future dates were requested - no data available"
        }
      });
    }
    
    console.log(`[Campaign Revenue API] Período: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`);
    
    // Para diagnóstico consultamos sin filtro de fechas para ver si hay datos
    const { data: allSales, error: allSalesError } = await supabase
      .from("sales")
      .select("id, amount, campaign_id")
      .eq("site_id", siteId);
      
    if (allSalesError) {
      console.error(`[Campaign Revenue API] Error al consultar todas las ventas:`, allSalesError);
    } else {
      console.log(`[Campaign Revenue API] Total de ventas para el sitio (sin filtrar): ${allSales?.length || 0}`);
      
      if (allSales && allSales.length > 0) {
        // Mostrar estructura de una venta para debug
        console.log(`[Campaign Revenue API] Estructura de venta:`, allSales[0]);
      }
    }
    
    // Determinamos los datos a procesar: filtrados por fecha o todos si se indica ignorar el rango
    let salesData;
    let salesError;
    
    if (shouldIgnoreDateRange) {
      // Si se indica explícitamente ignorar el rango, usamos todos los datos
      salesData = allSales;
      salesError = allSalesError;
      console.log(`[Campaign Revenue API] Ignorando filtro de fechas por petición del cliente`);
    } else {
      // Aplicamos el filtro de fechas
      const result = await supabase
        .from("sales")
        .select("id, amount, campaign_id")
        .eq("site_id", siteId)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());
        
      salesData = result.data;
      salesError = result.error;
    }
    
    if (salesError) {
      console.error(`[Campaign Revenue API] Error al consultar ventas:`, salesError);
      return NextResponse.json({ 
        campaigns: [
          { name: "Error consultando datos", value: 0, color: "#ef4444" }
        ]
      });
    }
    
    // Verificamos si hay ventas para procesar
    if (!salesData || salesData.length === 0) {
      console.log(`[Campaign Revenue API] No hay ventas para el período especificado`);
      
      // Si se solicita explícitamente datos de demo, proporcionamos datos ficticios
      if (useDemoData) {
        console.log(`[Campaign Revenue API] Usando datos de demo por petición del cliente`);
        
        // Datos de demo para visualización
        return NextResponse.json({
          campaigns: [
            { name: "Email Campaign", value: 45000, color: campaignColors.email },
            { name: "Social Media", value: 32000, color: campaignColors.social },
            { name: "Content Marketing", value: 28000, color: campaignColors.content },
            { name: "Paid Advertising", value: 20000, color: campaignColors.paid },
            { name: "Referral Program", value: 15000, color: campaignColors.referral }
          ],
          isDemoData: true
        });
      }
      
      // Retornamos array vacío cuando no hay datos en el período y no se pidieron datos de demo
      return NextResponse.json({ campaigns: [], noData: true });
    }
    
    console.log(`[Campaign Revenue API] Ventas encontradas para procesar: ${salesData.length}`);
    
    // Obtenemos todas las campañas activas para tener sus nombres
    const { data: campaignsData, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, title, type")
      .eq("status", "active") // Only get active campaigns
      .order("title");
      
    if (campaignsError) {
      console.error(`[Campaign Revenue API] Error al consultar campañas activas:`, campaignsError);
    }
    
    // Crear un mapa de campañas para lookups rápidos
    const campaignsMap = new Map();
    if (campaignsData && campaignsData.length > 0) {
      campaignsData.forEach(campaign => {
        campaignsMap.set(campaign.id, campaign);
      });
      console.log(`[Campaign Revenue API] Encontradas ${campaignsData.length} campañas activas en la DB`);
    }
    
    // Agrupar por campaign_id
    const campaignRevenue = new Map<string, number>();
    
    for (const sale of salesData) {
      const campaignId = sale.campaign_id || "untracked";
      const amount = sale.amount || 0;
      
      if (campaignRevenue.has(campaignId)) {
        campaignRevenue.set(campaignId, campaignRevenue.get(campaignId)! + amount);
      } else {
        campaignRevenue.set(campaignId, amount);
      }
    }
    
    // Convertir a formato esperado
    const campaigns = Array.from(campaignRevenue.entries())
      .map(([campaignId, value]) => {
        // Buscar el nombre de la campaña en el mapa
        const campaign = campaignsMap.get(campaignId);
        
        // Usar el nombre real de la campaña si está disponible, sino un nombre genérico
        let name = campaignId === "untracked" ? "Sin Campaña" : `Campaña ${campaignId}`;
        if (campaign && campaign.title) {
          name = campaign.title;
        }
        
        // Determinar color basado en campaignId o tipo
        let type = "social";
        
        if (campaign && campaign.type) {
          // Si la campaña tiene un tipo definido, usarlo
          type = campaign.type;
        } else {
          // Si no, intentar determinar por el nombre
          const campaignIdStr = String(campaignId).toLowerCase();
          const nameStr = name.toLowerCase();
          
          if (nameStr.includes("email") || campaignIdStr.includes("email")) type = "email";
          else if (nameStr.includes("content") || campaignIdStr.includes("content")) type = "content";
          else if (nameStr.includes("paid") || campaignIdStr.includes("paid")) type = "paid";
          else if (nameStr.includes("referral") || campaignIdStr.includes("referral")) type = "referral";
          else if (nameStr.includes("webinar") || campaignIdStr.includes("webinar")) type = "webinar";
          else if (nameStr.includes("partner") || campaignIdStr.includes("partner")) type = "partner";
          else if (nameStr.includes("organic") || campaignIdStr.includes("organic")) type = "organic";
        }
        
        // Obtener color del tipo o usar uno predeterminado
        const color = campaignColors[type as keyof typeof campaignColors] || "#6366f1";
        
        return { name, value, color };
      })
      .filter(campaign => campaign.value > 0);
      
    // Ordenar por valor
    campaigns.sort((a, b) => b.value - a.value);
    
    console.log(`[Campaign Revenue API] Retornando ${campaigns.length} campañas`);
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error(`[Campaign Revenue API] Error en la API:`, error);
    return NextResponse.json({ 
      campaigns: [
        { name: "Error en el servidor", value: 0, color: "#ef4444" }
      ] 
    });
  }
} 