import { procurementAccess, procurementError, uuid, privateHeaders } from '../../../http'
import { NextResponse } from 'next/server'
import { submitRequestSchema } from '@/app/purchases/requests/schema'
import { evaluateProcurementPolicy, policyDocumentSchema } from '@/app/purchases/procurement/domain'
import { validatePolicyReferences } from '../../../policy/validate-references'
import { createServiceClient } from '@/lib/supabase/server'
import { databaseError, requestBody, resultJson } from '../../http'
import type { RequestItem } from '@/app/purchases/requests/schema'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    // The service-only RPC is reached only after explicit identity, tenant,
    // manager role, unrestricted-location, resource and policy authorization.
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid request identifier', 400)
    const parsed = await requestBody(request, submitRequestSchema)
    if (parsed.error) return parsed.error
    const [record, policy] = await Promise.all([
      access.supabase.from('procurement_requests').select('*').eq('site_id', access.siteId).eq('id', id.data).maybeSingle(),
      access.supabase.from('procurement_policy_versions').select('revision,document').eq('site_id', access.siteId).order('revision', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (record.error || policy.error) return procurementError('Unable to verify request and policy', 503)
    if (!record.data) return procurementError('Request not found', 404)
    if (record.data.status !== 'draft' || record.data.revision !== parsed.data!.expected_revision) return procurementError('Request changed. Reload before submitting.', 409)
    const document = policyDocumentSchema.safeParse(policy.data?.document)
    if (!document.success) return procurementError('A valid saved procurement policy is required', 409)
    // Both values are the same validated database snapshot, never a client ignore list.
    if (!await validatePolicyReferences(access.supabase, access.siteId, document.data, document.data)) return procurementError('Policy references are no longer eligible', 409)
    const { data: items, error } = await access.supabase.from('procurement_request_items').select('*')
      .eq('request_id', id.data).eq('revision', record.data.revision).order('position')
    if (error || !items?.length) return procurementError('Unable to verify request lines', 503)
    if (items.some((item: RequestItem) => item.unit_net_minor === null || item.net_amount_minor === null || item.tax_snapshot === null)) {
      return procurementError('Unpriced service lines cannot be submitted. Save an authorized internal estimate and explicit workspace tax selection first.', 409)
    }
    const now = new Date().toISOString()
    const plan = evaluateProcurementPolicy(document.data, {
      event: 'requisition', currency: record.data.currency, netAmountMinor: Number(record.data.net_amount_minor),
      evaluatedAt: now, stageActivatedAt: now, requesterId: record.data.requester_id,
      lines: items.map((item: RequestItem) => ({ id: item.id, productId: item.catalog_item_id,
        categoryIds: item.category_ids, netAmountMinor: Number(item.net_amount_minor) })),
    })
    if (plan.status !== 'ready') return NextResponse.json({ error: 'Policy resolution blocked submission', issues: plan.issues }, { status: 409, headers: privateHeaders })
    // Relative sequential deadlines require activation-time resolution, not a
    // fabricated shared submission anchor. Leave these configurations blocked.
    if (plan.stages.some(stage => stage.execution === 'sequential' && (stage.deadline ?? document.data.settings.timings.approval)?.kind === 'duration')) {
      return procurementError('Sequential relative deadlines need activation scheduling, which is not yet integrated', 409)
    }
    const service = await createServiceClient(true)
    const saved = await service.rpc('submit_procurement_request', {
      p_site: access.siteId, p_id: id.data, p_revision: record.data.revision,
      p_policy_revision: policy.data.revision, p_actor: access.userId, p_plan: plan,
    })
    return databaseError(saved.error) ?? resultJson({ id: saved.data })
  } catch { return procurementError('Unable to submit request; no approval was granted', 503) }
}