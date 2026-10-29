import { readOfflineOrder } from "@/app/pos/local/read-offline-order";
import { listOutbox } from "@/app/pos/local/outbox";
import { getPosDb } from "@/app/pos/local/db";
import { readLocalPendingOrders } from "@/app/pos/local/snapshot-pull";
import { isPosPermissionCurrent } from "@/app/pos/local/location-permission-state";
import { hasPosOrderCartSnapshot, posSessionFromOrder } from "@/app/pos/order-session";
import type { PosOutboxRow } from "@/app/pos/local/types";
import { posCheckoutLines } from "@/app/pos/checkout-lines";
import { planPosLeadSync } from "@/app/pos/lead-utils";
import { posCartSubtotalInSiteCurrency } from "@/app/pos/cart-totals";

jest.mock("@/app/pos/local/outbox", () => ({ listOutbox: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/snapshot-pull", () => ({ readLocalPendingOrders: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: () => ({ siteId: "site", userId: "cashier", offline: true }),
  isPosPermissionCurrent: jest.fn(() => true),
}));

let row: PosOutboxRow;
const mockLead = jest.fn();
const mockItems = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(isPosPermissionCurrent).mockReturnValue(true);
  row = { id: "row", siteId: "site", kind: "checkout", clientMutationId: "original",
    status: "syncing", attempts: 1, createdAt: "2026-01-01", updatedAt: "2026-01-01",
    payload: { kind: "checkout", data: { siteId: "site", userId: "cashier", source: "pos",
      clientMutationId: "original", fulfillment: "pickup", intent: "send", notes: "Keep warm",
      payments: [], lines: [{ catalogItemId: "coffee", quantity: 2, unitPriceOverride: 10,
        clientLineKey: "coffee-key", modifiers: [{ catalogItemId: "milk", quantity: 1, unitPriceOverride: 2, groupId: "extras" }] }],
    } },
  };
  jest.mocked(listOutbox).mockImplementation(async () => [row]);
  jest.mocked(readLocalPendingOrders).mockResolvedValue([]);
  mockLead.mockResolvedValue(undefined);
  mockItems.mockResolvedValue([
    { id: "coffee", site_id: "site", name: "Coffee", currency: "USD" },
    { id: "milk", site_id: "site", name: "Milk", currency: "USD" },
  ]);
  jest.mocked(getPosDb).mockReturnValue({ catalogItems: { bulkGet: mockItems }, leads: { get: mockLead } } as never);
});

it.each(["pending", "syncing", "failed"] as const)("opens a %s local stub from its saved checkout without mutating the queue", async (status) => {
  row.status = status;
  const original = JSON.stringify(row);
  const order = await readOfflineOrder("site", "local_original", { id: "local_original", pending_sync: true }, () => true);
  expect(hasPosOrderCartSnapshot(order)).toBe(true);
  const session = posSessionFromOrder(order, []);
  expect(session).toMatchObject({ orderNotes: "Keep warm", fulfillment: "pickup", existingPaymentTotal: 0 });
  expect(session?.cart?.[0]).toMatchObject({ cartQty: 2, cartPrice: 10, lineKey: "coffee-key",
    saleOrderItemId: undefined, modifiers: [{ cartQty: 1, cartPrice: 2, saleOrderItemId: undefined }] });
  expect(JSON.stringify(row)).toBe(original);
});

it("never treats an unconfirmed collected payment as paid", async () => {
  if (row.payload.kind === "checkout") row.payload.data.payments = [{ method: "cash", amount: 24 }];
  const order = await readOfflineOrder("site", "local_original", undefined, () => true);
  expect(posSessionFromOrder(order, [])?.existingPaymentTotal).toBe(0);
});

it("preserves mixed currencies for hosts and modifiers without relabeling prices", async () => {
  mockItems.mockResolvedValue([
    { id: "coffee", site_id: "site", name: "Coffee", currency: "USD" },
    { id: "milk", site_id: "site", name: "Milk", currency: "MXN" },
  ]);
  const order = await readOfflineOrder("site", "local_original", undefined, () => true);
  const cart = posSessionFromOrder(order, [])!.cart!;
  expect(cart[0].currency).toBe("USD");
  expect(cart[0].modifiers![0].currency).toBe("MXN");
  expect(posCartSubtotalInSiteCurrency(cart, "USD", { USD: 1, MXN: 20 })).toBe(20.2);
});

it("keeps persisted prices in their original order currency instead of today's catalog currency", async () => {
  if (row.payload.kind !== "checkout") throw new Error("Invalid fixture");
  row.payload.data.lines[0].saleOrderItemId = "persisted-line";
  row.payload.data.expectedOrderVersion = JSON.stringify({ currency: "EUR" });
  const order = await readOfflineOrder("site", "local_original", undefined, () => true);
  const cart = posSessionFromOrder(order, [])!.cart!;
  expect(cart[0]).toMatchObject({ currency: "EUR", saleOrderItemId: "persisted-line", cartPrice: 10 });
  expect(cart[0].modifiers![0]).toMatchObject({ currency: "USD", saleOrderItemId: undefined });
});

it("restores reservation times into the next checkout payload", async () => {
  if (row.payload.kind !== "checkout") throw new Error("Invalid fixture");
  row.payload.data.lines[0].reservationStart = "2026-11-01T10:00:00Z";
  row.payload.data.lines[0].reservationEnd = "2026-11-01T11:00:00Z";
  const order = await readOfflineOrder("site", "local_original", undefined, () => true);
  const lines = posCheckoutLines(posSessionFromOrder(order, [])!.cart!);
  expect(lines[0]).toMatchObject({ reservationStart: "2026-11-01T10:00:00Z", reservationEnd: "2026-11-01T11:00:00Z" });
});

it.each(["customer", "local_customer"])("restores customer %s without creating another lead", async (id) => {
  if (row.payload.kind !== "checkout") throw new Error("Invalid fixture");
  if (id.startsWith("local_")) row.payload.data.localLeadId = id;
  else row.payload.data.leadId = id;
  mockLead.mockResolvedValue({ id, site_id: "site", name: "Guest" });
  const order = await readOfflineOrder("site", "local_original", undefined, () => true);
  const lead = posSessionFromOrder(order, [])!.leadValue;
  expect(lead).toEqual({ mode: "existing", id, label: "Guest" });
  const createId = jest.fn();
  expect(planPosLeadSync(lead, createId)).toEqual({ resolvedLeadId: id.startsWith("local_") ? null : id,
    localLeadId: id.startsWith("local_") ? id : null, createLead: null });
  expect(createId).not.toHaveBeenCalled();
});

it("keeps a queued customer identity and name before its catalog record exists", async () => {
  if (row.payload.kind !== "checkout") throw new Error("Invalid fixture");
  row.payload.data.localLeadId = "local_customer";
  jest.mocked(listOutbox).mockResolvedValue([row, { ...row, id: "lead-row", kind: "create_lead",
    payload: { kind: "create_lead", data: { siteId: "site", localLeadId: "local_customer", name: "Offline guest", clientMutationId: "lead" } } }]);
  const order = await readOfflineOrder("site", "local_original", undefined, () => true);
  expect(posSessionFromOrder(order, [])!.leadValue).toEqual({ mode: "existing", id: "local_customer", label: "Offline guest" });
});

it("rejects a customer cache record from another site", async () => {
  if (row.payload.kind !== "checkout") throw new Error("Invalid fixture");
  row.payload.data.leadId = "customer";
  mockLead.mockResolvedValue({ id: "customer", site_id: "other", name: "Other guest" });
  await expect(readOfflineOrder("site", "local_original", undefined, () => true)).rejects.toThrow("another site");
});

it("prefers the durable snapshot over stale selector data", async () => {
  const snapshot = { id: "server", site_id: "site", status: "pending", sale_order_items: [{
    id: "line", catalog_item_id: "coffee", name: "Coffee", unit_price: 10, quantity: 2,
    metadata: {}, parent_sale_order_item_id: null,
  }] };
  jest.mocked(readLocalPendingOrders).mockResolvedValue([{ id: "server", site_id: "site", raw: snapshot }] as never);
  await expect(readOfflineOrder("site", "server", { id: "server", notes: "Stale" }, () => true)).resolves.toEqual(snapshot);
  expect(listOutbox).not.toHaveBeenCalled();
});

it("rejects a mismatched snapshot identity", async () => {
  jest.mocked(readLocalPendingOrders).mockResolvedValue([{ id: "server", site_id: "site", raw: { id: "other" } }] as never);
  await expect(readOfflineOrder("site", "server", undefined, () => true)).rejects.toThrow("does not match");
});

it.each(["site", "actor", "rejected"])("does not reconstruct a %s mismatch", async (reason) => {
  if (reason === "site") row.siteId = "other";
  if (reason === "actor" && row.payload.kind === "checkout") row.payload.data.userId = "other";
  if (reason === "rejected") row.recoveryState = "rejected";
  await expect(readOfflineOrder("site", "local_original", undefined, () => true)).rejects.toThrow("not available");
});

it("discards a local read after the selection or permission changes", async () => {
  jest.mocked(readLocalPendingOrders).mockImplementation(async () => {
    jest.mocked(isPosPermissionCurrent).mockReturnValue(false);
    return [];
  });
  await expect(readOfflineOrder("site", "local_original", undefined, () => true)).rejects.toThrow("changed");
  expect(listOutbox).not.toHaveBeenCalled();
});