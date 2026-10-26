import { act, renderHook } from "@testing-library/react";
import { clearCartSession, loadCartSession, saveCartSession } from "@/app/pos/local/cart-session";
import { useCheckoutAttempt } from "@/app/pos/hooks/use-checkout-attempt";
import { enqueueRegisteredCheckout } from "@/app/pos/register/prepare-payment";
import { enqueueCheckout, listOutbox } from "@/app/pos/local/outbox";
import { fetchActivePaymentRegister } from "@/app/pos/operation-client";
import { getCheckoutCartSession } from "@/app/pos/local/checkout-attempt-storage";
import type { CheckoutOutboxPayload, PosCartSession, PosOutboxRow } from "@/app/pos/local/types";

const put = jest.fn();
const get = jest.fn();
jest.mock("@/app/pos/local/db", () => ({ getPosDb: () => ({ cartSessions: { put, get } }) }));
jest.mock("@/app/pos/operation-client", () => ({ fetchActivePaymentRegister: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({ enqueueCheckout: jest.fn(), listOutbox: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: (siteId: string) => ({ siteId, userId: "actor", generation: 1 }),
  getPosPermissionLease: (siteId: string) => ({ siteId, userId: "actor", generation: 1 }),
  isPosPermissionCurrent: () => true,
}));

const payload: Omit<CheckoutOutboxPayload, "clientMutationId"> = {
  siteId: "site", userId: "actor", source: "pos", fulfillment: "pickup",
  lines: [{ catalogItemId: "sku", quantity: 1 }], payments: [{ method: "cash", amount: 10 }],
};
let snapshots: Map<string, PosCartSession>;
let rows: PosOutboxRow[];
beforeEach(async () => {
  jest.resetAllMocks(); localStorage.clear(); snapshots = new Map(); rows = [];
  get.mockImplementation(async (siteId: string) => snapshots.get(siteId));
  put.mockImplementation(async (snapshot: PosCartSession) => { snapshots.set(snapshot.siteId, snapshot); });
  const initial = await loadCartSession("site");
  await saveCartSession({ ...initial, cart: [{ id: "sku", cartQty: 1, cartPrice: 10 } as PosCartSession["cart"][number]] });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: async (_name: string, _options: unknown, operation: () => Promise<unknown>) => operation(),
  } });
  jest.mocked(listOutbox).mockImplementation(async () => rows);
  jest.mocked(fetchActivePaymentRegister).mockResolvedValue({ data: { id: "register", location_id: "store" } } as never);
  jest.mocked(enqueueCheckout).mockImplementation(async (_site, data, checkoutCartSessionId) => {
    const row: PosOutboxRow = { id: "row", siteId: "site", kind: "checkout", status: "pending", attempts: 0,
      createdAt: "", updatedAt: "", clientMutationId: data.clientMutationId, checkoutCartSessionId,
      payload: { kind: "checkout", data } };
    rows.push(row); return row;
  });
});

it.each(["pending", "synced"] as const)("retains the %s payment identity through failed reset and reload", async (status) => {
  const first = renderHook(() => useCheckoutAttempt("site", "actor"));
  const mutation = first.result.current.id(payload);
  const originalSession = first.result.current.session();
  await enqueueRegisteredCheckout("site", { ...payload, clientMutationId: mutation }, undefined, undefined, { waitForConfirmation: false });
  rows[0].status = status;
  const payment = rows[0].payload;
  put.mockRejectedValueOnce(new Error("IndexedDB unavailable"));
  await expect(clearCartSession("site")).rejects.toThrow("IndexedDB unavailable");
  expect(getCheckoutCartSession("site")).toBe(originalSession);
  expect((await loadCartSession("site")).cart).toHaveLength(1);
  first.unmount();
  const restored = renderHook(() => useCheckoutAttempt("site", "actor"));
  expect(restored.result.current.id(payload)).toBe(mutation);
  const retry = await enqueueRegisteredCheckout("site", { ...payload, clientMutationId: restored.result.current.id(payload) },
    undefined, undefined, { waitForConfirmation: false });
  expect(retry).toBe(rows[0]);
  expect(retry.payload).toBe(payment);
  expect(enqueueCheckout).toHaveBeenCalledTimes(1);
});

it("does not rotate the identity while the blank snapshot is still being saved", async () => {
  const session = getCheckoutCartSession("site");
  let commit!: () => void;
  put.mockImplementationOnce((snapshot: PosCartSession) => new Promise<void>((resolve) => {
    commit = () => { snapshots.set(snapshot.siteId, snapshot); resolve(); };
  }));
  const clearing = clearCartSession("site");
  expect(getCheckoutCartSession("site")).toBe(session);
  expect((await loadCartSession("site")).cart).toHaveLength(1);
  commit(); await clearing;
  expect((await loadCartSession("site")).cart).toEqual([]);
  expect(getCheckoutCartSession("site")).not.toBe(session);
});

it("leaves a blank persisted cart with the old fence when localStorage rotation fails", async () => {
  const session = getCheckoutCartSession("site");
  const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  try { await expect(clearCartSession("site")).rejects.toThrow("Storage unavailable"); }
  finally { write.mockRestore(); }
  expect(getCheckoutCartSession("site")).toBe(session);
  expect((await loadCartSession("site")).cart).toEqual([]);
});

it("does not rotate a newer selection's identity after a deferred save", async () => {
  let current = true;
  const session = getCheckoutCartSession("site");
  put.mockImplementationOnce(async (snapshot: PosCartSession) => { snapshots.set(snapshot.siteId, snapshot); current = false; });
  await expect(clearCartSession("site", () => current)).rejects.toThrow("active cart changed");
  expect(getCheckoutCartSession("site")).toBe(session);
});

it("successful reset preserves old aliases but gives a fresh basket a distinct identity", async () => {
  const hook = renderHook(() => useCheckoutAttempt("site", "actor"));
  const old = hook.result.current.id(payload);
  await act(async () => { await clearCartSession("site"); });
  expect(hook.result.current.id(payload)).not.toBe(old);
  expect((await loadCartSession("site")).cart).toEqual([]);
});