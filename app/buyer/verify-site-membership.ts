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
  const { data: role, error: roleError } = await supabase.rpc('current_user_site_role', { p_site_id: siteId })
  if (roleError || !['owner', 'admin', 'collaborator', 'marketing'].includes(role)) return false
  const { data: restricted, error: scopeError } = await supabase.rpc('current_user_has_site_location_restrictions', { p_site_id: siteId })
  if (scopeError || restricted !== false) return false
  
  const isMember = data.site_members?.some((m: { user_id: string; status: string }) => m.user_id === userId && m.status === 'active')
  return !!isMember
}

