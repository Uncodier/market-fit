import { getPosDb } from "./db";
import { listOutbox } from "./outbox";
import { readLocalPendingOrders } from "./snapshot-pull";
import { requirePosPermission, isPosPermissionCurrent } from "./location-permission-state";
import { hasPosOrderCartSnapshot } from "../order-session";

/** Local selection never dispatches queue work or establishes payment confirmation. */
export async function readOfflineOrder(siteId: string, orderId: string, cached: Record<string, unknown> | undefined,
  isCurrent: () => boolean) {
  const permission = requirePosPermission(siteId);
  const assertCurrent = () => {
    if (!isCurrent() || !isPosPermissionCurrent(permission)) throw new Error("POS access or order selection changed");
  };
  assertCurrent();
  const orders = await readLocalPendingOrders(siteId);
  assertCurrent();
  const stored = orders.find(order => order.id === orderId && order.site_id === siteId)?.raw as Record<string, unknown> | undefined;
  const snapshot = stored ?? cached;
  if (snapshot?.id && snapshot.id !== orderId) throw new Error("The loaded order does not match the selected order.");
  if (snapshot?.site_id && snapshot.site_id !== siteId) throw new Error("This order belongs to another site.");
  if (snapshot && hasPosOrderCartSnapshot(snapshot)) return snapshot;

  const rows = await listOutbox(siteId);
  assertCurrent();
  const row = rows.filter(row => row.siteId === siteId && row.payload.kind === "checkout" &&
    row.payload.data.siteId === siteId && row.payload.data.userId === permission.userId &&
    row.recoveryState !== "rejected" &&
    (row.payload.data.existingOrderId === orderId || `local_${row.clientMutationId}` === orderId ||
      row.resultOrderId === orderId || row.recoveryOrderId === orderId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!row || row.payload.kind !== "checkout") throw new Error("This order is not available on this device while offline.");
  const data = row.payload.data;
  let baseline: Record<string, unknown> = {};
  if (data.expectedOrderVersion) {
    try { baseline = JSON.parse(data.expectedOrderVersion); } catch {
      throw new Error("The saved order version is invalid. Reconnect to refresh this order.");
    }
    if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
      throw new Error("The saved order version is invalid. Reconnect to refresh this order.");
    }
  }
  const orderCurrency = typeof baseline.currency === "string" ? baseline.currency : undefined;
  const db = getPosDb();
  const ids = data.lines.flatMap(line => [line.catalogItemId, ...(line.modifiers || []).map(modifier => modifier.catalogItemId)]);
  const leadId = data.leadId || data.localLeadId;
  const [items, lead] = await Promise.all([
    db.catalogItems.bulkGet(ids),
    leadId ? db.leads.get(leadId) : undefined,
  ]);
  assertCurrent();
  if (lead && lead.site_id !== siteId) throw new Error("This customer belongs to another site.");
  const queuedLead = rows.find(candidate => candidate.siteId === siteId && candidate.payload.kind === "create_lead" &&
    candidate.payload.data.siteId === siteId && candidate.payload.data.localLeadId === leadId);
  const leadName = lead?.name || lead?.email || (queuedLead?.payload.kind === "create_lead" ? queuedLead.payload.data.name : null);
  const catalog = new Map(items.filter(item => item && item.site_id === siteId).map(item => [item!.id, item!]));
  const priceCurrency = (catalogItemId: string, persistedId?: string) => {
    const currency = persistedId ? orderCurrency : catalog.get(catalogItemId)?.currency;
    if (persistedId && !currency) throw new Error("The saved line currency is unavailable. Reconnect to refresh this order.");
    return currency;
  };
  const saleOrderItems = data.lines.flatMap((line, index) => {
    const item = catalog.get(line.catalogItemId);
    const id = line.saleOrderItemId || `local_${row.clientMutationId}_${index}`;
    return [{ id, catalog_item_id: line.catalogItemId, name: item?.name,
      quantity: line.quantity, unit_price: line.unitPriceOverride,
      status: "sent", parent_sale_order_item_id: null as string | null,
      metadata: { client_line_key: line.clientLineKey || id,
        local_currency: priceCurrency(line.catalogItemId, line.saleOrderItemId),
        reservation_start: line.reservationStart, reservation_end: line.reservationEnd },
    }, ...(line.modifiers || []).map((modifier, modifierIndex) => ({
      id: modifier.saleOrderItemId || `local_${row.clientMutationId}_${index}_modifier_${modifierIndex}`,
      catalog_item_id: modifier.catalogItemId, name: catalog.get(modifier.catalogItemId)?.name,
      quantity: modifier.quantity * line.quantity, unit_price: modifier.unitPriceOverride,
      status: "sent", parent_sale_order_item_id: id,
      metadata: { modifier_group_id: modifier.groupId,
        local_currency: priceCurrency(modifier.catalogItemId, modifier.saleOrderItemId) },
    }))];
  });
  return { ...snapshot, id: orderId, site_id: siteId, status: snapshot?.status || "pending",
    pending_sync: true, expected_order_version: data.expectedOrderVersion,
    // Queued overrides use each catalog currency, except persisted line references.
    currency: orderCurrency, local_checkout_snapshot: true,
    local_promotion_code: data.promotionCode, local_promotion_id: data.promotionId,
    leads: leadId ? { id: leadId, name: leadName || "Saved customer" } : null,
    notes: data.notes, fulfillment_method: data.fulfillment, origin_location_id: data.originLocationId,
    price_list_id: data.priceListId, buyer_user_id: data.buyerUserId, seller_user_id: data.sellerUserId,
    shipping_address: data.shippingAddress, sale_order_items: saleOrderItems,
  };
}