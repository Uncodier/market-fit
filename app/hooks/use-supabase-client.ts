import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

// Crear una única instancia del cliente Supabase
const globalSupabase = createClient()

export function useSupabaseClient() {
  const [supabase] = useState(() => globalSupabase)
  return supabase
} 