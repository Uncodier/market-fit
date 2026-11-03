/** @jest-environment node */
import { GET as catalog } from "@/app/api/pos/catalog-snapshot/route";
import { GET as orders } from "@/app/api/pos/open-orders/route";
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";
import { pullPosCatalogSnapshot } from "@/app/pos/actions/pull-snapshot";
import { listPosOpenOrders } from "@/app/pos/actions/list-open-orders";
import { READ_SITE, catalogReadFixture, ordersReadFixture } from "./read-fixtures";
import { parsePosOrdersRead } from "@/app/pos/read-contract";
import { hasPosOrderCartSnapshot } from "@/app/pos/order-session";

jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }));
jest.mock("@/app/pos/actions/pull-snapshot", () => ({ pullPosCatalogSnapshot: jest.fn() }));
jest.mock("@/app/pos/actions/list-open-orders", () => ({ listPosOpenOrders: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(requirePosSiteAccess).mockResolvedValue({ supabase: {}, user: { id: "actor" }, role: "owner" } as never);
  jest.mocked(pullPosCatalogSnapshot).mockResolvedValue({ data: catalogReadFixture() } as never);
  jest.mocked(listPosOpenOrders).mockResolvedValue({ data: ordersReadFixture() } as never);
});

describe.each([
  ["catalog-snapshot", catalog, pullPosCatalogSnapshot, catalogReadFixture],
  ["open-orders", orders, listPosOpenOrders, ordersReadFixture],
] as const)("POS %s HTTP boundary", (path, handler, action, fixture) => {
  const request = (query = `siteId=${READ_SITE}`) => new Request(`http://localhost/api/pos/${path}?${query}`);
  it("retains the action data contract after authorization and disables caching", async () => {
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: fixture() });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(requirePosSiteAccess).toHaveBeenCalledWith(READ_SITE);
    expect(jest.mocked(requirePosSiteAccess).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(action).mock.invocationCallOrder[0]);
  });
  it.each(["", "siteId=invalid", "siteId=demo-", `siteId=${READ_SITE}&siteId=${READ_SITE}`, `siteId=${READ_SITE}&userId=forged`])("rejects malformed request %s", async (query) => {
    expect((await handler(request(query))).status).toBe(400);
    expect(requirePosSiteAccess).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });
  it.each([["Not authenticated", 401], ["Forbidden", 403], ["This operation requires unrestricted location access", 403]] as const)("denies %s before reading", async (error, status) => {
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ error });
    expect((await handler(request())).status).toBe(status);
    expect(action).not.toHaveBeenCalled();
  });
  it("does not grant access to a demo prefix", async () => {
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ error: "Forbidden" });
    expect((await handler(request("siteId=demo-foreign"))).status).toBe(403);
    expect(action).not.toHaveBeenCalled();
  });
  it.each([null, {}, { data: {} }, { data: [], error: "private database detail" }])("rejects malformed output without provider details %j", async (value) => {
    jest.mocked(action).mockResolvedValue(value as never);
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
  });
  it("sanitizes thrown failures", async () => {
    jest.mocked(action).mockRejectedValue(new Error("private provider detail"));
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private provider detail");
  });
  it("rejects a foreign-tenant response", async () => {
    const data = fixture();
    const row = Array.isArray(data) ? data[0] : data.catalogItems[0];
    row.site_id = "foreign";
    jest.mocked(action).mockResolvedValue({ data } as never);
    expect((await handler(request())).status).toBe(503);
  });
});

it("preserves revision and uncached recovery controls", async () => {
  const response = await catalog(new Request(`http://localhost/api/pos/catalog-snapshot?siteId=${READ_SITE}&revision=version%7C123&bypassCache=true`));
  expect(response.status).toBe(200);
  expect(pullPosCatalogSnapshot).toHaveBeenCalledWith(READ_SITE, "version|123", true);
});

it.each(["revision=", "revision=a&revision=b", "bypassCache=1", "bypassCache=true&bypassCache=false", `revision=${"x".repeat(4097)}`])("rejects malformed catalog controls %s", async (query) => {
  expect((await catalog(new Request(`http://localhost/api/pos/catalog-snapshot?siteId=${READ_SITE}&${query}`))).status).toBe(400);
  expect(pullPosCatalogSnapshot).not.toHaveBeenCalled();
});

it("round-trips numeric strings and cancelled history through the route and client contract", async () => {
  const base = ordersReadFixture()[0];
  const history = { id: "history", status: "cancelled", parent_sale_order_item_id: null,
    catalog_item_id: null, unit_price: null, quantity: null, name: null, metadata: null };
  jest.mocked(listPosOpenOrders).mockResolvedValue({ data: [{ ...base, sale_order_items: [
    { ...base.sale_order_items[0], parent_sale_order_item_id: null, unit_price: "10", quantity: "1.5" }, history,
    { id: "historical-child", status: "sent", parent_sale_order_item_id: history.id, catalog_item_id: null },
  ] }] } as never);
  const response = await orders(new Request(`http://localhost/api/pos/open-orders?siteId=${READ_SITE}`));
  expect(response.status).toBe(200);
  const parsed = parsePosOrdersRead(await response.json(), READ_SITE);
  expect(parsed?.[0].sale_order_items[0]).toMatchObject({ unit_price: 10, quantity: 1.5 });
  expect(parsed?.[0].sale_order_items[1]).toEqual(history);
  expect(hasPosOrderCartSnapshot(parsed?.[0])).toBe(true);
});