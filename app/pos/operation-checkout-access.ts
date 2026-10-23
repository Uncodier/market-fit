import "server-only";
import type { requirePosSiteAccess } from "./actions/site-access";
import type { PosOperation } from "./operation-schemas";

type Access = Extract<Awaited<ReturnType<typeof requirePosSiteAccess>>, { user: { id: string } }>;
type CheckoutInput = Extract<PosOperation, { operation: "checkout" }>["input"];

/** Verify foreign keys before checkout can reach its existing service-role helpers. */
export async function hasPosCheckoutReferenceAccess(access: Access, input: CheckoutInput) {
  const { supabase } = access;
  const { siteId } = input;
  const belongsToSite = async (table: string, ids: string[]) => {
    const unique = [...new Set(ids)];
    if (!unique.length) return true;
    const result = await supabase.from(table).select("id").eq("site_id", siteId).in("id", unique);
    return !result.error && result.data?.length === unique.length;
  };
  const lines = input.lines.flatMap((line) => [line, ...(line.modifiers || [])]);
  const references: Array<[string, string[]]> = [
    ["catalog_items", lines.map((line) => line.catalogItemId)],
    ["modifier_groups", input.lines.flatMap((line) => (line.modifiers || []).flatMap((modifier) => modifier.groupId ? [modifier.groupId] : []))],
    ["sale_orders", input.existingOrderId ? [input.existingOrderId] : []],
    ["leads", input.leadId ? [input.leadId] : []],
    ["price_lists", input.priceListId ? [input.priceListId] : []],
    ["promotions", input.promotionId ? [input.promotionId] : []],
    ["locations", input.originLocationId ? [input.originLocationId] : []],
    ["pos_register_sessions", input.registerSessionId ? [input.registerSessionId] : []],
    ["reservations", input.existingReservationId ? [input.existingReservationId] : []],
  ];
  if (!(await Promise.all(references.map(([table, ids]) => belongsToSite(table, ids)))).every(Boolean)) return false;

  const orderLineIds = [...new Set(lines.flatMap((line) => line.saleOrderItemId ? [line.saleOrderItemId] : []))];
  if (orderLineIds.length) {
    if (!input.existingOrderId) return false;
    const result = await supabase.from("sale_order_items").select("id")
      .eq("site_id", siteId).eq("sale_order_id", input.existingOrderId).in("id", orderLineIds);
    if (result.error || result.data?.length !== orderLineIds.length) return false;
  }
  if (input.buyerUserId) {
    // A selected customer is attribution, never authority to act as another account.
    let query = supabase.from("leads").select("id").eq("site_id", siteId).eq("buyer_user_id", input.buyerUserId);
    if (input.leadId) query = query.eq("id", input.leadId);
    const result = await query.limit(1);
    if (result.error || !result.data?.length) return false;
  }
  return true;
}