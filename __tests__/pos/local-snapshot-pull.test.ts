import { getPosDb } from "@/app/pos/local/db";
import { applyPosCatalogSnapshot, pullAndStorePosCatalogSnapshot, readLocalCatalog } from "@/app/pos/local/snapshot-pull";
import { pullPosCatalogSnapshot, type PosCatalogSnapshot } from "@/app/pos/actions/pull-snapshot";
import type { PosMeta } from "@/app/pos/local/types";

jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/actions/pull-snapshot", () => ({ pullPosCatalogSnapshot: jest.fn() }));

const inventorySnapshot = { policy: "block" as const, levels: [{ catalog_item_id: "item", location_id: "location", quantity: 3 }] };
const snapshot: PosCatalogSnapshot = {
  catalogItems: [], categories: [], locations: [], leads: [], priceLists: [], priceListItems: [],
  taxesByItem: {}, promotions: [], modifierGroupsByHostId: {}, inventorySnapshot, pulledAt: "2026-10-01T00:00:00Z",
};

function localDb() {
  const meta = new Map<string, PosMeta>();
  const chain = {
    equals: () => chain, filter: () => chain,
    toArray: jest.fn(async () => []), delete: jest.fn(async () => undefined),
  };
  const table = { where: jest.fn(() => chain), clear: jest.fn(), bulkPut: jest.fn() };
  const db = {
    catalogItems: table, categories: table, locations: table, leads: table, priceLists: table,
    priceListItems: table, taxesByItem: table, promotions: table,
    meta: {
      get: jest.fn(async (siteId: string) => meta.get(siteId)),
      put: jest.fn(async (entry: PosMeta) => { meta.set(entry.siteId, entry); }),
    },
    transaction: jest.fn(async (_mode: string, _tables: unknown[], callback: () => Promise<void>) => callback()),
  };
  jest.mocked(getPosDb).mockReturnValue(db as unknown as ReturnType<typeof getPosDb>);
  return { ...db, storedMeta: meta };
}

describe("local inventory snapshots", () => {
  beforeEach(() => jest.clearAllMocks());

  it("persists inventory atomically with catalog metadata and reads only the requested site", async () => {
    const db = localDb();
    await applyPosCatalogSnapshot("site-1", snapshot, "revision-1");
    expect(db.meta.put).toHaveBeenCalledWith(expect.objectContaining({ siteId: "site-1", inventorySnapshot }));
    expect(await readLocalCatalog("site-1")).toHaveProperty("inventorySnapshot", inventorySnapshot);
    expect(await readLocalCatalog("site-2")).toHaveProperty("inventorySnapshot", null);
  });

  it("returns unknown inventory for legacy local metadata", async () => {
    const db = localDb();
    db.storedMeta.set("site-1", { siteId: "site-1", lastPulledAt: "old", schemaVersion: 1 });
    expect(await readLocalCatalog("site-1")).toHaveProperty("inventorySnapshot", null);
  });

  it("preserves the previous snapshot and revision when the remote read fails", async () => {
    const db = localDb();
    await applyPosCatalogSnapshot("site-1", snapshot, "revision-1");
    jest.mocked(pullPosCatalogSnapshot).mockResolvedValue({ error: "Inventory unavailable" });
    expect(await pullAndStorePosCatalogSnapshot("site-1", "revision-2")).toEqual({ ok: false, error: "Inventory unavailable" });
    expect(db.meta.put).toHaveBeenCalledTimes(1);
    expect(await readLocalCatalog("site-1")).toMatchObject({ inventorySnapshot, lastCatalogRevision: "revision-1" });
  });
});