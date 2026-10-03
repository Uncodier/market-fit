/** @jest-environment node */

import { listCatalogItems, listCatalogCategories } from "@/app/catalog/actions";
import { listLocations } from "@/app/inventory/actions";
import { listPriceLists } from "@/app/price-lists/actions";
import { listPromotions } from "@/app/promotions/actions";
import { listAllModifierGroupsForPos } from "@/app/catalog/modifier-actions";
import { getTaxesByCatalogItemIds } from "@/app/catalog/tax-actions";
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";
import { pullPosInventorySnapshot } from "@/app/pos/actions/inventory-snapshot";
import { pullPosCatalogSnapshot } from "@/app/pos/actions/pull-snapshot";
import { readThroughJsonCache } from "@/lib/redis/json-cache";
import type { CatalogItem } from "@/app/types";

jest.mock("@/app/catalog/actions", () => ({ listCatalogItems: jest.fn(), listCatalogCategories: jest.fn() }));
jest.mock("@/app/inventory/actions", () => ({ listLocations: jest.fn() }));
jest.mock("@/app/price-lists/actions", () => ({ listPriceLists: jest.fn() }));
jest.mock("@/app/promotions/actions", () => ({ listPromotions: jest.fn() }));
jest.mock("@/app/catalog/modifier-actions", () => ({ listAllModifierGroupsForPos: jest.fn() }));
jest.mock("@/app/catalog/tax-actions", () => ({ getTaxesByCatalogItemIds: jest.fn() }));
jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }));
jest.mock("@/app/pos/actions/inventory-snapshot", () => ({ pullPosInventorySnapshot: jest.fn() }));
jest.mock("@/lib/redis/control-plane", () => ({ hashRedisKeyPart: jest.fn(async () => "cache-hash") }));
jest.mock("@/lib/redis/json-cache", () => ({ readThroughJsonCache: jest.fn() }));

const parent = { id: "parent", is_pos_available: true } as CatalogItem;
let variants: CatalogItem[];
let modifiers: CatalogItem[];
let queryError: boolean;
const calls = { eq: jest.fn(), in: jest.fn(), range: jest.fn() };

function supabase() {
  return { from: jest.fn(() => ({
    select: jest.fn(() => {
      const query = {
        eq: (key: string, value: unknown) => { calls.eq(key, value); return query; },
        in: (key: string, value: string[]) => {
          calls.in(key, value);
          if (key === "id") return Promise.resolve({ data: modifiers, error: null });
          return { order: jest.fn(() => ({ range: async (start: number, end: number) => {
            calls.range(start, end);
            return { data: variants.slice(start, end + 1), error: queryError ? { message: "private detail" } : null };
          } })) };
        },
      };
      return query;
    }),
  })) };
}

describe("pullPosCatalogSnapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    variants = [];
    modifiers = [];
    queryError = false;
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ supabase: supabase(), role: "owner", user: { id: "user" } } as never);
    jest.mocked(listCatalogItems).mockResolvedValue({ data: [parent], count: 1 });
    jest.mocked(listCatalogCategories).mockResolvedValue({ data: [] });
    jest.mocked(listLocations).mockResolvedValue({ data: [] });
    jest.mocked(listPriceLists).mockResolvedValue({ data: [], count: 0 });
    jest.mocked(listPromotions).mockResolvedValue({ data: [], count: 0 });
    jest.mocked(listAllModifierGroupsForPos).mockResolvedValue({ data: {} });
    jest.mocked(getTaxesByCatalogItemIds).mockResolvedValue({ data: {}, error: null });
    jest.mocked(pullPosInventorySnapshot).mockResolvedValue({ data: { levels: [], policy: "allow" } });
    jest.mocked(readThroughJsonCache).mockImplementation(async ({ compute }) => ({ status: "computed", value: await compute() }));
  });

  it("keeps inventory out of Redis and reads fresh levels even for repeated cache hits", async () => {
    const computed = await pullPosCatalogSnapshot("site-1", "revision");
    expect(computed).toHaveProperty("data.inventorySnapshot");
    if (!("data" in computed)) throw new Error("Snapshot missing");
    const { inventorySnapshot: _inventory, ...cached } = computed.data;
    expect(_inventory.policy).toBe("allow");
    jest.mocked(readThroughJsonCache).mockResolvedValue({ status: "hit", value: cached });
    jest.mocked(pullPosInventorySnapshot).mockResolvedValue({ data: {
      policy: "block", levels: [{ catalog_item_id: "parent", location_id: "location", quantity: 7 }],
    } });
    const next = await pullPosCatalogSnapshot("site-1", "revision");
    expect(next).toHaveProperty("data.inventorySnapshot.levels.0.quantity", 7);
    expect(next).toHaveProperty("data.inventorySnapshot.policy", "block");
    expect(listCatalogItems).toHaveBeenCalledTimes(1);
    expect(pullPosInventorySnapshot).toHaveBeenCalledTimes(2);
    expect(readThroughJsonCache).toHaveBeenCalledWith(expect.objectContaining({ key: "cache:v2:pos-catalog-snapshot:cache-hash" }));
  });

  it("never substitutes an empty inventory snapshot on a stock query failure", async () => {
    jest.mocked(pullPosInventorySnapshot).mockResolvedValue({ error: "Inventory read failed" });
    expect(await pullPosCatalogSnapshot("site-1")).toEqual({ error: "Inventory read failed" });
  });

  it("authorizes before cache or inventory reads", async () => {
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ error: "Forbidden" });
    expect(await pullPosCatalogSnapshot("other-site")).toEqual({ error: "Forbidden" });
    expect(readThroughJsonCache).not.toHaveBeenCalled();
    expect(pullPosInventorySnapshot).not.toHaveBeenCalled();
  });

  it("includes full hidden modifier and variant SKUs without filtering their POS flag", async () => {
    variants = [{ id: "variant", parent_id: "parent", is_pos_available: false, availability_mode: "inventory" } as CatalogItem];
    modifiers = [{ id: "modifier", is_pos_available: false, availability_mode: "manual", availability_status: "unavailable" } as CatalogItem];
    jest.mocked(listAllModifierGroupsForPos).mockResolvedValue({ data: {
      parent: [{ id: "group", items: [{ catalog_item_id: "modifier" }] }],
    } } as never);
    const result = await pullPosCatalogSnapshot("site-1");
    expect("data" in result && result.data.catalogItems).toEqual([parent, ...modifiers, ...variants]);
    expect(calls.eq).toHaveBeenCalledWith("site_id", "site-1");
    expect(calls.eq).toHaveBeenCalledWith("is_purchasable", true);
    expect(calls.eq).toHaveBeenCalledWith("status", "active");
    expect(calls.in).toHaveBeenCalledWith("id", ["modifier"]);
    expect(calls.in).toHaveBeenCalledWith("parent_id", ["parent", "modifier"]);
    expect(getTaxesByCatalogItemIds).toHaveBeenCalledWith("site-1", ["parent", "modifier", "variant"]);
  });

  it("paginates child SKUs above the Supabase limit and avoids duplicate catalog IDs", async () => {
    variants = Array.from({ length: 1001 }, (_, index) => ({ id: `child-${index}`, parent_id: "parent" } as CatalogItem));
    jest.mocked(listCatalogItems).mockResolvedValue({ data: [parent, variants[0]], count: 2 });
    const result = await pullPosCatalogSnapshot("site-1");
    expect("data" in result && result.data.catalogItems).toHaveLength(1002);
    expect(calls.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it("paginates the base catalog past 500 items", async () => {
    const catalog = Array.from({ length: 501 }, (_, index) => ({ id: `item-${index}`, parent_id: "parent" } as CatalogItem));
    jest.mocked(listCatalogItems).mockResolvedValueOnce({ data: catalog.slice(0, 500), count: 501 })
      .mockResolvedValueOnce({ data: catalog.slice(500), count: 501 });
    const result = await pullPosCatalogSnapshot("site-1");
    expect("data" in result && result.data.catalogItems).toHaveLength(501);
    expect(listCatalogItems).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2, pageSize: 500, siteId: "site-1" }));
  });

  it("fails instead of caching missing variants on a query error", async () => {
    queryError = true;
    expect(await pullPosCatalogSnapshot("site-1")).toEqual({ error: "Failed to pull POS catalog snapshot" });
  });

  it("fails instead of caching an empty locations list on a query error", async () => {
    jest.mocked(listLocations).mockResolvedValue({ data: [], error: "private detail" });
    expect(await pullPosCatalogSnapshot("site-1")).toEqual({ error: "Failed to pull POS catalog snapshot" });
  });
});