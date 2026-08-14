import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "../database.types"
import { createDemoMockClient } from "@/lib/demo-data/mock-client"
import { wrapSupabaseClient } from "@/lib/permissions/mutation-guard"

export async function createClient(skipDemo: boolean = false) {
  const cookieStore = await cookies()
  
  // Interceptar modo demo
  const demoSiteId = cookieStore.get('market_fit_demo_site_id')?.value;
  if (demoSiteId && !skipDemo) {
    console.log('🤖 DEMO MODE ACTIVE (SERVER) - Usando datos simulados para:', demoSiteId);
    return createDemoMockClient(demoSiteId) as any;
  }

  return wrapSupabaseClient(
    createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch {
              // Ignore in Server Components — middleware refreshes the session.
            }
          },
        },
      }
    )
  )
}

// Cliente con permisos elevados (solo para operaciones del servidor).
// When skipDemo is true, do NOT call cookies() — required for unstable_cache /
// static data scopes that cannot access dynamic request stores.
export async function createServiceClient(skipDemo: boolean = false) {
  if (!skipDemo) {
    const cookieStore = await cookies();
    const demoSiteId = cookieStore.get('market_fit_demo_site_id')?.value;

    if (demoSiteId) {
      console.log('🤖 DEMO MODE ACTIVE (SERVICE) - Usando datos simulados para:', demoSiteId);
      return createDemoMockClient(demoSiteId) as any;
    }
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return undefined; // No usar cookies del usuario para service client
        },
        set(name: string, value: string, options: any) {
          // No hacer nada para service client
        },
        remove(name: string, options: any) {
          // No hacer nada para service client
        },
      },
    }
  )
} 