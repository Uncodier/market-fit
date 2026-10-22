import { act, renderHook } from "@testing-library/react";
import { useCheckoutAttempt } from "@/app/pos/hooks/use-checkout-attempt";
import { clearCartSession } from "@/app/pos/local/cart-session";
import { enqueueRegisteredCheckout } from "@/app/pos/register/prepare-payment";
import { enqueueCheckout, listOutbox } from "@/app/pos/local/outbox";
import { getActiveRegisterForPayment } from "@/app/pos/register/actions";
import { syncPosCheckout } from "@/app/pos/local/sync-engine";
import { checkoutAttemptKey } from "@/app/pos/local/checkout-attempt-storage";
import type { CheckoutOutboxPayload, PosOutboxRow } from "@/app/pos/local/types";

jest.mock("@/app/pos/register/actions", () => ({ getActiveRegisterForPayment: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({ requirePosPermission: () => ({}), isPosPermissionCurrent: () => true }));
jest.mock("@/app/pos/local/outbox", () => ({ enqueueCheckout: jest.fn(), listOutbox: jest.fn() }));
jest.mock("@/app/pos/local/sync-engine", () => ({ syncPosCheckout: jest.fn() }));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: () => ({ cartSessions: { put: jest.fn().mockResolvedValue(undefined) } }) }));

const cart = [{ id: "coffee", cartQty: 1, cartPrice: 10 }];
const payload: Omit<CheckoutOutboxPayload, "clientMutationId"> = {
  siteId: "site", userId: "actor", source: "pos", fulfillment: "pickup",
  lines: [{ catalogItemId: "coffee", quantity: 1 }], payments: [{ method: "cash", amount: 10 }],
};
let rows: PosOutboxRow[];
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  rows = [];
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_name: string, _options: unknown, action: () => Promise<unknown>) => action() } });
  jest.mocked(listOutbox).mockImplementation(async () => rows);
  jest.mocked(getActiveRegisterForPayment).mockResolvedValue({ data: { id: "register", location_id: "store" } } as never);
  jest.mocked(enqueueCheckout).mockImplementation(async (_site, data, checkoutCartSessionId) => {
    const row = { id: "row", kind: "checkout", status: "pending", clientMutationId: data.clientMutationId,
      checkoutCartSessionId, payload: { kind: "checkout", data } } as PosOutboxRow;
    rows.push(row);
    return row;
  });
  jest.mocked(syncPosCheckout).mockResolvedValue(undefined);
});

it("recovers a synced ambiguous receipt after hook remount, but permits a fresh identical cart after reset", async () => {
  const first = renderHook(() => useCheckoutAttempt("site", "actor"));
  const id = first.result.current.id(cart);
  await expect(enqueueRegisteredCheckout("site", { ...payload, clientMutationId: id })).rejects.toThrow("not confirmed");
  const paymentIds = rows[0].payload;
  // The workspace unmounts on expiry/offline. Background confirmation wins the retry race.
  first.unmount();
  rows[0].status = "synced";
  const second = renderHook(() => useCheckoutAttempt("site", "actor"));
  expect(second.result.current.id(cart)).toBe(id);
  await expect(enqueueRegisteredCheckout("site", { ...payload, clientMutationId: second.result.current.id(cart) })).resolves.toBe(rows[0]);
  expect(enqueueCheckout).toHaveBeenCalledTimes(1);
  expect(rows[0].payload).toBe(paymentIds);
  expect(getActiveRegisterForPayment).toHaveBeenCalledTimes(1);
  const oldSession = second.result.current.session();
  await act(async () => { await clearCartSession("site"); });
  expect(second.result.current.isCurrent(oldSession)).toBe(false);
  expect(localStorage.getItem(checkoutAttemptKey("site", "actor", oldSession, cart))).toBe(id);
  const freshId = second.result.current.id(cart);
  expect(freshId).not.toBe(id);
  jest.mocked(syncPosCheckout).mockImplementation(async () => { rows.forEach((row) => { row.status = "synced"; }); });
  await enqueueRegisteredCheckout("site", { ...payload, clientMutationId: freshId });
  expect(enqueueCheckout).toHaveBeenCalledTimes(2);
});

it("retains per-cart attempts until explicitly cleared and isolates actors/sites", () => {
  const { result, rerender } = renderHook(({ site, actor }) => useCheckoutAttempt(site, actor), { initialProps: { site: "site", actor: "actor" } });
  const id = result.current.id(cart);
  const changed = result.current.id([{ ...cart[0], cartQty: 2 }]);
  expect(changed).not.toBe(id);
  expect(result.current.id(cart)).toBe(id);
  rerender({ site: "site", actor: "other" });
  expect(result.current.id(cart)).not.toBe(id);
  rerender({ site: "other", actor: "actor" });
  expect(result.current.id(cart)).not.toBe(id);
  rerender({ site: "site", actor: "actor" });
  expect(result.current.id(cart)).toBe(id);
  result.current.clear();
  expect(result.current.id(cart)).not.toBe(id);
  expect(JSON.stringify(localStorage)).not.toContain("coffee");
});

it("fails closed before collecting when durable storage is unavailable", () => {
  const { result } = renderHook(() => useCheckoutAttempt("site", "actor"));
  const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage unavailable"); });
  try { expect(() => result.current.id(cart)).toThrow("storage unavailable"); }
  finally { write.mockRestore(); }
  expect(enqueueCheckout).not.toHaveBeenCalled();
});

it("persists an older pending receipt recovered by fingerprint before ambiguous synchronization", async () => {
  await expect(enqueueRegisteredCheckout("site", { ...payload, clientMutationId: "older-receipt" })).rejects.toThrow("not confirmed");
  const first = renderHook(() => useCheckoutAttempt("site", "actor"));
  const provisional = first.result.current.id(cart);
  await expect(enqueueRegisteredCheckout("site", { ...payload, clientMutationId: provisional }, first.result.current.adopt)).rejects.toThrow("not confirmed");
  first.unmount();
  rows[0].status = "synced";
  const retry = renderHook(() => useCheckoutAttempt("site", "actor"));
  expect(retry.result.current.id(cart)).toBe("older-receipt");
  await enqueueRegisteredCheckout("site", { ...payload, clientMutationId: retry.result.current.id(cart) });
  expect(enqueueCheckout).toHaveBeenCalledTimes(1);
});