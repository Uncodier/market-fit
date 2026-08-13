"use server"

import { createClient } from "@/lib/supabase/server"

export async function markKitchenItemsPrinted(
  siteId: string,
  items: { id: string; quantity: number }[],
): Promise<{ error?: string }> {
  if (!siteId || !items.length) return {}
  try {
    const supabase = await createClient()
    for (const item of items) {
      const { data, error } = await supabase
        .from("sale_order_items")
        .select("id, metadata")
        .eq("site_id", siteId)
        .eq("id", item.id)
        .maybeSingle()
      if (error || !data) continue
      const metadata = {
        ...(data.metadata && typeof data.metadata === "object" ? data.metadata : {}),
        printed_quantity: item.quantity,
      }
      await supabase
        .from("sale_order_items")
        .update({ metadata })
        .eq("id", item.id)
        .eq("site_id", siteId)
    }
    return {}
  } catch (e: any) {
    return { error: e?.message || "Failed to mark items printed" }
  }
}
