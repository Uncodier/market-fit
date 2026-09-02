import { createDemoMockClient } from "@/lib/demo-data/mock-client"
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from "@/lib/types/database.types"

// Create a Supabase client for use in API routes
export function createApiClient(siteId?: string | null) {
  if (siteId && siteId.startsWith("demo-")) return createDemoMockClient(siteId) as any;

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Create a service client with elevated permissions for admin operations
export function createServiceApiClient(siteId?: string | null) {
  if (siteId && siteId.startsWith("demo-")) return createDemoMockClient(siteId) as any;

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
} 