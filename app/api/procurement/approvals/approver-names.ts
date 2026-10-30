import type { SupabaseClient } from '@supabase/supabase-js'

/** Resolve only users referenced by visible approvals, within the caller's workspace RLS. */
export async function approverNames(supabase: SupabaseClient, siteId: string, userIds: string[]) {
  const names = new Map<string, string>()
  if (!userIds.length) return { names, ownerId: null }
  const [owner, batches] = await Promise.all([
    supabase.from('sites').select('user_id').eq('id', siteId).maybeSingle(),
    Promise.all(Array.from({ length: Math.ceil(userIds.length / 100) }, (_, index) =>
      supabase.from('site_members').select('user_id,name').eq('site_id', siteId)
        .in('user_id', userIds.slice(index * 100, (index + 1) * 100)))),
  ])
  if (owner.error || batches.some(batch => batch.error)) throw new Error('Unable to load approver names')
  for (const member of batches.flatMap(batch => batch.data ?? [])) {
    if (member.user_id && member.name?.trim()) names.set(member.user_id, member.name.trim())
  }
  return { names, ownerId: owner.data?.user_id ?? null }
}