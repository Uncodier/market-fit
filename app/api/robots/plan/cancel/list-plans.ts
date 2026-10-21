import { z } from "zod"
import { requireUnrestrictedLocationAccess } from "@/lib/auth/location-boundary.server"
import { getCurrentUserSiteRole, isSiteManagerRole } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"

const input = z.object({ instance_id: z.string().uuid() }).strict()
const headers = { "Cache-Control": "no-store, private" }
const fail = (message: string, status: number) => Response.json({ error: { message } }, { status, headers })
const stepSchema = z.array(z.object({ status: z.string() }).passthrough())
type PlanRow = { id: string; title: string; status: string; steps: unknown; metadata?: Record<string, unknown> | null; completion_reason?: string | null }

export async function listCancellationPlans(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const parsed = input.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success || url.searchParams.getAll("instance_id").length !== 1) return fail("Provide a valid instance ID", 400)
  try {
    const access = await requireUnrestrictedLocationAccess()
    if (access.error) return access.error
    const { supabase } = access
    const { data: instance, error } = await supabase.from("remote_instances").select("id, site_id")
      .eq("id", parsed.data.instance_id).maybeSingle()
    if (error) return fail("Instance access unavailable", 503)
    if (!instance || instance.id !== parsed.data.instance_id) return fail("Instance not found", 404)
    const role = await getCurrentUserSiteRole(supabase, instance.site_id)
    if (!isSiteManagerRole(role) || !await userCanOnSite(supabase, instance.site_id, "update")) return fail("Permission denied", 403)
    const candidates: PlanRow[] = []
    let complete = false
    // Paginate historical exclusions before limiting actionable results. Never
    // report a partial scan as an empty list or silently omit remaining work.
    for (let offset = 0; offset < 5000; offset += 100) {
      const { data: plans, error: planError } = await supabase.from("instance_plans")
        .select("id, instance_id, site_id, title, status, steps, metadata, completion_reason")
        .eq("instance_id", instance.id).eq("site_id", instance.site_id)
        .in("status", ["pending", "in_progress", "paused", "blocked", "cancelled"])
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 99)
      if (planError || !plans) return fail("Plan list unavailable", 503)
      candidates.push(...plans.filter((plan: PlanRow) => !plan.metadata?.workflow_template && !plan.metadata?.workflow_run &&
        !(plan.status === "cancelled" && plan.completion_reason === "Cancelled by project manager")))
      if (candidates.length > 100) return fail("Too many plans to reconcile in this dialog", 503)
      if (plans.length < 100) { complete = true; break }
    }
    if (!complete) return fail("Plan history is too large to scan completely", 503)
    const summaries = candidates.map(plan => {
        const steps = stepSchema.safeParse(plan.steps ?? [])
        return { id: plan.id, title: plan.title, status: plan.status,
          active_steps: steps.success ? steps.data.filter(s => ["in_progress", "in-progress", "running", "active"].includes(s.status)).length : null }
      })
    return Response.json({ success: true, instance_id: instance.id, plans: summaries }, { headers })
  } catch { return fail("Plan list unavailable", 503) }
}