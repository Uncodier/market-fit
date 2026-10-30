import { NextResponse } from 'next/server'
import { z } from 'zod'
import { procurementError, privateHeaders, uuid } from '../../../http'
import { tenderAccess } from '../../http'
import { requestBody, databaseError } from '../../../requests/http'
import { evaluateProcurementPolicy } from '@/app/purchases/procurement/domain'
import { validatePolicyReferences } from '../../../policy/validate-references'
import { createServiceClient } from '@/lib/supabase/server'
import { inheritedPolicySchema } from '../../../policy/inherited-policy'
import { publicationPolicy } from '../../../policy/publication-default'

const inputSchema = z.object({ expected_version: z.number().int().positive() }).strict()
const lineSchema = z.object({ id: uuid, catalog_item_id: uuid.nullable(), quantity: z.number().int().positive(),
  unit_net_minor: z.number().int().nonnegative() })

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await tenderAccess(request, 'update')
    if (access.error) return access.error
    const id = uuid.safeParse((await context.params).id)
    if (!id.success) return procurementError('Invalid tender', 400)
    const parsed = await requestBody(request, inputSchema)
    if (parsed.error) return parsed.error
    const [tender, policy] = await Promise.all([
      access.supabase.from('procurement_tenders').select('*').eq('site_id', access.siteId).eq('id', id.data).maybeSingle(),
      access.supabase.from('procurement_policy_versions').select('revision,document').eq('site_id', access.siteId)
        .order('revision', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (tender.error || policy.error) return procurementError('Unable to verify tender and policy', 503)
    if (!tender.data) return procurementError('Tender not found', 404)
    if (tender.data.version !== parsed.data!.expected_version) return procurementError('Tender changed. Reload before publishing.', 409)
    const inherited = await access.supabase.rpc('procurement_inherited_policy', {
      p_site: access.siteId, p_tender: id.data, p_event: 'publication',
    })
    if (inherited.error) return databaseError(inherited.error) ?? procurementError('Unable to verify request policy', 503)
    const requestPolicy = inheritedPolicySchema.safeParse(inherited.data)
    if (!requestPolicy.success || requestPolicy.data.inherited_requirements.length) {
      return procurementError('Inherited request requirements must be resolved before publication', 409)
    }
    const snapshot = await publicationPolicy(access.supabase, access.siteId, policy.data)
    if (!snapshot.success) return procurementError('Save a valid procurement policy before publishing', 409)
    const doc = { data: snapshot.data.document }
    if (!await validatePolicyReferences(access.supabase, access.siteId, doc.data, doc.data)) {
      return procurementError('Policy references are no longer eligible', 409)
    }
    const rows = z.array(lineSchema).min(1).parse(tender.data.requirements)
    const productIds = [...new Set(rows.flatMap(row => row.catalog_item_id ? [row.catalog_item_id] : []))]
    const categories = new Map<string, string[]>()
    if (productIds.length) {
      const items = await access.supabase.from('catalog_items').select('id,category_id')
        .eq('site_id', access.siteId).in('id', productIds)
      if (items.error || items.data?.length !== productIds.length) return procurementError('Tender product references changed', 409)
      for (const item of items.data) categories.set(item.id, item.category_id ? [item.category_id] : [])
    }
    const now = new Date().toISOString()
    const plan = evaluateProcurementPolicy(doc.data, { event: 'publication', currency: tender.data.currency,
      netAmountMinor: Number(tender.data.net_amount_minor), requesterId: access.userId,
      evaluatedAt: now, stageActivatedAt: now, publicationAt: now,
      lines: rows.map(row => ({ id: row.id, productId: row.catalog_item_id,
        categoryIds: row.catalog_item_id ? categories.get(row.catalog_item_id) ?? [] : [],
        netAmountMinor: row.quantity * row.unit_net_minor })),
    })
    if (plan.status !== 'ready') return NextResponse.json({ error: 'Publication policy is unresolved', issues: plan.issues }, { status: 409, headers: privateHeaders })
    if (plan.requirements.length || plan.minimumSupplierProposals !== null) {
      return procurementError('Publication has supplier requirements that must be resolved into published bases before release', 409)
    }
    if (plan.stages.some(stage => stage.execution === 'sequential' &&
      (stage.deadline ?? doc.data.settings.timings.approval)?.kind === 'duration')) {
      return procurementError('Sequential relative approval deadlines require activation scheduling', 409)
    }
    // Elevated plan persistence only follows authenticated manager and resource checks.
    const service = await createServiceClient(true)
    const saved = await service.rpc('create_procurement_event_approval', {
      p_site: access.siteId, p_target: id.data, p_version: tender.data.version, p_event: 'publication',
      p_actor: access.userId, p_policy_revision: snapshot.data.revision, p_plan: plan,
    })
    if (saved.error) return databaseError(saved.error) ?? procurementError('Unable to persist publication approval', 503)
    const approval = await access.supabase.from('procurement_event_approvals').select('id,status')
      .eq('site_id', access.siteId).eq('id', saved.data).single()
    if (approval.error) return procurementError('Publication result could not be confirmed. Reload before retrying.', 503)
    return NextResponse.json({ approval_id: approval.data.id,
      status: approval.data.status === 'approved' ? 'published' : approval.data.status }, { headers: privateHeaders })
  } catch { return procurementError('Unable to publish tender; no release has been confirmed', 503) }
}