import { createClient } from "@/lib/supabase/server"

type UserClient = Awaited<ReturnType<typeof createClient>>

export async function assertInternalOrder(supabase: UserClient, siteId: string, orderId: string) {
  const { data, error } = await supabase.from("sale_orders").select("id, metadata")
    .eq("site_id", siteId).eq("id", orderId).maybeSingle()
  if (error || !data) throw new Error("Order not found")
  if (data.metadata?.marketplace) throw new Error("Use the marketplace order actions to update this order")
}

export async function assertInternalShipment(supabase: UserClient, siteId: string, shipmentId: string) {
  const { data, error } = await supabase.from("shipments").select("id, metadata")
    .eq("site_id", siteId).eq("id", shipmentId).maybeSingle()
  if (error || !data) throw new Error("Shipment not found")
  if (data.metadata?.marketplace) throw new Error("This shipment is managed by the marketplace provider")
}