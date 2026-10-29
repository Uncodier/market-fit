import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import type { CatalogItem } from "@/app/types";
import { usePosCart } from "@/app/pos/hooks/use-pos-cart";
import { posCheckoutLines } from "@/app/pos/checkout-lines";
import { planPosLeadSync } from "@/app/pos/lead-utils";
import { readOfflineOrder } from "@/app/pos/local/read-offline-order";
import { getPosDb } from "@/app/pos/local/db";
import { listOutbox } from "@/app/pos/local/outbox";
import { readLocalPendingOrders } from "@/app/pos/local/snapshot-pull";
import { clearCartSession, loadCartSession, saveCartSession } from "@/app/pos/local/cart-session";
import { fetchPosOrder } from "@/app/pos/operation-client";
import { resolvePendingOrder } from "@/app/pos/local/resolve-pending-order";
import type { CheckoutOutboxPayload, LocalPromotion, PosOutboxRow } from "@/app/pos/local/types";

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ rates: { EUR: 0.9, MXN: 18 } }),
}));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({ listOutbox: jest.fn() }));
jest.mock("@/app/pos/local/snapshot-pull", () => ({ readLocalPendingOrders: jest.fn() }));
jest.mock("@/app/pos/local/cart-session", () => ({
  loadCartSession: jest.fn(), saveCartSession: jest.fn(), clearCartSession: jest.fn(),
}));
jest.mock("@/app/pos/operation-client", () => ({ fetchPosOrder: jest.fn() }));
jest.mock("@/app/pos/local/resolve-pending-order", () => ({ resolvePendingOrder: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: () => ({ siteId: "site", userId: "cashier", offline: true }),
  getPosPermissionLease: () => ({ siteId: "site", userId: "cashier", offline: true }),
  isPosPermissionCurrent: () => true,
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn(), success: jest.fn() } }));

// Only persistence, permission and network boundaries are mocked. Reconstruction,
// order selection, cart totals and usePosPromo all run their real implementations.
const catalog = [
  { id: "host", site_id: "site", name: "Room", kind: "service", currency: "MXN",
    availability_mode: "always", target_sale_price: 999, metadata: { delivery_options: ["pickup"] } },
  { id: "extra", site_id: "site", name: "Equipment", kind: "product", currency: "EUR",
    availability_mode: "always", target_sale_price: 999 },
] as CatalogItem[];
const reservationStart = "2026-12-01T10:00:00.000Z";
const reservationEnd = "2026-12-01T11:00:00.000Z";
const leadGet = jest.fn();
let checkout: CheckoutOutboxPayload;
let rows: PosOutboxRow[];

function outboxRow(payload: PosOutboxRow["payload"], id = "ticket"): PosOutboxRow {
  return { id, siteId: "site", kind: payload.kind, payload, clientMutationId: id,
    status: "pending", attempts: 0, createdAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-01T10:00:00Z" };
}

function promotion(overrides: Partial<LocalPromotion> = {}): LocalPromotion {
  return { id: "saved", site_id: "site", name: "Saved offer", code: "SAVE10", status: "active",
    discount_type: "percentage", discount_value: 10, applies_to: "order", channels: ["pos"], ...overrides };
}

function options(promotions: LocalPromotion[] = []): Parameters<typeof usePosCart>[0] {
  return { siteId: "site", siteCurrency: "USD", catalogItems: catalog, locations: [{ id: "store" }],
    priceLists: [], priceListItems: [], promotions,
    pendingOrders: [{ id: "local_ticket", site_id: "site", status: "pending", pending_sync: true }],
    preloadedTaxesByItem: { host: [{ rate: 10 }], extra: [{ rate: 5 }] },
    getTaxesForCart: jest.fn().mockResolvedValue({}), t: (key) => key };
}

async function ready(promotions: LocalPromotion[] = []) {
  const hook = renderHook(usePosCart, { initialProps: options(promotions) });
  await waitFor(() => expect(hook.result.current.sessionReady).toBe(true));
  return hook;
}

async function select(hook: Awaited<ReturnType<typeof ready>>, expected = true) {
  await act(async () => {
    expect(await hook.result.current.handleOrderSelect("local_ticket")).toBe(expected);
  });
  expect(hook.result.current.loadingOrder).toBe(false);
  expect(fetchPosOrder).not.toHaveBeenCalled();
  expect(resolvePendingOrder).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  checkout = { siteId: "site", userId: "cashier", source: "pos", clientMutationId: "ticket",
    fulfillment: "pickup", originLocationId: "store", intent: "send", notes: "Keep equipment ready",
    payments: [], lines: [{ catalogItemId: "host", quantity: 2, unitPriceOverride: 180,
      clientLineKey: "reservation-line", reservationStart, reservationEnd,
      modifiers: [{ catalogItemId: "extra", quantity: 3, unitPriceOverride: 9, groupId: "equipment" }] }] };
  rows = [outboxRow({ kind: "checkout", data: checkout })];
  leadGet.mockResolvedValue(undefined);
  jest.mocked(getPosDb).mockReturnValue({
    catalogItems: { bulkGet: async (ids: string[]) => ids.map(id => catalog.find(item => item.id === id)) },
    leads: { get: leadGet },
  } as never);
  jest.mocked(listOutbox).mockImplementation(async () => rows);
  jest.mocked(readLocalPendingOrders).mockResolvedValue([]);
  jest.mocked(loadCartSession).mockResolvedValue({ activeOrderId: "new", cart: [], leadValue: null } as never);
  jest.mocked(saveCartSession).mockResolvedValue({} as never);
  jest.mocked(clearCartSession).mockResolvedValue({} as never);
});

afterEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

it("reconstructs mixed-currency hosts/modifiers and roundtrips reservation checkout lines without repricing", async () => {
  const original = JSON.stringify(rows);
  const snapshot = await readOfflineOrder("site", "local_ticket", undefined, () => true);
  expect(snapshot).toMatchObject({ local_checkout_snapshot: true, pending_sync: true,
    sale_order_items: [
      { quantity: 2, unit_price: 180, metadata: { local_currency: "MXN", reservation_start: reservationStart,
        reservation_end: reservationEnd, client_line_key: "reservation-line" } },
      { quantity: 6, unit_price: 9, metadata: { local_currency: "EUR", modifier_group_id: "equipment" } },
    ] });
  const hook = await ready();
  await select(hook);
  expect(hook.result.current.cart).toMatchObject([{ id: "host", currency: "MXN", cartQty: 2, cartPrice: 180,
    reservationStart, reservationEnd,
    modifiers: [{ catalogItemId: "extra", currency: "EUR", cartQty: 3, cartPrice: 9 }] }]);
  // MXN 360 = USD 20; EUR 54 = USD 60. Taxes are 2 + 3.
  expect(hook.result.current.cartCurrency).toBe("USD");
  expect(hook.result.current.subtotal).toBe(80);
  expect(hook.result.current.taxTotal).toBe(5);
  expect(hook.result.current.total).toBe(85);
  expect(hook.result.current.existingPaymentTotal).toBe(0);
  expect(hook.result.current.orderNotes).toBe(checkout.notes);
  expect(posCheckoutLines(hook.result.current.cart)).toEqual(checkout.lines);
  expect(JSON.stringify(rows)).toBe(original);
});

it("uses the saved order currency for persisted line references instead of current catalog currencies", async () => {
  checkout.expectedOrderVersion = JSON.stringify({ currency: "USD" });
  checkout.lines[0].saleOrderItemId = "persisted-host";
  checkout.lines[0].unitPriceOverride = 10;
  checkout.lines[0].modifiers![0].saleOrderItemId = "persisted-extra";
  checkout.lines[0].modifiers![0].unitPriceOverride = 2;
  const hook = await ready();
  await select(hook);
  expect(hook.result.current.cart).toMatchObject([{ currency: "USD", saleOrderItemId: "persisted-host",
    modifiers: [{ currency: "USD", saleOrderItemId: "persisted-extra" }] }]);
  expect(hook.result.current.expectedOrderVersion).toBe(checkout.expectedOrderVersion);
  expect(hook.result.current.subtotal).toBe(32);
  expect(hook.result.current.taxTotal).toBe(2.6);
  expect(hook.result.current.total).toBe(34.6);
  expect(posCheckoutLines(hook.result.current.cart)).toEqual(checkout.lines);
});

it.each(["server", "local-db", "local-queue"])("roundtrips a %s customer without queuing a duplicate lead", async (source) => {
  const id = source === "server" ? "customer" : "local_customer";
  if (source === "server") checkout.leadId = id;
  else checkout.localLeadId = id;
  if (source === "local-queue") {
    rows.push(outboxRow({ kind: "create_lead", data: { siteId: "site", localLeadId: id,
      name: "Saved customer", clientMutationId: "lead-mutation" } }, "lead-mutation"));
  } else {
    leadGet.mockResolvedValue({ id, site_id: "site", name: "Saved customer" });
  }
  const original = JSON.stringify(rows);
  const hook = await ready();
  await select(hook);
  const lead = hook.result.current.leadValue;
  expect(lead).toEqual({ mode: "existing", id, label: "Saved customer" });
  if (typeof lead === "string") throw new Error("Expected a customer picker value");
  const createId = jest.fn();
  expect(planPosLeadSync(lead, createId)).toEqual({
    resolvedLeadId: source === "server" ? id : null,
    localLeadId: source === "server" ? null : id, createLead: null,
  });
  expect(createId).not.toHaveBeenCalled();
  expect(leadGet).toHaveBeenCalledWith(id);
  expect(JSON.stringify(rows)).toBe(original);
});

it.each(["code", "code-and-id", "no-code"])("preserves the saved %s promotion through the real promotion effect", async (kind) => {
  const saved = promotion({ code: kind === "no-code" ? null : "SAVE10" });
  checkout.promotionCode = kind === "no-code" ? undefined : " save10 ";
  checkout.promotionId = kind === "code" ? undefined : saved.id;
  const competing = promotion({ id: "better-offer", name: "Different automatic offer", code: null, discount_value: 50 });
  const snapshot = await readOfflineOrder("site", "local_ticket", undefined, () => true);
  expect(snapshot).toMatchObject({ local_promotion_code: checkout.promotionCode, local_promotion_id: checkout.promotionId });
  const hook = await ready([competing, saved]);
  await select(hook);
  expect(hook.result.current.appliedPromo).toMatchObject({ promotionId: "saved", promotionName: "Saved offer",
    code: saved.code, discount: 8, orderSubtotal: 80, byConditions: kind === "no-code" });
  expect(hook.result.current.promoCode).toBe(saved.code || "");
  expect(hook.result.current.promoDiscount).toBe(8);
  expect(hook.result.current.total).toBe(77);
  expect(hook.result.current.validateInventory()).toBe(true);
  // A later catalog refresh must not drop or replace the hydrated recorded offer.
  hook.rerender(options([competing]));
  expect(hook.result.current.appliedPromo?.promotionId).toBe("saved");
  expect(hook.result.current.promoDiscount).toBe(8);
  await waitFor(() => expect(saveCartSession).toHaveBeenLastCalledWith(expect.objectContaining({
    activeOrderId: "local_ticket", recordedOrderPromo: expect.objectContaining({ promotionId: "saved", discount: 8 }),
  })));
});

it.each(["missing-code", "missing-id", "mismatched-code", "inactive"])("fails safely for a %s saved promotion rather than opening an undiscounted or replacement cart", async (reason) => {
  checkout.promotionCode = reason === "missing-id" ? undefined : "SAVE10";
  checkout.promotionId = reason === "missing-code" ? undefined : "saved";
  const promotions = [promotion({ id: "replacement", code: null, discount_value: 50 })];
  if (reason === "mismatched-code") promotions.push(promotion({ code: "OTHER" }));
  if (reason === "inactive") promotions.push(promotion({ status: "inactive" }));
  const original = JSON.stringify(rows);
  const hook = await ready(promotions);
  await select(hook, false);
  expect(hook.result.current.activeOrderId).toBe("new");
  expect(hook.result.current.cart).toEqual([]);
  expect(hook.result.current.appliedPromo).toBeNull();
  expect(hook.result.current.total).toBe(0);
  expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/saved promotion.*(unavailable|needs review)/i));
  expect(JSON.stringify(rows)).toBe(original);
});

it("retains the saved discount preview even when the promotion catalog has changed", async () => {
  checkout.promotionCode = "SAVE10";
  checkout.promotionId = "saved";
  jest.mocked(readLocalPendingOrders).mockResolvedValue([{ id: "local_ticket", site_id: "site", raw: {
    id: "local_ticket", status: "pending", pending_sync: true,
    promotion_id: "saved", discount_total: 8, subtotal: 80,
    promotions: { name: "Original offer", code: "SAVE10" },
  } }] as never);
  const hook = await ready([]);
  await select(hook);
  expect(hook.result.current.appliedPromo).toMatchObject({ promotionId: "saved", discount: 8, code: "SAVE10" });
  expect(hook.result.current.total).toBe(77);
});