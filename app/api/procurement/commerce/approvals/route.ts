import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import { evaluateProcurementPolicy, policyDocumentSchema } from "@/app/purchases/procurement/domain"
import { validatePolicyReferences } from "../../policy/validate-references"
import { commerceBody, commerceResult, procurementAccess, procurementError, privateHeaders } from "../http"

const inputSchema = z.object({ target_id: z.string().uuid(), expected_version: z.number().int().positive(), event: z.enum(["award", "order"]) }).strict()
const contextSchema = z.object({ currency: z.string(), net_amount_minor: z.number().int().nonnegative(), supplier_proposals: z.number().int().nonnegative(),
  lines: z.array(z.object({ id: z.string().uuid(), productId: z.string().uuid(), categoryIds: z.array(z.string().uuid()), netAmountMinor: z.number().int().nonnegative() })).min(1),
})

export async function POST(request: Request) {
  try {
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const body = inputSchema.safeParse(await commerceBody(request))
    if (!body.success) return procurementError("A valid event target and version are required", 400)
    const params = { p_site: access.siteId, p_target: body.data.target_id, p_version: body.data.expected_version, p_event: body.data.event }
    const target = await access.supabase.rpc("procurement_commerce_event_context", params)
    if (target.error) return commerceResult(null, target.error)
    const context = contextSchema.safeParse(target.data)
    if (!context.success) return procurementError("The approval target could not be verified", 409)
    const policy = await access.supabase.from("procurement_policy_versions").select("revision,document")
      .eq("site_id", access.siteId).order("revision", { ascending: false }).limit(1).maybeSingle()
    const document = policyDocumentSchema.safeParse(policy.data?.document)
    if (policy.error || !document.success) return procurementError("A valid procurement policy is required", 409)
    if (!await validatePolicyReferences(access.supabase, access.siteId, document.data, document.data)) {
      return procurementError("Policy references are no longer eligible", 409)
    }
    const now = new Date().toISOString()
    const plan = evaluateProcurementPolicy(document.data, { event: body.data.event,
      currency: context.data.currency, netAmountMinor: context.data.net_amount_minor,
      requesterId: access.userId, evaluatedAt: now, stageActivatedAt: now, lines: context.data.lines })
    if (plan.status !== "ready" || plan.requirements.length || (plan.minimumSupplierProposals !== null && context.data.supplier_proposals < plan.minimumSupplierProposals)) {
      return procurementError("Policy requirements remain unresolved; no award or order was created", 409)
    }
    if (plan.stages.some(stage => stage.execution === "sequential" && (stage.deadline ?? document.data.settings.timings.approval)?.kind === "duration")) {
      return procurementError("Sequential relative deadlines require activation scheduling", 409)
    }
    // Elevated persistence follows manager, target, tenant and policy authorization.
    const service = await createServiceClient(true)
    const saved = await service.rpc("create_procurement_commerce_approval", {
      ...params, p_actor: access.userId, p_policy_revision: policy.data.revision, p_plan: plan,
    })
    if (saved.error) return commerceResult(null, saved.error)
    const approval = await access.supabase.from("procurement_event_approvals").select("id,status")
      .eq("site_id", access.siteId).eq("id", saved.data).single()
    if (approval.error) return procurementError("Approval result could not be confirmed. Refresh before retrying.", 503)
    return NextResponse.json({ data: approval.data }, { headers: privateHeaders })
  } catch { return procurementError("Approval could not be completed", 503) }
}