import { createClient } from "@/utils/supabase/client"

/**
 * Creates a Supabase client scoped to a specific database schema.
 * We cast to `any` because the generated database types only cover the `public` schema.
 * 
 * @param schema The schema name (e.g. 'app_xxx')
 */
export function getTenantScopedClient(schema: string) {
  const supabase = createClient()
  
  // If the client has a schema method (real Supabase client), use it
  if (typeof (supabase as any).schema === 'function') {
    return (supabase as any).schema(schema)
  }
  
  // Otherwise (e.g. mock/demo client), just return the client
  return supabase
}