import type { SupabaseClient } from '@supabase/supabase-js'

type ApprovalRevision = { event: string; target_id: string; target_version: number; policy_revision: number }

/** Read current revisions with the caller's RLS scope; never trust a browser snapshot. */
export async function approvalRevisionState<T extends ApprovalRevision>(supabase: SupabaseClient, siteId: string, approvals: T[]) {
  if (!approvals.length) return []
  const tenderIds = [...new Set(approvals.filter(row => row.event === 'publication').map(row => row.target_id))]
  const [policy, tenders] = await Promise.all([
    supabase.from('procurement_policy_versions').select('revision').eq('site_id', siteId)
      .order('revision', { ascending: false }).limit(1).maybeSingle(),
    Promise.all(Array.from({ length: Math.ceil(tenderIds.length / 100) }, (_, index) =>
      supabase.from('procurement_tenders').select('id,version').eq('site_id', siteId)
        .in('id', tenderIds.slice(index * 100, (index + 1) * 100)))),
  ])
  if (policy.error || tenders.some(batch => batch.error)) throw new Error('Unable to verify approval revision')
  const versions = new Map(tenders.flatMap(batch => batch.data ?? []).map(row => [row.id, row.version]))
  return approvals.map(row => ({ ...row,
    policy_changed: row.policy_revision !== policy.data?.revision,
    is_deprecated: row.policy_revision !== policy.data?.revision ||
      (row.event === 'publication' && row.target_version !== versions.get(row.target_id)),
  }))
}