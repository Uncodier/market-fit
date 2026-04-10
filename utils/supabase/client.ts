import { createClient as createGlobalClient } from '@/lib/supabase/client'
import { Database } from '@/types/supabase'
import { SupabaseClient } from '@supabase/supabase-js'

export const createClient = () => {
  return createGlobalClient() as SupabaseClient<Database>
} 