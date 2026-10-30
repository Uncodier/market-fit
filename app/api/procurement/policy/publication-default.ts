import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { defaultPolicyDocument, policyDocumentSchema } from '@/app/purchases/procurement/domain'

const snapshotSchema = z.object({ revision: z.number().int().positive(), document: policyDocumentSchema })

/** Bootstrap only an absent policy; existing restrictions are never replaced. */
export async function publicationPolicy(supabase: SupabaseClient, siteId: string, saved: unknown) {
  if (saved !== null) return snapshotSchema.safeParse(saved)

  const owner = await supabase.from('sites').select('user_id').eq('id', siteId).single()
  const ownerId = z.string().uuid().safeParse(owner.data?.user_id)
  if (owner.error || !ownerId.success) throw new Error('Workspace owner could not be verified')

  const admins = await supabase.from('site_members').select('user_id').eq('site_id', siteId)
    .eq('role', 'admin').eq('status', 'active').eq('license_suspended', false).eq('manually_disabled', false)
  const adminIds = z.array(z.object({ user_id: z.string().uuid() })).safeParse(admins.data)
  if (admins.error || !adminIds.success) throw new Error('Workspace administrators could not be verified')
  const approverIds = [...new Set([ownerId.data, ...adminIds.data.map(member => member.user_id)])]
  if (approverIds.length > 200) throw new Error('Workspace approver limit exceeded')

  const document = defaultPolicyDocument()
  document.settings.fallback = { mode: 'approval', stages: [{
    id: 'workspace-managers', name: 'Workspace owner or admin approval', decisionMode: 'human',
    approverIds, mandatoryApproverIds: [], quorum: { mode: 'first_response' },
    rejectionBehavior: 'veto', execution: 'parallel', allowSelfApproval: true,
    delegatedAgentId: null, deadline: null, timeoutAction: 'block', escalationIds: [],
  }] }
  const result = await supabase.rpc('save_procurement_policy', {
    p_site_id: siteId, p_expected_revision: 0, p_document: document,
  })
  if (result.error?.code === '40001') {
    // Another manager may have configured rules during bootstrap. Use their policy.
    const latest = await supabase.from('procurement_policy_versions').select('revision,document')
      .eq('site_id', siteId).order('revision', { ascending: false }).limit(1).maybeSingle()
    if (latest.error) throw new Error('Procurement policy could not be verified')
    return snapshotSchema.safeParse(latest.data)
  }
  if (result.error) throw new Error('Default procurement policy could not be saved')
  return snapshotSchema.safeParse(Array.isArray(result.data) ? result.data[0] : result.data)
}