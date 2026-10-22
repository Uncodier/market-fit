import { checkoutCart } from "@/app/commerce/checkout";
import { checkInTicket } from "@/app/commerce/ticket-check-in";
import { createLeadWithIdempotency } from "@/app/pos/actions/create-lead-sync";
import { updateOrderNotes } from "@/app/orders/actions";
import { getPosDb } from "./db";
import { getServerIdForLocal, mapLocalId, updateOutboxRow } from "./outbox";
import type { PosOutboxRow } from "./types";
import type { CheckoutCartSuccess } from "@/app/commerce/checkout-client";
import { isPosPermissionCurrent, type PosPermissionLease } from "./location-permission-state";
import { PosCheckoutRecoveryError } from "../checkout-recovery-types";

function assertCurrent(permission: PosPermissionLease) {
  if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed");
}

export async function applyOutboxItem(row: PosOutboxRow, permission: PosPermissionLease): Promise<void> {
  assertCurrent(permission);
  if (row.siteId !== permission.siteId || row.payload.data.siteId !== permission.siteId) throw new Error("POS site changed");
  if (row.payload.kind === "checkout" && row.payload.data.userId !== permission.userId) throw new Error("POS account changed");
  if (row.payload.kind === "create_lead") {
    const data = row.payload.data;
    const res = await createLeadWithIdempotency({
      siteId: data.siteId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      clientMutationId: data.clientMutationId,
    });
    assertCurrent(permission);
    if (res.error || !res.lead) throw new Error(res.error || "Lead sync failed");
    await mapLocalId({
      localId: data.localLeadId,
      serverId: res.lead.id,
      kind: "lead",
      siteId: data.siteId,
    });
    assertCurrent(permission);
    await getPosDb().leads.update(data.localLeadId, {
      is_local: false,
      // Keep local row but also store server id mapping; UI resolves via idMaps
    });
    assertCurrent(permission);
    // Upsert server lead under server id
    await getPosDb().leads.put({
      ...res.lead,
      site_id: data.siteId,
      is_local: false,
    });
    assertCurrent(permission);
    await updateOutboxRow(row.id, {
      status: "synced",
      resultLeadId: res.lead.id,
      lastError: null,
    });
    return;
  }

  if (row.payload.kind === "check_in") {
    const data = row.payload.data;
    const res = await checkInTicket({
      code: data.code,
      siteId: data.siteId,
      clientMutationId: data.clientMutationId,
    });
    assertCurrent(permission);
    if ("error" in res && res.error) throw new Error(res.error);
    await updateOutboxRow(row.id, { status: "synced", lastError: null });
    return;
  }

  if (row.payload.kind === "update_order_notes") {
    const data = row.payload.data;
    const orderId = data.orderId.startsWith("local_")
      ? await getServerIdForLocal(data.orderId)
      : data.orderId;
    if (!orderId) throw new Error("Waiting for local order to sync");

    assertCurrent(permission);
    const res = await updateOrderNotes(data.siteId, orderId, data.notes);
    assertCurrent(permission);
    if ("error" in res && res.error) throw new Error(res.error);
    await updateOutboxRow(row.id, { status: "synced", lastError: null });
    return;
  }

  if (row.payload.kind === "checkout") {
    const data = { ...row.payload.data };
    let leadId = data.leadId;
    if (data.localLeadId) {
      leadId =
        (await getServerIdForLocal(data.localLeadId)) || leadId || undefined;
      if (!leadId) {
        throw new Error("Waiting for local lead to sync");
      }
    }

    let existingOrderId = data.existingOrderId;
    if (existingOrderId?.startsWith("local_")) {
      existingOrderId =
        (await getServerIdForLocal(existingOrderId)) || undefined;
      if (!existingOrderId) throw new Error("Waiting for local order to sync");
    }

    assertCurrent(permission);
    const res = await checkoutCart({
      ...data,
      leadId,
      existingOrderId,
      clientMutationId: data.clientMutationId,
    });
    assertCurrent(permission);
    if ("error" in res && res.error) {
      if ("recovery" in res && res.recovery) throw new PosCheckoutRecoveryError(res.recovery);
      throw new Error(res.error);
    }

    const details = res as Pick<CheckoutCartSuccess, "orderNumber" | "kitchenDelta" | "fulfillment">;

    if (res.orderId && data.existingOrderId?.startsWith("local_")) {
      await mapLocalId({
        localId: data.existingOrderId,
        serverId: res.orderId,
        kind: "order",
        siteId: data.siteId,
      });
    }
    if (res.saleId) {
      assertCurrent(permission);
      await mapLocalId({
        localId: data.clientMutationId,
        serverId: res.saleId,
        kind: "sale",
        siteId: data.siteId,
      });
    }

    assertCurrent(permission);
    await updateOutboxRow(row.id, {
      status: "synced",
      resultSaleId: res.saleId || null,
      resultOrderId: res.orderId || null,
      resultOrderNumber: details.orderNumber || null,
      resultKitchenDelta: details.kitchenDelta || null,
      resultFulfillment: details.fulfillment || null,
      lastError: null,
    });
  }
}

