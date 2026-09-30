import "server-only"

import { cookies } from "next/headers"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import type { PermissionCommand } from "@/lib/permissions/types"
import type { PurchaseLineInput } from "@/app/types"

const uuid = z.string().uuid()
type PurchaseClient = Awaited<ReturnType<typeof createClient>>

export function validatePurchaseId(value: unknown, label = "purchase"): asserts value is string {
  if (!uuid.safeParse(value).success) throw new Error(`Invalid ${label} ID`)
}

export async function authenticatePurchaseRequest(command: PermissionCommand = "select") {
  const supabase = await createClient(true)
  if (supabase._isDemo || (command !== "select" && (await cookies()).get("market_fit_demo_site_id")?.value)) {
    throw new Error("Demo purchases are read-only")
  }
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || !uuid.safeParse(user.id).success) throw new Error("Not authenticated")
  return { supabase, user }
}

export async function authorizePurchaseSite(supabase: PurchaseClient, siteId: string, command: PermissionCommand) {
  if (typeof siteId === "string" && siteId.startsWith("demo-")) throw new Error("Demo purchases are read-only")
  validatePurchaseId(siteId, "site")
  if (!(await userCanOnSite(supabase, siteId, command))) throw new Error("Not authorized for this site")
}

export async function requirePurchaseAccess(siteId: string, command: PermissionCommand, ...purchaseIds: string[]) {
  purchaseIds.forEach(id => validatePurchaseId(id))
  const context = await authenticatePurchaseRequest(command)
  await authorizePurchaseSite(context.supabase, siteId, command)
  return context
}

export async function purchaseListClient(siteId: string) {
  if (typeof siteId !== "string" || !siteId.startsWith("demo-")) {
    const { supabase } = await requirePurchaseAccess(siteId, "select")
    return { supabase, isDemo: false }
  }
  // Preserve the existing demo list without treating demo identity as real auth.
  // A selected demo can only read its own in-memory fixture, never a real client.
  if ((await cookies()).get("market_fit_demo_site_id")?.value !== siteId) {
    throw new Error("Select this demo before reading its purchases")
  }
  const supabase = await createClient()
  if (supabase._isDemo !== true) throw new Error("Demo purchase data is unavailable")
  const { data, error } = await supabase.from("sites").select("id").eq("id", siteId).single()
  if (error || data?.id !== siteId) throw new Error("Demo site not found")
  return { supabase, isDemo: true }
}

export async function requirePurchaseInSite(supabase: PurchaseClient, siteId: string, purchaseId: string) {
  const { data, error } = await supabase.from("purchases").select("id")
    .eq("id", purchaseId).eq("site_id", siteId).single()
  if (error || !data) throw new Error("Purchase not found in this site")
}

export async function validatePurchaseReferences(supabase: PurchaseClient, siteId: string, values: {
  vendorCompanyId?: string | null
  locationId?: string | null
  items?: PurchaseLineInput[]
}) {
  const references = [
    { table: "companies", id: values.vendorCompanyId, label: "vendor company" },
    { table: "locations", id: values.locationId, label: "location" },
    ...Array.from(new Set((values.items ?? []).map(item => item.catalogItemId)))
      .map(id => ({ table: "catalog_items", id, label: "catalog item" })),
  ]
  for (const { table, id, label } of references) {
    if (id == null) continue
    validatePurchaseId(id, label)
    let query = supabase.from(table).select("id").eq("id", id)
    // Vendors belong to the global company registry; only location/catalog IDs are site-scoped.
    if (table !== "companies") query = query.eq("site_id", siteId)
    const { data, error } = await query.single()
    if (error || !data) throw new Error(`${label[0].toUpperCase()}${label.slice(1)} not found in this site`)
  }
}