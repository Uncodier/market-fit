import { act, renderHook, waitFor } from "@testing-library/react";
import type { CatalogItem } from "@/app/types";
import { usePosCatalog } from "@/app/pos/hooks/use-pos-catalog";
import { readLocalCatalog, readLocalPendingOrders, readLocalPromotions } from "@/app/pos/local/snapshot-pull";
import { getPosDb } from "@/app/pos/local/db";
import { subscribePosSync } from "@/app/pos/local/sync-engine";
import type { PosInventorySnapshot } from "@/app/pos/inventory-availability";

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
    categories: [], locations: [], leads: [], priceLists: [], modifierGroupsByHostId: {},
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
    jest.mocked(getPosDb).mockReturnValue({ priceListItems: { toArray: jest.fn(async () => []) } } as never);
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
});