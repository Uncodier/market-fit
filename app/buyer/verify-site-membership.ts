import type { SupabaseClient } from "@supabase/supabase-js"

export async function verifySiteMembership(supabase: SupabaseClient, userId: string, siteId: string) {
  const { data, error } = await supabase
    .from('sites')
    .select(`
      id,
      user_id,
      site_members (user_id, status)
    `)
    .eq('id', siteId)
    .single()
    
  if (error || !data) return false
  if (data.user_id === userId) return true
  
  const isMember = data.site_members?.some((m: { user_id: string; status: string }) => m.user_id === userId && m.status === 'active')
  return !!isMember
}

