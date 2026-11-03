import { act, renderHook, waitFor } from "@testing-library/react";
import { usePosCatalog } from "@/app/pos/hooks/use-pos-catalog";
import { readLocalCatalog } from "@/app/pos/local/snapshot-pull";
import { getPosDb } from "@/app/pos/local/db";

// Exercise the actual snapshot readers, not a mocked readLocalCatalog result.
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/read-client", () => ({ fetchPosCatalogSnapshot: jest.fn() }));
jest.mock("@/app/pos/local/sync-engine", () => ({ subscribePosSync: () => () => {} }));

const siteId = "site-one";
const item = { id: "item", site_id: siteId, name: "Coffee", is_pos_available: true };
const customer = { id: "customer", site_id: siteId, name: "Customer" };
const taxes = { catalogItemId: item.id, taxes: [{ rate: 16 }] };

function database() {
  const readCustomers = jest.fn(async () => [customer]);
  const readTaxes = jest.fn(async () => [taxes]);
  function table(rows: unknown[]) {
    return { where: jest.fn(() => ({ equals: jest.fn(() => ({ toArray: async () => rows })) })) };
  }
  const db = {
    catalogItems: table([item]), categories: table([]), locations: table([]), priceLists: table([]),
    pendingOrders: table([]), outbox: table([]), promotions: table([]),
    leads: { where: jest.fn(() => ({ equals: jest.fn(() => ({ toArray: readCustomers })) })) },
    priceListItems: { toArray: async () => [] }, taxesByItem: { bulkGet: readTaxes },
    meta: { get: async () => ({ lastPulledAt: "2026-11-03T00:00:00Z", inventorySnapshot: { policy: "block", levels: [] } }) },
    transaction: async (_mode: string, _tables: unknown[], work: () => Promise<unknown>) => work(),
  };
  jest.mocked(getPosDb).mockReturnValue(db as unknown as ReturnType<typeof getPosDb>);
  return { db, readCustomers, readTaxes };
}

beforeEach(() => jest.clearAllMocks());

it("reads catalog data without accessing a failed customer table", async () => {
  const { db, readCustomers } = database();
  readCustomers.mockRejectedValue(new Error("Customers unavailable"));
  const catalog = await readLocalCatalog(siteId);
  expect(catalog.catalogItems).toEqual([item]);
  expect(catalog.hasLocalData).toBe(true);
  expect(catalog).not.toHaveProperty("leads");
  expect(db.leads.where).not.toHaveBeenCalled();
  expect(db.catalogItems.where).toHaveBeenCalledWith("site_id");
  expect(db.catalogItems.where.mock.results[0].value.equals).toHaveBeenCalledWith(siteId);
});

it("hydrates the actual pricing bundle despite customer failure and recovers customers separately", async () => {
  const { readCustomers } = database();
  readCustomers.mockRejectedValue(new Error("Customers unavailable"));
  const { result } = renderHook(() => usePosCatalog(siteId));
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  expect(result.current.catalogItems).toEqual([item]);
  expect(result.current.taxesByItem).toEqual({ item: taxes.taxes });
  expect(result.current.catalogError).toBe(false);
  expect(result.current.ordersError).toBe(true);
  expect(readCustomers).toHaveBeenCalledTimes(1);
  readCustomers.mockResolvedValue([customer]);
  await act(async () => result.current.reload());
  expect(result.current.leads).toEqual([customer]);
  expect(result.current.ordersError).toBe(false);
  expect(readCustomers).toHaveBeenCalledTimes(2);
});

it("does not wait for a hanging customer read to publish the catalog", async () => {
  const { readCustomers } = database();
  let finish!: (rows: typeof customer[]) => void;
  readCustomers.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(() => usePosCatalog(siteId));
  try {
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.catalogItems).toEqual([item]);
    expect(result.current.catalogError).toBe(false);
    expect(readCustomers).toHaveBeenCalledTimes(1);
  } finally { await act(async () => finish([customer])); }
});

it("still fails closed when the real tax read fails", async () => {
  const { readTaxes } = database();
  readTaxes.mockRejectedValue(new Error("Taxes unavailable"));
  const { result } = renderHook(() => usePosCatalog(siteId));
  await waitFor(() => expect(result.current.catalogError).toBe(true));
  expect(result.current.hydrated).toBe(false);
  expect(result.current.catalogItems).toEqual([]);
});