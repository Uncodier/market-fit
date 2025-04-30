import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Define interface for the returned activity
interface Activity {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    imageUrl: string | null;
  };
  action: string;
  date: string;
  lead: {
    id: string;
    name: string;
  };
  segment: string | null;
  title: string;
}

export async function GET(request: NextRequest) {
  // Log del inicio de la solicitud
  console.log("\n\n===============================================");
  console.log("🚀 GET /api/recent-activity - START REQUEST");
  console.log("===============================================");
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const limit = parseInt(searchParams.get('limit') || '6', 10); // Default a 6 actividades

    console.log("📋 Request params:", {
      siteId,
      limit,
      url: request.nextUrl.toString()
    });

    if (!siteId) {
      console.log("❌ Missing site ID");
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400 }
      );
    }

    // Verificar variables de entorno
    console.log("🔑 Environment check:", { 
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      serviceRoleKeyExists: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });

    // Initialize Supabase client with service role for admin access
    console.log("🔌 Initializing Supabase client...");
    const cookieStore = cookies();
    
    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: any) {
              cookieStore.set({ name, value, ...options });
            },
            remove(name: string, options: any) {
              cookieStore.delete({ name, ...options });
            },
          },
        }
      );
      console.log("✅ Supabase client created successfully");

      // PRIMERA CONSULTA: Probar conexión con Supabase - evitando funciones agregadas
      console.log("🔎 Testing Supabase connection...");
      const { data: connectionTest, error: connectionError } = await supabase
        .from('tasks')
        .select('id')
        .limit(1);

      if (connectionError) {
        console.error("❌ Connection test failed:", connectionError);
        return NextResponse.json(
          { error: `Supabase connection error: ${connectionError.message}` },
          { status: 500 }
        );
      }
      console.log("✅ Connection test successful:", connectionTest);

      // SEGUNDA CONSULTA: Verificar si el sitio existe
      console.log(`🔎 Verifying site existence for ID: ${siteId}`);
      const { data: siteData, error: siteError } = await supabase
        .from('sites')
        .select('id, name')
        .eq('id', siteId)
        .single();

      if (siteError && siteError.code !== 'PGRST116') {
        console.error(`❌ Error checking site: ${siteError.message}`);
      } else if (!siteData) {
        console.log(`⚠️ Site with ID ${siteId} not found`);
      } else {
        console.log(`✅ Found site: ${siteData.name}`);
      }

      // TERCERA CONSULTA: Obtener tareas completadas para este sitio
      console.log(`🔎 Fetching completed tasks for site: ${siteId} (limit: ${limit})`);
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          type,
          status,
          completed_date,
          lead_id,
          user_id
        `)
        .eq('site_id', siteId)
        .eq('status', 'completed')
        .order('completed_date', { ascending: false })
        .limit(limit);

      if (tasksError) {
        console.error("❌ Error fetching tasks:", tasksError);
        return NextResponse.json(
          { error: `Failed to fetch tasks: ${tasksError.message}` },
          { status: 500 }
        );
      }

      console.log(`✅ Found ${tasksData?.length || 0} completed tasks for site ${siteId}`);
      
      if (!tasksData || tasksData.length === 0) {
        console.log("ℹ️ No tasks found, returning empty array");
        return NextResponse.json({ activities: [] });
      }

      console.log("📊 Sample task data:", tasksData[0]);

      // Extraer IDs para consultas secundarias
      const leadIds = tasksData.map(task => task.lead_id);

      console.log(`🔎 Fetching related data for ${leadIds.length} leads`);

      // CUARTA CONSULTA: Obtener datos de leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, name, email, segment_id')
        .in('id', leadIds);

      if (leadsError) {
        console.error("❌ Error fetching leads:", leadsError);
      } else {
        console.log(`✅ Retrieved ${leadsData?.length || 0}/${leadIds.length} leads`);
        if (leadsData?.length !== leadIds.length) {
          console.warn("⚠️ Some leads were not found");
          console.log("Missing lead IDs:", leadIds.filter(id => !leadsData?.some(lead => lead.id === id)));
        }
      }

      // QUINTA CONSULTA: Obtener datos de segmentos
      const { data: segmentsData, error: segmentsError } = await supabase
        .from('segments')
        .select('id, name')
        .eq('site_id', siteId);

      if (segmentsError) {
        console.error("❌ Error fetching segments:", segmentsError);
      } else {
        console.log(`✅ Retrieved ${segmentsData?.length || 0} segments`);
      }

      // Crear mapas para búsquedas rápidas
      const leadMap = new Map();
      if (leadsData) {
        leadsData.forEach(lead => {
          leadMap.set(lead.id, lead);
        });
      }

      const segmentMap = new Map();
      if (segmentsData) {
        segmentsData.forEach(segment => {
          segmentMap.set(segment.id, segment.name);
        });
      }

      // Formatear la respuesta combinando los datos
      const formattedActivities: Activity[] = [];
      
      console.log("🔄 Formatting activities...");
      let processedCount = 0;
      let skippedCount = 0;
      
      for (const task of tasksData) {
        const lead = leadMap.get(task.lead_id);
        
        if (!lead) {
          console.log(`⚠️ Missing lead data for task ${task.id}, lead_id: ${task.lead_id}`);
          skippedCount++;
          continue;
        }
        
        // Obtener nombre del segmento si está disponible
        const segmentName = lead.segment_id && segmentMap.has(lead.segment_id) 
          ? segmentMap.get(lead.segment_id) 
          : null;

        // Usamos el lead como la información de usuario también
        formattedActivities.push({
          id: task.id,
          user: {
            id: task.user_id || lead.id, // Usamos el user_id de la tarea o el id del lead como fallback
            name: lead.name,
            email: lead.email || 'unknown@example.com',
            imageUrl: null
          },
          action: `Completed ${task.type.replace('_', ' ')} task`,
          date: task.completed_date || new Date().toISOString(),
          lead: {
            id: lead.id,
            name: lead.name
          },
          segment: segmentName,
          title: task.title
        });
        
        processedCount++;
      }

      console.log(`✅ Successfully formatted activities: ${formattedActivities.length}`);
      console.log(`📊 Stats: Processed ${processedCount}, Skipped ${skippedCount}`);
      
      if (formattedActivities.length > 0) {
        console.log("📊 Sample formatted activity:", formattedActivities[0]);
      }

      console.log("===============================================");
      console.log("✅ GET /api/recent-activity - END REQUEST SUCCESS");
      console.log("===============================================\n\n");
      
      return NextResponse.json({
        activities: formattedActivities
      });
      
    } catch (supabaseError) {
      console.error("❌ Error initializing Supabase:", supabaseError);
      return NextResponse.json(
        { error: `Supabase initialization error: ${supabaseError instanceof Error ? supabaseError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error("===============================================");
    console.error("❌ GET /api/recent-activity - ERROR", error);
    console.error("===============================================\n\n");
    
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 