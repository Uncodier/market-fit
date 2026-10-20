/** @jest-environment node */
import { listCatalogItems } from "@/app/catalog/actions";
import { createClient } from "@/lib/supabase/server";
import { attachCatalogRelationSummaries } from "@/app/catalog/relation-summaries";
import type { CatalogListParams } from "@/app/catalog/types";
import { searchCatalogWindow } from "@/lib/catalog-search/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/app/catalog/relation-summaries", () => ({ attachCatalogRelationSummaries: jest.fn() }));
jest.mock("@/app/commerce/pdp-actions", () => ({ pdpCacheTag: jest.fn() }));
jest.mock("@/app/shop/[siteSlug]/shop-catalog-shared", () => ({ shopCacheTag: jest.fn() }));
jest.mock("@/lib/catalog-search/server", () => ({ searchCatalogWindow: jest.fn(), CatalogSearchError: jest.requireActual("@/lib/catalog-search/server").CatalogSearchError }));

const result = { data: [{ id: "item", name: "Item", site_id: "site" }], count: 1501, error: null as null | { message: string } };
const query = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(), or: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
  range: jest.fn().mockImplementation(() => Promise.resolve(result)),
};
const from = jest.fn(() => query);

beforeEach(() => {
  jest.clearAllMocks();
  result.error = null;
  jest.mocked(createClient).mockResolvedValue({ from });
  jest.mocked(attachCatalogRelationSummaries).mockImplementation(async items => items);
});

it("keeps exact counts, RLS client and tenant filter; summarizes only the returned page", async () => {
  expect(await listCatalogItems({ siteId: "site", page: 21 })).toEqual({ data: result.data, count: 1501 });
  expect(createClient).toHaveBeenCalledWith();
  expect(from).toHaveBeenCalledWith("catalog_items");
  expect(query.select).toHaveBeenCalledWith("*, parent:parent_id(name)", { count: "exact" });
  expect(query.eq).toHaveBeenCalledWith("site_id", "site");
  expect(query.eq).toHaveBeenCalledWith("status", "active");
  expect(query.range).toHaveBeenCalledWith(1000, 1049);
  expect(attachCatalogRelationSummaries).toHaveBeenCalledWith(result.data);
});

it("preserves legacy display order and adds a stable id tie-breaker", async () => {
  await listCatalogItems({ siteId: "site" });
  expect(query.order.mock.calls).toEqual([
    ["sort_order", { ascending: true }], ["created_at", { ascending: false }], ["id", { ascending: true }],
  ]);
});

it.each([
  ["newest", "created_at", false], ["oldest", "created_at", true], ["updated_at", "updated_at", false],
] as const)("sorts %s on the server with id as the final order", async (sortBy, column, ascending) => {
  await listCatalogItems({ siteId: "site", sortBy });
  expect(query.order.mock.calls).toEqual([[column, { ascending }], ["id", { ascending: true }]]);
});

it.each([100, 200, 500, 1000])("does not truncate existing %i-item callers", async pageSize => {
  await listCatalogItems({ siteId: "site", pageSize, page: 2, isPosAvailable: true });
  expect(query.range).toHaveBeenCalledWith(pageSize, pageSize * 2 - 1);
  expect(query.eq).toHaveBeenCalledWith("is_pos_available", true);
});

it.each([
  [{ pageSize: 5000 }, 0, 999], [{ pageSize: 0, page: 0 }, 0, 49],
  [{ pageSize: -1, page: -1 }, 0, 49], [{ pageSize: Infinity, page: NaN }, 0, 49],
  [{ pageSize: 2.5, page: 1.5 }, 0, 49],
] as const)("bounds/normalizes pagination %j", async (params, start, end) => {
  await listCatalogItems({ siteId: "site", ...params });
  expect(query.range).toHaveBeenCalledWith(start, end);
});

it("rejects an unsafe page offset without querying", async () => {
  expect(await listCatalogItems({ siteId: "site", page: Number.MAX_SAFE_INTEGER })).toHaveProperty("error");
  expect(createClient).not.toHaveBeenCalled();
});

it("uses shared search candidates without a second name/SKU filter", async () => {
  jest.mocked(searchCatalogWindow).mockResolvedValue({ success: true, items: [{ id: "item", site_id: "site" }],
    count: 1, count_kind: "candidate_window", has_more: false, mode: "text", degraded: true, search_id: "search" });
  result.data = [{ id: "item", name: "Semantic match", site_id: "site" }] as typeof result.data;
  const found = await listCatalogItems({ siteId: "site", q: "comfortable", kind: "variant" });
  expect(searchCatalogWindow).toHaveBeenCalledWith(expect.objectContaining({ query: "comfortable", channel: "catalog",
    site_id: "site", filters: expect.objectContaining({ kind: "variant" }) }));
  expect(query.in).toHaveBeenCalledWith("id", ["item"]);
  expect(query.not).toHaveBeenCalledWith("parent_id", "is", null);
  expect(query.or).not.toHaveBeenCalled();
  expect(found).toMatchObject({ count: 1, count_kind: "candidate_window", mode: "text", degraded: true });
});

it("does not fall back to substring browse on search failure", async () => {
  jest.mocked(searchCatalogWindow).mockRejectedValueOnce(new Error("Search unavailable"));
  expect(await listCatalogItems({ siteId: "site", q: "comfortable" })).toHaveProperty("error");
  expect(from).not.toHaveBeenCalled();
});

it("does not query an empty trimmed search", async () => {
  await listCatalogItems({ siteId: "site", q: "  " });
  expect(query.or).not.toHaveBeenCalled();
});

it("preserves kind/variant and availability flags", async () => {
  const params: CatalogListParams = {
    siteId: "site", kind: "product", status: "all", availabilityStatus: "available",
    isPosAvailable: false, isReservation: true, isRecurring: false,
  };
  await listCatalogItems(params);
  expect(query.eq).not.toHaveBeenCalledWith("status", expect.anything());
  expect(query.eq).toHaveBeenCalledWith("kind", "product");
  expect(query.is).toHaveBeenCalledWith("parent_id", null);
  expect(query.eq).toHaveBeenCalledWith("availability_status", "available");
  expect(query.eq).toHaveBeenCalledWith("is_pos_available", false);
  expect(query.eq).toHaveBeenCalledWith("is_reservation", true);
  expect(query.eq).toHaveBeenCalledWith("is_recurring", false);
  await listCatalogItems({ siteId: "site", kind: "variant" });
  expect(query.not).toHaveBeenCalledWith("parent_id", "is", null);
});

it("returns safe errors and does not summarize failed RLS reads", async () => {
  result.error = { message: "private database details" };
  expect(await listCatalogItems({ siteId: "other-site" })).toEqual({ data: [], count: 0, error: "Failed to load catalog items" });
  expect(query.eq).toHaveBeenCalledWith("site_id", "other-site");
  expect(attachCatalogRelationSummaries).not.toHaveBeenCalled();
});

it("handles unavailable user sessions without leaking transport details", async () => {
  jest.mocked(createClient).mockRejectedValue(new Error("private session detail"));
  expect(await listCatalogItems({ siteId: "site" })).toEqual({ data: [], count: 0, error: "Failed to load catalog items" });
});