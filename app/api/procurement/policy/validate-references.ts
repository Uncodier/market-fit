import type { createClient } from "@/lib/supabase/server"
import type { PolicyDocument } from "@/app/purchases/procurement/domain"
import { uuid } from "../http"

/** Validate foreign identities using the caller's session, never a service client. */
export async function validatePolicyReferences(
  supabase: Awaited<ReturnType<typeof createClient>>, siteId: string, document: PolicyDocument,
  previous: PolicyDocument | null = null,
): Promise<boolean> {
  const people = new Set<string>()
  const products = new Set<string>()
  const categories = new Set<string>()
  const agents = new Set<string>()
  const add = (set: Set<string>, ids: string[]) => ids.forEach(id => set.add(id))
  const settings = document.settings
  if (settings.supervisorId) people.add(settings.supervisorId)
  add(people, [...settings.substituteIds, ...settings.rejectionNotifications.recipientIds])
  const stages = settings.fallback.mode === "approval" ? [...settings.fallback.stages] : []
  for (const rule of document.rules) {
    const old = previous?.rules.find(item => item.id === rule.id);
    // Preserve historical references when archiving or retaining an unchanged rule.
    // New/edited archived definitions and any reactivation still require validation.
    if (rule.status === "archived" && old &&
      JSON.stringify({ ...rule, status: "archived", version: 0 }) ===
      JSON.stringify({ ...old, status: "archived", version: 0 })) continue
    add(products, rule.scope.productIds)
    add(categories, rule.scope.categoryIds)
    add(people, [...rule.scope.requesterIds, ...rule.scope.responsibleIds])
    stages.push(...rule.stages)
    for (const requirement of rule.requirements) {
      add(products, requirement.productIds)
      add(categories, requirement.categoryIds)
    }
  }
  for (const stage of stages) {
    add(people, [...stage.approverIds, ...stage.mandatoryApproverIds, ...stage.escalationIds])
    if (stage.delegatedAgentId) agents.add(stage.delegatedAgentId)
  }
  const sets = [people, products, categories, agents]
  if (sets.some(set => set.size > 200 || [...set].some(id => !uuid.safeParse(id).success))) return false
  if (people.size) {
    const [owner, members] = await Promise.all([
      supabase.from("sites").select("user_id").eq("id", siteId).single(),
      supabase.from("site_members").select("user_id").eq("site_id", siteId)
        .eq("status", "active").eq("license_suspended", false).eq("manually_disabled", false)
        .in("user_id", [...people]),
    ])
    if (owner.error || members.error) throw new Error("Reference lookup unavailable")
    const allowed = new Set<string>((members.data ?? []).map((row: { user_id: string }) => row.user_id))
    if (owner.data?.user_id) allowed.add(owner.data.user_id)
    if ([...people].some(id => !allowed.has(id))) return false
  }
  for (const [table, ids] of [["catalog_items", products], ["catalog_categories", categories], ["agents", agents]] as const) {
    if (!ids.size) continue
    const { data, error } = await supabase.from(table).select("id").eq("site_id", siteId).in("id", [...ids])
    if (error) throw new Error("Reference lookup unavailable")
    if (new Set((data ?? []).map((row: { id: string }) => row.id)).size !== ids.size) return false
  }
  return true
}