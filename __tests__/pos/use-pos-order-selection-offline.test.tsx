import { act, renderHook, waitFor } from "@testing-library/react";
import { usePosOrderSelection } from "@/app/pos/hooks/use-pos-order-selection";
import { fetchPosOrder } from "@/app/pos/operation-client";
import { resolvePendingOrder } from "@/app/pos/local/resolve-pending-order";
import { readOfflineOrder } from "@/app/pos/local/read-offline-order";
import {
  getPosPermissionLease, isPosPermissionCurrent, requirePosPermission,
  type PosPermissionLease,
} from "@/app/pos/local/location-permission-state";
import { toast } from "sonner";

jest.mock("@/app/pos/operation-client", () => ({ fetchPosOrder: jest.fn() }));
jest.mock("@/app/pos/local/resolve-pending-order", () => ({ resolvePendingOrder: jest.fn() }));
jest.mock("@/app/pos/local/read-offline-order", () => ({ readOfflineOrder: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: jest.fn(), requirePosPermission: jest.fn(), isPosPermissionCurrent: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

const onlineLease: PosPermissionLease = {
  siteId: "site", userId: "cashier", role: "collaborator", generation: 1, expiresAt: Infinity,
};
let lease: PosPermissionLease | null;
const order = (id: string) => ({
  id, site_id: "site", status: "pending",
  sale_order_items: [{ id: `${id}-line`, catalog_item_id: "sku", name: "Coffee", quantity: 1,
    unit_price: 10, metadata: {}, parent_sale_order_item_id: null }],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function setup(pendingOrders: Parameters<typeof usePosOrderSelection>[0]["pendingOrders"] = []) {
  const callbacks = {
    populateFromOrder: jest.fn(() => true), clearOrderFields: jest.fn(),
    resetToNewOrder: jest.fn(async () => {}), setActiveOrderId: jest.fn(), setLoadingOrder: jest.fn(),
  };
  const sequence = { current: 0 };
  const hook = renderHook(() => usePosOrderSelection({ siteId: "site", pendingOrders, sequence, ...callbacks }));
  return { ...hook, ...callbacks };
}
function goOffline() {
  // Lease renewal can retain the generation while replacing the online token.
  lease = { ...onlineLease, offline: true };
}

describe("POS order selection effective offline state", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    lease = { ...onlineLease };
    jest.mocked(getPosPermissionLease).mockImplementation(siteId => siteId === "site" ? lease : null);
    jest.mocked(requirePosPermission).mockImplementation(() => {
      if (!lease) throw new Error("POS requires verified access");
      return lease;
    });
    jest.mocked(isPosPermissionCurrent).mockReturnValue(true);
    jest.mocked(readOfflineOrder).mockImplementation(async (_siteId, id) => order(id));
    jest.mocked(resolvePendingOrder).mockResolvedValue("remote");
    jest.mocked(fetchPosOrder).mockResolvedValue({ data: order("remote") } as never);
  });

  it.each([
    ["local_ticket", false], ["local_ticket", true], ["pending", false],
    ["synced", false], ["synced", true],
  ])("uses local data for %s (forceRefresh=%s) when the browser is online but the lease is offline", async (id, forceRefresh) => {
    goOffline();
    const cached = { ...order(id), pending_sync: id === "pending" };
    const hook = setup([cached]);
    await act(async () => { expect(await hook.result.current.handleOrderSelect(id, forceRefresh)).toBe(true); });
    expect(getPosPermissionLease).toHaveBeenCalledWith("site");
    expect(readOfflineOrder).toHaveBeenCalledWith("site", id, cached, expect.any(Function));
    expect(hook.populateFromOrder).toHaveBeenCalledTimes(1);
    expect(hook.populateFromOrder).toHaveBeenCalledWith(order(id), true);
    expect(resolvePendingOrder).not.toHaveBeenCalled();
    expect(fetchPosOrder).not.toHaveBeenCalled();
    expect(hook.setActiveOrderId).toHaveBeenLastCalledWith(id);
    expect(hook.setLoadingOrder).toHaveBeenLastCalledWith(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("still uses local data when only the browser is offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const hook = setup();
    await act(async () => { expect(await hook.result.current.handleOrderSelect("local_ticket")).toBe(true); });
    expect(readOfflineOrder).toHaveBeenCalled();
    expect(resolvePendingOrder).not.toHaveBeenCalled();
    expect(fetchPosOrder).not.toHaveBeenCalled();
  });

  it("rechecks the lease after importing the pending-order resolver", async () => {
    const hook = setup();
    await act(async () => {
      const selection = hook.result.current.handleOrderSelect("local_ticket");
      goOffline();
      expect(await selection).toBe(true);
    });
    expect(readOfflineOrder).toHaveBeenCalled();
    expect(resolvePendingOrder).not.toHaveBeenCalled();
    expect(fetchPosOrder).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)("uses the current offline lease when pending resolution completes: %s", async outcome => {
    const pending = deferred<string>();
    jest.mocked(resolvePendingOrder).mockReturnValue(pending.promise);
    const hook = setup();
    let selection!: Promise<boolean>;
    act(() => { selection = hook.result.current.handleOrderSelect("local_ticket"); });
    await waitFor(() => expect(resolvePendingOrder).toHaveBeenCalled());
    await act(async () => {
      goOffline();
      if (outcome === "resolve") pending.resolve("remote");
      else pending.reject(new Error("Remote resolution failed"));
      expect(await selection).toBe(true);
    });
    expect(readOfflineOrder).toHaveBeenCalledWith("site", "local_ticket", undefined, expect.any(Function));
    expect(fetchPosOrder).not.toHaveBeenCalled();
    expect(hook.populateFromOrder).toHaveBeenCalledWith(order("local_ticket"), true);
    expect(hook.setActiveOrderId).toHaveBeenLastCalledWith("local_ticket");
    expect(hook.resetToNewOrder).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)("uses the current offline lease when remote fetch completes: %s", async outcome => {
    const response = deferred<Awaited<ReturnType<typeof fetchPosOrder>>>();
    jest.mocked(fetchPosOrder).mockReturnValue(response.promise);
    const hook = setup();
    let selection!: Promise<boolean>;
    act(() => { selection = hook.result.current.handleOrderSelect("remote"); });
    await waitFor(() => expect(fetchPosOrder).toHaveBeenCalled());
    await act(async () => {
      goOffline();
      if (outcome === "resolve") response.resolve({ data: { ...order("remote"), notes: "Remote data" } } as never);
      else response.reject(new Error("Remote fetch failed"));
      expect(await selection).toBe(true);
    });
    expect(readOfflineOrder).toHaveBeenCalledWith("site", "remote", undefined, expect.any(Function));
    expect(hook.populateFromOrder).toHaveBeenCalledTimes(1);
    expect(hook.populateFromOrder).toHaveBeenCalledWith(order("remote"), true);
    expect(hook.resetToNewOrder).not.toHaveBeenCalled();
    expect(hook.setLoadingOrder).toHaveBeenLastCalledWith(false);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("does not retain an offline lease across selections when access returns online", async () => {
    const hook = setup();
    const select = hook.result.current.handleOrderSelect;
    goOffline();
    await act(async () => { expect(await select("local_ticket")).toBe(true); });
    lease = { ...onlineLease };
    await act(async () => { expect(await select("local_ticket")).toBe(true); });
    expect(readOfflineOrder).toHaveBeenCalledTimes(1);
    expect(resolvePendingOrder).toHaveBeenCalledTimes(1);
    expect(fetchPosOrder).toHaveBeenCalledWith("site", "remote");
    expect(hook.setActiveOrderId).toHaveBeenLastCalledWith("remote");
  });

  it("does not retry a failed offline read or fall through to remote work", async () => {
    goOffline();
    jest.mocked(readOfflineOrder).mockRejectedValue(new Error("No local snapshot"));
    const hook = setup();
    await act(async () => { expect(await hook.result.current.handleOrderSelect("local_ticket")).toBe(false); });
    expect(readOfflineOrder).toHaveBeenCalledTimes(1);
    expect(resolvePendingOrder).not.toHaveBeenCalled();
    expect(fetchPosOrder).not.toHaveBeenCalled();
    expect(hook.resetToNewOrder).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("No local snapshot");
  });

  it("does not treat a revoked lease as offline access", async () => {
    const hook = setup();
    const response = deferred<Awaited<ReturnType<typeof fetchPosOrder>>>();
    jest.mocked(fetchPosOrder).mockReturnValue(response.promise);
    let selection!: Promise<boolean>;
    act(() => { selection = hook.result.current.handleOrderSelect("remote"); });
    await act(async () => {
      lease = null;
      jest.mocked(isPosPermissionCurrent).mockReturnValue(false);
      response.resolve({ data: order("remote") } as never);
      expect(await selection).toBe(false);
    });
    expect(readOfflineOrder).not.toHaveBeenCalled();
    expect(hook.populateFromOrder).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("POS access changed");
  });
});