import { useAuthContext } from '@/app/components/auth/auth-provider'
import { useSupabaseClient } from './use-supabase-client'

export function useSupabase() {
  const auth = useAuthContext()
  const supabase = useSupabaseClient()

  if (!auth) {
    throw new Error('useSupabase must be used within an AuthProvider')
  }

  return {
    ...auth,
    supabase
  }
} 