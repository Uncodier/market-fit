import { act, renderHook, waitFor } from "@testing-library/react";
import type { CatalogItem } from "@/app/types";
import { usePosCatalog } from "@/app/pos/hooks/use-pos-catalog";
import { readLocalCatalog, readLocalPendingOrders, readLocalPromotions, readTaxesByItemIds } from "@/app/pos/local/snapshot-pull";
import { getPosDb, type PosLead } from "@/app/pos/local/db";
import { subscribePosSync, type SyncStatus } from "@/app/pos/local/sync-engine";
import type { PosInventorySnapshot } from "@/app/pos/inventory-availability";
import { subscribePosOrderPickerChanges } from "@/app/pos/local/order-picker-changes";

jest.mock("@/app/pos/local/order-picker-changes", () => ({ subscribePosOrderPickerChanges: jest.fn(() => jest.fn()) }));

jest.mock("@/app/pos/local/snapshot-pull", () => ({
  readLocalCatalog: jest.fn(), readLocalPendingOrders: jest.fn(), readLocalPromotions: jest.fn(), readTaxesByItemIds: jest.fn(),
}));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/sync-engine", () => ({ subscribePosSync: jest.fn() }));

const inventory: PosInventorySnapshot = {
  policy: "block", levels: [{ catalog_item_id: "item", location_id: "location", quantity: 2 }],
};

function local(siteId: string, inventorySnapshot: PosInventorySnapshot | null = inventory): Awaited<ReturnType<typeof readLocalCatalog>> {
  return {
    catalogItems: [{ id: `item-${siteId}`, is_pos_available: true, availability_mode: "inventory" } as CatalogItem],
    categories: [], locations: [], priceLists: [], modifierGroupsByHostId: {},
    inventorySnapshot, lastPulledAt: "2026-10-01T00:00:00Z", lastCatalogRevision: "revision", hasLocalData: true,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("usePosCatalog inventory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(readLocalCatalog).mockImplementation(async (siteId) => local(siteId));
    jest.mocked(readLocalPendingOrders).mockResolvedValue([]);
    jest.mocked(readLocalPromotions).mockResolvedValue([]);
    jest.mocked(readTaxesByItemIds).mockResolvedValue({});
    jest.mocked(getPosDb).mockReturnValue({ priceListItems: { toArray: jest.fn(async () => []) },
      leads: { where: jest.fn(() => ({ equals: jest.fn(() => ({ toArray: jest.fn(async () => []) })) })) },
    } as never);
    jest.mocked(subscribePosSync).mockReturnValue(jest.fn());
  });

  it("hydrates inventory, exposes its setter, and replaces it on reload", async () => {
    const { result } = renderHook(() => usePosCatalog("site-1"));
    expect(result.current.inventorySnapshot).toBeNull();
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.inventorySnapshot).toEqual(inventory);
    act(() => result.current.setInventorySnapshot({ levels: [], policy: "warn" }));
    expect(result.current.inventorySnapshot).toEqual({ levels: [], policy: "warn" });
    await act(async () => result.current.reload());
    expect(result.current.inventorySnapshot).toEqual(inventory);
  });

  it("publishes committed order changes while customer reads hang and counters stay unchanged", async () => {
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const stuck = deferred<PosLead[]>();
    jest.mocked(getPosDb).mockReturnValue({ priceListItems: { toArray: async () => [] },
      leads: { where: () => ({ equals: () => ({ toArray: () => stuck.promise }) }) },
    } as never);
    let reload!: Promise<void>;
    await act(async () => { reload = result.current.reload(); });
    const raw = { id: "order", status: "pending", amount_due: 20, pos_picker_payment_pending: true };
    jest.mocked(readLocalPendingOrders).mockResolvedValue([{ id: "order", site_id: "site-1", status: "pending", created_at: "", raw }]);
    await act(async () => jest.mocked(subscribePosOrderPickerChanges).mock.calls[0][0]());
    expect(result.current.pendingOrders).toEqual([raw]);
    await act(async () => { stuck.resolve([]); await reload; });
    expect(result.current.pendingOrders).toEqual([raw]);
  });

  it("refreshes cancellations even when failed and pending counts have not changed", async () => {
    const raw = { id: "order", status: "pending", amount_due: 20 };
    jest.mocked(readLocalPendingOrders).mockResolvedValue([{ id: "order", site_id: "site-1", status: "pending", created_at: "", raw }]);
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.pendingOrders).toEqual([raw]));
    jest.mocked(readLocalPendingOrders).mockResolvedValue([]);
    await act(async () => jest.mocked(subscribePosOrderPickerChanges).mock.calls[0][0]());
    expect(result.current.pendingOrders).toEqual([]);
  });

  it("does not let a pre-payment local read undo a committed picker update", async () => {
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const stale = deferred<Awaited<ReturnType<typeof readLocalPendingOrders>>>();
    jest.mocked(readLocalPendingOrders).mockReturnValueOnce(stale.promise);
    let reload!: Promise<void>;
    await act(async () => { reload = result.current.reload(); });
    const raw = { id: "order", status: "pending", amount_due: 20, pos_picker_payment_pending: true };
    jest.mocked(readLocalPendingOrders).mockResolvedValue([{ id: "order", site_id: "site-1", status: "pending", created_at: "", raw }]);
    await act(async () => jest.mocked(subscribePosOrderPickerChanges).mock.calls[0][0]());
    expect(result.current.pendingOrders).toEqual([raw]);
    await act(async () => { stale.resolve([]); await reload; });
    expect(result.current.pendingOrders).toEqual([raw]);
  });

  it("does not synthesize inventory for legacy local snapshots", async () => {
    jest.mocked(readLocalCatalog).mockResolvedValue(local("site-1", null));
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.inventorySnapshot).toBeNull();
  });

  it("keeps hidden modifier/variant SKUs available for lookup but out of display lists", async () => {
    const data = local("site-1");
    data.catalogItems.push({ id: "hidden-modifier", is_pos_available: false, availability_mode: "inventory" } as CatalogItem);
    jest.mocked(readLocalCatalog).mockResolvedValue(data);
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.catalogItems).toHaveLength(2);
    expect(result.current.availableItems).toHaveLength(1);
    expect(result.current.unavailableItems).toHaveLength(0);
    expect(readTaxesByItemIds).toHaveBeenCalledWith(["item-site-1", "hidden-modifier"]);
  });

  it("preloads taxes with the catalog and refreshes them on sync", async () => {
    const taxes = { "item-site-1": [{ id: "tax", rate: 10 }] };
    jest.mocked(readTaxesByItemIds).mockResolvedValue(taxes);
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.taxesByItem).toEqual(taxes);
    jest.mocked(readTaxesByItemIds).mockResolvedValue({});
    await act(async () => result.current.reload());
    expect(result.current.taxesByItem).toEqual({});
  });

  it("hides the previous site's snapshot immediately and rejects a late cross-site reload", async () => {
    const { result, rerender } = renderHook(({ siteId }) => usePosCatalog(siteId), { initialProps: { siteId: "site-1" } });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const stale = deferred<ReturnType<typeof local>>();
    const next = deferred<ReturnType<typeof local>>();
    jest.mocked(readLocalCatalog).mockImplementation((siteId) => siteId === "site-1" ? stale.promise : next.promise);
    let staleReload!: Promise<void>;
    act(() => { staleReload = result.current.reload(); });
    const staleSetter = result.current.setInventorySnapshot;
    rerender({ siteId: "site-2" });
    expect(result.current.inventorySnapshot).toBeNull();
    expect(result.current.catalogItems).toEqual([]);
    expect(result.current.taxesByItem).toEqual({});
    expect(result.current.hydrated).toBe(false);
    const newInventory: PosInventorySnapshot = { levels: [], policy: "allow" };
    await act(async () => next.resolve(local("site-2", newInventory)));
    await waitFor(() => expect(result.current.inventorySnapshot).toEqual(newInventory));
    await act(async () => { stale.resolve(local("site-1")); await staleReload; });
    act(() => staleSetter(inventory));
    expect(result.current.inventorySnapshot).toEqual(newInventory);
    expect(result.current.catalogItems[0].id).toBe("item-site-2");
  });

  it("keeps the newest same-site reload when reads finish out of order", async () => {
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const older = deferred<ReturnType<typeof local>>();
    const newer = deferred<ReturnType<typeof local>>();
    jest.mocked(readLocalCatalog).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => { first = result.current.reload(); second = result.current.reload(); });
    const newInventory: PosInventorySnapshot = { levels: [], policy: "warn" };
    await act(async () => { newer.resolve(local("site-1", newInventory)); await second; });
    await act(async () => { older.resolve(local("site-1", inventory)); await first; });
    expect(result.current.inventorySnapshot).toEqual(newInventory);
  });

  it("keeps the catalog usable when the independent order read fails", async () => {
    jest.mocked(readLocalPendingOrders).mockRejectedValue(new Error("Temporary order read failure"));
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.ordersError).toBe(true);
    expect(result.current.catalogError).toBe(false);
    expect(result.current.catalogItems[0].id).toBe("item-site-1");
    jest.mocked(readLocalPendingOrders).mockResolvedValue([]);
    await act(async () => result.current.reload());
    expect(result.current.ordersError).toBe(false);
  });

  it("exposes initial pricing failure without pretending that checkout data is ready", async () => {
    jest.mocked(readTaxesByItemIds).mockRejectedValueOnce(new Error("Temporary tax read failure"));
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.catalogError).toBe(true));
    expect(result.current.hydrated).toBe(false);
    expect(result.current.catalogItems).toEqual([]);
    await act(async () => result.current.reload());
    expect(result.current.catalogError).toBe(false);
    expect(result.current.hydrated).toBe(true);
  });

  it("retains the whole last-good pricing bundle after a failed refresh", async () => {
    const taxes = { "item-site-1": [{ rate: 10 }] };
    jest.mocked(readTaxesByItemIds).mockResolvedValue(taxes);
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const previous = result.current.catalogItems;
    jest.mocked(readLocalCatalog).mockResolvedValue(local("new-data"));
    jest.mocked(readTaxesByItemIds).mockRejectedValueOnce(new Error("Read failure"));
    await act(async () => result.current.reload());
    expect(result.current.catalogItems).toBe(previous);
    expect(result.current.taxesByItem).toBe(taxes);
    expect(result.current.hydrated).toBe(true);
    expect(result.current.catalogError).toBe(true);
  });

  it("only reloads orders on queue changes and coalesces a burst of catalog notifications", async () => {
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const notify = jest.mocked(subscribePosSync).mock.calls[0][0];
    const status: SyncStatus = { online: true, pulling: false, syncing: false, pendingCount: 0,
      failedCount: 0, lastPulledAt: "first", lastOrdersPulledAt: null, lastError: null };
    await act(async () => notify(status));
    const catalogReads = jest.mocked(readLocalCatalog).mock.calls.length;
    const previous = result.current.catalogItems;
    await act(async () => {
      notify({ ...status, pendingCount: 1 });
      notify({ ...status, pendingCount: 2 });
      notify({ ...status, lastOrdersPulledAt: "orders" });
    });
    expect(readLocalCatalog).toHaveBeenCalledTimes(catalogReads);
    expect(result.current.catalogItems).toBe(previous);
    await act(async () => {
      notify({ ...status, lastPulledAt: "second" });
      notify({ ...status, lastPulledAt: "third" });
    });
    expect(readLocalCatalog).toHaveBeenCalledTimes(catalogReads + 1);
  });

  it("never exposes previous-site orders when the new site's order read fails", async () => {
    jest.mocked(readLocalPendingOrders).mockResolvedValue([{ id: "old", site_id: "site-1", raw: {
      id: "old", status: "pending", sales: { amount_due: 10 },
    } }] as never);
    const { result, rerender } = renderHook(({ siteId }) => usePosCatalog(siteId), { initialProps: { siteId: "site-1" } });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    jest.mocked(readLocalPendingOrders).mockRejectedValue(new Error("Unavailable"));
    rerender({ siteId: "site-2" });
    await waitFor(() => expect(result.current.ordersError).toBe(true));
    expect(result.current.catalogItems[0].id).toBe("item-site-2");
    expect(result.current.pendingOrders).toEqual([]);
  });

  it("refreshes synced customer identities on queue changes without reading product data", async () => {
    const customers = [{ id: "server-lead", site_id: "site-1", name: "Synced customer" }];
    jest.mocked(getPosDb).mockReturnValue({ priceListItems: { toArray: async () => [] },
      leads: { where: () => ({ equals: () => ({ toArray: async () => customers }) }) },
    } as never);
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const notify = jest.mocked(subscribePosSync).mock.calls[0][0];
    const reads = jest.mocked(readLocalCatalog).mock.calls.length;
    await act(async () => notify({ online: true, pulling: false, syncing: false, pendingCount: 0,
      failedCount: 0, lastPulledAt: null, lastOrdersPulledAt: null, lastError: null }));
    expect(result.current.leads).toEqual(customers);
    expect(readLocalCatalog).toHaveBeenCalledTimes(reads);
  });

  it("automatically retries transient reads with a bounded progressive schedule", async () => {
    jest.useFakeTimers();
    try {
      jest.mocked(readLocalCatalog).mockRejectedValue(new Error("Read failure"));
      const { result } = renderHook(() => usePosCatalog("site-1"));
      await act(async () => { await jest.advanceTimersByTimeAsync(0); });
      expect(result.current.catalogError).toBe(true);
      await act(async () => { await jest.advanceTimersByTimeAsync(1_000); });
      await act(async () => { await jest.advanceTimersByTimeAsync(2_000); });
      await act(async () => { await jest.advanceTimersByTimeAsync(4_000); });
      expect(readLocalCatalog).toHaveBeenCalledTimes(4);
      await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
      expect(readLocalCatalog).toHaveBeenCalledTimes(4);
      expect(result.current.hydrated).toBe(false);
    } finally { jest.useRealTimers(); }
  });

  it("does not overwrite newer customers when an older catalog read finishes", async () => {
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const stale = deferred<ReturnType<typeof local>>();
    jest.mocked(readLocalCatalog).mockReturnValueOnce(stale.promise);
    let reload!: Promise<void>;
    act(() => { reload = result.current.reload(); });
    const customers = [{ id: "new-customer", site_id: "site-1", name: "New" }];
    jest.mocked(getPosDb).mockReturnValue({ priceListItems: { toArray: async () => [] },
      leads: { where: () => ({ equals: () => ({ toArray: async () => customers }) }) },
    } as never);
    const notify = jest.mocked(subscribePosSync).mock.calls[0][0];
    await act(async () => notify({ online: true, pulling: false, syncing: false, pendingCount: 1,
      failedCount: 0, lastPulledAt: null, lastOrdersPulledAt: null, lastError: null }));
    expect(result.current.leads).toEqual(customers);
    await act(async () => {
      stale.resolve(local("site-1"));
      await reload;
    });
    expect(result.current.leads).toEqual(customers);
  });

  it("never exposes previous-site customers after the new site's customer read fails", async () => {
    const customers = [{ id: "private-customer", site_id: "site-1", name: "Private" }];
    const readCustomers = jest.fn(async () => customers);
    jest.mocked(getPosDb).mockReturnValue({ priceListItems: { toArray: async () => [] },
      leads: { where: () => ({ equals: () => ({ toArray: readCustomers }) }) },
    } as never);
    const { result, rerender } = renderHook(({ siteId }) => usePosCatalog(siteId), { initialProps: { siteId: "site-1" } });
    await waitFor(() => expect(result.current.leads).toEqual(customers));
    readCustomers.mockRejectedValue(new Error("Unavailable"));
    rerender({ siteId: "site-2" });
    await waitFor(() => expect(result.current.ordersError).toBe(true));
    expect(result.current.hydrated).toBe(true);
    expect(result.current.leads).toEqual([]);
  });

  it("preserves a local customer edit over an already-started background customer read", async () => {
    const pending = deferred<PosLead[]>();
    const readCustomers = jest.fn(async () => [] as PosLead[]);
    jest.mocked(getPosDb).mockReturnValue({ priceListItems: { toArray: async () => [] },
      leads: { where: () => ({ equals: () => ({ toArray: readCustomers }) }) },
    } as never);
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    readCustomers.mockReturnValueOnce(pending.promise);
    let reload!: Promise<void>;
    await act(async () => { reload = result.current.reload(); });
    const customer = { id: "local_customer", site_id: "site-1", name: "Local", is_local: true };
    act(() => result.current.setLeads((previous) => [...previous, customer]));
    await act(async () => { pending.resolve([]); await reload; });
    expect(result.current.leads).toEqual([customer]);
  });

  it("refreshes customers on catalog-only invalidation through the customer lane", async () => {
    let customers: PosLead[] = [];
    jest.mocked(getPosDb).mockReturnValue({ priceListItems: { toArray: async () => [] },
      leads: { where: () => ({ equals: () => ({ toArray: async () => customers }) }) },
    } as never);
    const { result } = renderHook(() => usePosCatalog("site-1"));
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const notify = jest.mocked(subscribePosSync).mock.calls[0][0];
    const status: SyncStatus = { online: true, pulling: false, syncing: false, pendingCount: 0,
      failedCount: 0, lastPulledAt: "first", lastOrdersPulledAt: null, lastError: null };
    await act(async () => notify(status));
    customers = [{ id: "fresh", site_id: "site-1", name: "Fresh" }];
    await act(async () => notify({ ...status, lastPulledAt: "second" }));
    expect(result.current.leads).toEqual(customers);
  });

  it("bounds a hanging initial read and ignores its late data after successful recovery", async () => {
    jest.useFakeTimers();
    try {
      const stuck = deferred<ReturnType<typeof local>>();
      jest.mocked(readLocalCatalog).mockReturnValueOnce(stuck.promise);
      const { result } = renderHook(() => usePosCatalog("site-1"));
      await act(async () => { await jest.advanceTimersByTimeAsync(8_000); });
      expect(result.current.catalogError).toBe(true);
      expect(result.current.hydrated).toBe(false);
      await act(async () => { await jest.advanceTimersByTimeAsync(1_000); });
      expect(result.current.hydrated).toBe(true);
      expect(result.current.catalogError).toBe(false);
      await act(async () => stuck.resolve(local("stale")));
      expect(result.current.catalogItems[0].id).toBe("item-site-1");
    } finally { jest.useRealTimers(); }
  });
});