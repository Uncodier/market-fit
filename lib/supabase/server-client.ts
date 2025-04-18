import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from "../database.types"

// Create a Supabase client for use in API routes
export function createApiClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Create a service client with elevated permissions for admin operations
export function createServiceApiClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
} 