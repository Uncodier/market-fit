/** @jest-environment node */

import { getPosOrder } from "@/app/pos/actions/get-order";
import { listPosOpenOrders } from "@/app/pos/actions/list-open-orders";
import {
  POS_ORDER_READ_SELECT,
  POS_ORDER_SNAPSHOT_SELECT,
  POS_SALE_SNAPSHOT_SELECT,
} from "@/app/pos/order-snapshot";
import { posSessionFromOrder } from "@/app/pos/order-session";
import { createClient } from "@/lib/supabase/server";
import { hashRedisKeyPart } from "@/lib/redis/control-plane";
import { readThroughJsonCache } from "@/lib/redis/json-cache";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/redis/control-plane", () => ({ hashRedisKeyPart: jest.fn() }));
jest.mock("@/lib/redis/json-cache", () => ({ readThroughJsonCache: jest.fn() }));

const SITE_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_SITE_ID = "33333333-3333-4333-8333-333333333333";
const member = { user_id: "seller-1", name: "Cashier", email: "cashier@example.test" };
const seller = { id: member.user_id, name: member.name };
const lead = { id: "lead-1", name: "Guest", email: "guest@example.test" };
const sale = {
  id: "sale-1", status: "pending", source: "pos", amount: 100,
  amount_due: 60, payment_method: "cash", payments: [{ amount: 40 }], leads: lead,
};
const lines = [
  {
    id: "host", catalog_item_id: "coffee", name: "Coffee", quantity: 2,
    unit_price: 40, status: "pending", parent_sale_order_item_id: null,
    metadata: { client_line_key: "client-host", backorder_quantity: 1 },
  },
  {
    id: "child", catalog_item_id: "milk", name: "Milk", quantity: 4,
    unit_price: 5, status: "pending", parent_sale_order_item_id: "host",
    metadata: { modifier_group_id: "group-1", is_modifier: true },
  },
];
const order = {
  id: ORDER_ID, site_id: SITE_ID, sale_id: sale.id, order_number: "POS-1",
  status: "pending", created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:01:00Z",
  currency: "USD", subtotal: 100, tax_total: 0, discount_total: 0, total: 100,
  notes: "Table 1", fulfillment_method: "pickup", origin_location_id: "location-1",
  price_list_id: "price-1", promotion_id: null, buyer_user_id: null, seller_user_id: "seller-1",
  shipping_address: null, scheduled_for: null, sale_order_items: lines, sales: sale,
};

type Projection = { [key: string]: Projection | null };

// Inspect the actual select contract, not just the exported constant's identity.
function projection(select: string): Projection {
  const tokens = select.match(/[a-z_][a-z_0-9]*|[()*]/gi) || [];
  let index = 0;
  function fields(): Projection {
    const result: Projection = {};
    while (index < tokens.length && tokens[index] !== ")") {
      const name = tokens[index++];
      if (tokens[index] === "(") {
        index += 1;
        result[name] = fields();
        index += 1;
      } else result[name] = null;
    }
    return result;
  }
  return fields();
}

function client({
  authenticated = true,
  userId = "user-1",
  authError = false,
  role = "owner" as string | null,
  roleError = false,
  detail = order as unknown,
  orders = [order] as unknown[],
  sales = [sale] as unknown[],
  members = [member] as unknown[],
  profiles = [] as unknown[],
  queryError = false,
  sellerError = false,
  sellerThrows = false,
  memberError = false,
  profileError = false,
} = {}) {
  const select = jest.fn();
  const eq = jest.fn();
  const inFilter = jest.fn();
  const orderBy = jest.fn();
  const limit = jest.fn();
  const single = jest.fn();
  const abortSignal = jest.fn();
  const error = queryError ? { message: "private database details" } : null;
  const supabase = {
    auth: { getUser: jest.fn(async () => ({
      data: { user: authenticated ? { id: userId } : null },
      error: authError ? { message: "private auth details" } : null,
    })) },
    rpc: jest.fn(async (name: string) => ({ data: name === "current_user_site_role" ? role : false, error: roleError ? { message: "private role details" } : null })),
    from: jest.fn((table: string) => {
      const result = () => {
        if (table === "site_members" || table === "profiles") {
          if (sellerThrows) return Promise.reject(new Error("private identity details"));
          return Promise.resolve({
            data: table === "site_members" ? members : profiles,
            error: sellerError || (table === "site_members" ? memberError : profileError)
              ? { message: "private identity details" } : null,
          });
        }
        return Promise.resolve({ data: table === "sales" ? sales : orders, error });
      };
      const query = {
        select: (value: string) => { select(table, value); return query; },
        eq: (key: string, value: string) => { eq(table, key, value); return query; },
        in: (key: string, values: string[]) => {
          inFilter(table, key, values);
          return query;
        },
        order: (key: string, options: unknown) => { orderBy(key, options); return query; },
        limit: (count: number) => { limit(count); return query; },
        abortSignal: (signal: AbortSignal) => { abortSignal(table, signal); return query; },
        then: (...args: Parameters<ReturnType<typeof result>["then"]>) => result().then(...args),
        single: async () => { single(); return { data: detail, error }; },
      };
      return query;
    }),
  };
  jest.mocked(createClient).mockResolvedValue(supabase);
  return { ...supabase, select, eq, inFilter, orderBy, limit, single, abortSignal };
}

function expectLineProjection(select: string) {
  expect(projection(select).sale_order_items).toEqual({
    id: null, catalog_item_id: null, unit_price: null, metadata: null,
    quantity: null, status: null, name: null, parent_sale_order_item_id: null,
  });
}

function expectSession(snapshot: unknown) {
  expect(posSessionFromOrder(snapshot, [])).toMatchObject({
    cart: [{
      id: "coffee", name: "Coffee", cartQty: 2, cartPrice: 40,
      backorderQty: 1, lineKey: "client-host",
      modifiers: [{ groupId: "group-1", catalogItemId: "milk", cartQty: 2, cartPrice: 5 }],
    }],
    sentLineQuantities: { "client-host": 2 },
    leadValue: { mode: "existing", id: lead.id, label: lead.name },
    fulfillment: "pickup", originLocationId: "location-1", priceListId: "price-1",
    orderNotes: "Table 1", sellerUserId: "seller-1", sellerName: "Cashier", existingPaymentTotal: 40,
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(hashRedisKeyPart).mockResolvedValue("cache-hash");
  jest.mocked(readThroughJsonCache).mockImplementation(async ({ compute }) => ({
    status: "computed", value: await compute(),
  }));
});

describe("getPosOrder", () => {
  it("loads a scoped nested snapshot with one minimal seller batch lookup", async () => {
    const supabase = client();
    const result = await getPosOrder(SITE_ID, ORDER_ID);
    expect(result).toEqual({ data: { ...order, leads: lead, seller } });
    expectSession(result.data);
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: SITE_ID });
    expect(supabase.from.mock.calls).toEqual([["sale_orders"], ["site_members"]]);
    expect(supabase.eq.mock.calls).toEqual([
      ["sale_orders", "site_id", SITE_ID], ["sale_orders", "id", ORDER_ID],
      ["site_members", "site_id", SITE_ID],
    ]);
    expect(supabase.select).toHaveBeenCalledWith("sale_orders", POS_ORDER_READ_SELECT);
    expect(supabase.select).toHaveBeenCalledWith("site_members", "user_id, name, email");
    expect(supabase.inFilter.mock.calls).toEqual([["site_members", "user_id", ["seller-1"]]]);
    expect(supabase.single).toHaveBeenCalledTimes(1);
    expect(readThroughJsonCache).not.toHaveBeenCalled();
    const selected = projection(supabase.select.mock.calls[0][1]);
    expect(selected).toEqual({
      id: null, site_id: null, sale_id: null, order_number: null, status: null,
      created_at: null, updated_at: null, currency: null, subtotal: null,
      tax_total: null, discount_total: null, total: null, notes: null,
      fulfillment_method: null, origin_location_id: null, price_list_id: null,
      promotion_id: null, buyer_user_id: null, seller_user_id: null,
      shipping_address: null, scheduled_for: null,
      promotions: { name: null, code: null, image_url: null },
      sale_order_items: projection(POS_ORDER_SNAPSHOT_SELECT).sale_order_items,
      sales: {
        id: null, status: null, source: null, amount: null, payment_method: null,
        amount_due: null, payments: null, leads: { id: null, name: null, email: null },
      },
    });
    expectLineProjection(POS_ORDER_READ_SELECT);
    expect(POS_ORDER_READ_SELECT).not.toMatch(/\*|public_token|shipments|profiles|site_members|phone|metadata\s*,\s*items/);
  });

  it.each([
    { authenticated: false, error: "Not authenticated" },
    { authError: true, error: "Not authenticated" },
    { role: null, error: "Forbidden" },
    { roleError: true, error: "Site access could not be verified. Please try again." },
  ])("denies access before querying orders: $error", async ({ error, ...options }) => {
    const supabase = client(options);
    expect(await getPosOrder(OTHER_SITE_ID, ORDER_ID)).toEqual({ error });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(readThroughJsonCache).not.toHaveBeenCalled();
  });

  it.each(["", " ", "not-a-uuid", "local_123", null, undefined, 123, {}])(
    "rejects malformed site or order IDs before authentication: %s", async (invalid) => {
      expect(await getPosOrder(invalid as string, ORDER_ID)).toEqual({ error: "Invalid POS order request" });
      expect(await getPosOrder(SITE_ID, invalid as string)).toEqual({ error: "Invalid POS order request" });
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it.each([null, [], undefined])("normalizes absent sale/lead relations to null: %s", async (sales) => {
    client({ detail: { ...order, sales } });
    expect((await getPosOrder(SITE_ID, ORDER_ID)).data).toMatchObject({ sales: null, leads: null });
  });

  it.each([null, [], undefined])("retains a sale with no lead: %s", async (leads) => {
    client({ detail: { ...order, sales: { ...sale, leads } } });
    expect((await getPosOrder(SITE_ID, ORDER_ID)).data).toMatchObject({
      sales: { amount_due: 60, leads: null }, leads: null,
    });
  });

  it("normalizes array-shaped embedded relations", async () => {
    client({ detail: { ...order, sales: [{ ...sale, leads: [lead] }] } });
    expect((await getPosOrder(SITE_ID, ORDER_ID)).data).toEqual({ ...order, leads: lead, seller });
  });

  it("does not disclose missing/cross-site orders or database error details", async () => {
    const supabase = client({ detail: null });
    expect(await getPosOrder(OTHER_SITE_ID, ORDER_ID)).toEqual({ error: "Unable to load POS order" });
    expect(supabase.eq).toHaveBeenCalledWith("sale_orders", "site_id", OTHER_SITE_ID);
    expect(supabase.from.mock.calls).toEqual([["sale_orders"]]);
    client({ queryError: true });
    expect(await getPosOrder(SITE_ID, ORDER_ID)).toEqual({ error: "Unable to load POS order" });
  });

  it("sanitizes unexpected authentication/provider failures", async () => {
    jest.mocked(createClient).mockRejectedValue(new Error("private provider details"));
    expect(await getPosOrder(SITE_ID, ORDER_ID)).toEqual({ error: "Unable to load POS order" });
  });
});

describe("listPosOpenOrders snapshots", () => {
  it("caches seller-enriched complete lines in v3 with one lookup for duplicate sellers", async () => {
    const completed = { ...order, id: "completed", status: "completed" };
    const paid = { ...order, id: "paid", sale_id: "paid-sale" };
    const newer = { ...order, id: "newer", created_at: "2026-10-02T12:00:00Z" };
    const supabase = client({
      orders: [completed, paid, order, newer],
      sales: [sale, { ...sale, id: "paid-sale", amount_due: 0, payments: [{ amount: 100 }] }],
    });
    const result = await listPosOpenOrders(SITE_ID);
    expect(result.data.map((row) => "id" in row ? row.id : undefined)).toEqual(["newer", ORDER_ID, "completed"]);
    expect(result.data[0]).toMatchObject({ sale_order_items: lines, currency: "USD", leads: lead, seller });
    expectSession(result.data[0]);
    expect(supabase.from.mock.calls).toEqual([["sale_orders"], ["sales"], ["site_members"]]);
    expect(supabase.eq.mock.calls).toEqual([
      ["sale_orders", "site_id", SITE_ID], ["sales", "site_id", SITE_ID], ["site_members", "site_id", SITE_ID],
    ]);
    expect(supabase.inFilter.mock.calls).toEqual([
      ["sale_orders", "status", ["pending", "in_progress", "completed"]],
      ["sales", "id", [sale.id, "paid-sale"]],
      ["site_members", "user_id", ["seller-1"]],
    ]);
    expect(supabase.select.mock.calls).toEqual([
      ["sale_orders", POS_ORDER_SNAPSHOT_SELECT], ["sales", POS_SALE_SNAPSHOT_SELECT],
      ["site_members", "user_id, name, email"],
    ]);
    expectLineProjection(supabase.select.mock.calls[0][1]);
    expect(POS_ORDER_SNAPSHOT_SELECT).not.toMatch(/\*|public_token/);
    expect(supabase.orderBy).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(supabase.limit).toHaveBeenCalledWith(100);
    expect(hashRedisKeyPart).toHaveBeenCalledWith(`${SITE_ID}:owner:user-1`);
    expect(readThroughJsonCache).toHaveBeenCalledWith(expect.objectContaining({
      key: "cache:v4:pos-open-orders:cache-hash", ttlSeconds: 5, lockTtlMs: 10_000,
    }));
  });

  it.each([
    { authenticated: false, error: "Not authenticated" },
    { role: null, error: "Forbidden" },
  ])("authorizes before even consulting the cache: $error", async ({ error, ...options }) => {
    const supabase = client(options);
    expect(await listPosOpenOrders(OTHER_SITE_ID)).toEqual({ data: [], error });
    expect(hashRedisKeyPart).not.toHaveBeenCalled();
    expect(readThroughJsonCache).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns complete cache hits without querying and still rechecks access", async () => {
    const supabase = client();
    const data = [{ ...order, leads: lead, seller }];
    jest.mocked(readThroughJsonCache).mockResolvedValue({ status: "hit", value: data });
    expect(await listPosOpenOrders(SITE_ID)).toEqual({ data });
    expectSession(data[0]);
    expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("isolates cached RLS seller identity between callers with the same site role", async () => {
    client({ userId: "first-user" });
    await listPosOpenOrders(SITE_ID);
    client({ userId: "second-user" });
    await listPosOpenOrders(SITE_ID);
    expect(jest.mocked(hashRedisKeyPart).mock.calls).toEqual([
      [`${SITE_ID}:owner:first-user`], [`${SITE_ID}:owner:second-user`],
    ]);
  });

  it("preserves busy-cache behavior", async () => {
    const supabase = client();
    jest.mocked(readThroughJsonCache).mockResolvedValue({ status: "busy" });
    expect(await listPosOpenOrders(SITE_ID)).toEqual({ data: [], error: "Open orders are being refreshed" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("skips sales reads when there are no linked orders", async () => {
    const supabase = client({ orders: [{ ...order, sale_id: null }] });
    expect(await listPosOpenOrders(SITE_ID)).toEqual({ data: [] });
    expect(supabase.from.mock.calls).toEqual([["sale_orders"]]);
  });
});

describe("POS order seller display", () => {
  it("skips identity lookup when a single order has no retained seller", async () => {
    const supabase = client({ detail: { ...order, seller_user_id: null } });
    const result = await getPosOrder(SITE_ID, ORDER_ID);
    expect(result.data).toMatchObject({ seller_user_id: null });
    expect(result.data).not.toHaveProperty("seller");
    expect(supabase.from.mock.calls).toEqual([["sale_orders"]]);
  });

  it("skips identity lookup for an open-order list without sellers", async () => {
    const supabase = client({ orders: [{ ...order, seller_user_id: null }] });
    const result = await listPosOpenOrders(SITE_ID);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).not.toHaveProperty("seller");
    expect(supabase.from.mock.calls).toEqual([["sale_orders"], ["sales"]]);
  });

  it("uses the RLS profile fallback for a retained seller absent from site members", async () => {
    const supabase = client({ members: [], profiles: [{ id: "seller-1", name: "Owner", email: "owner@example.test" }] });
    const result = await getPosOrder(SITE_ID, ORDER_ID);
    expect(result.data?.seller).toEqual({ id: "seller-1", name: "Owner" });
    expect(supabase.from.mock.calls).toEqual([["sale_orders"], ["site_members"], ["profiles"]]);
    expect(supabase.select).toHaveBeenCalledWith("profiles", "id, name, email");
    expect(supabase.inFilter).toHaveBeenCalledWith("profiles", "id", ["seller-1"]);
  });

  it("uses an email as display name without exposing a contact field", async () => {
    const supabase = client({ members: [{ ...member, name: "  " }] });
    const result = await getPosOrder(SITE_ID, ORDER_ID);
    expect(result.data?.seller).toEqual({ id: "seller-1", name: member.email });
    expect(supabase.from.mock.calls).toEqual([["sale_orders"], ["site_members"]]);
  });

  it("falls back to a profile when the member has no display identity", async () => {
    const supabase = client({
      members: [{ user_id: "seller-1", name: " ", email: null }],
      profiles: [{ id: "seller-1", name: "  Profile seller  ", email: "private@example.test" }],
    });
    expect((await getPosOrder(SITE_ID, ORDER_ID)).data?.seller).toEqual({ id: "seller-1", name: "Profile seller" });
    expect(supabase.inFilter).toHaveBeenCalledWith("profiles", "id", ["seller-1"]);
  });

  it("batches all unique sellers and falls back only for unresolved identities", async () => {
    const supabase = client({
      orders: [order, { ...order, id: "owner-order", seller_user_id: "owner-1" }, { ...order, id: "duplicate" }],
      profiles: [{ id: "owner-1", name: null, email: "owner@example.test" }],
    });
    const result = await listPosOpenOrders(SITE_ID);
    expect(result.data).toHaveLength(3);
    expect(result.data.find((row) => row.id === "owner-order")?.seller).toEqual({ id: "owner-1", name: "owner@example.test" });
    expect(supabase.from.mock.calls).toEqual([["sale_orders"], ["sales"], ["site_members"], ["profiles"]]);
    expect(supabase.inFilter).toHaveBeenCalledWith("site_members", "user_id", ["seller-1", "owner-1"]);
    expect(supabase.inFilter).toHaveBeenCalledWith("profiles", "id", ["owner-1"]);
  });

  it("can resolve a profile after a member lookup error without surfacing provider details", async () => {
    client({ memberError: true, profiles: [{ id: "seller-1", name: "Profile seller" }] });
    const result = await getPosOrder(SITE_ID, ORDER_ID);
    expect(result.error).toBeUndefined();
    expect(result.data?.seller).toEqual({ id: "seller-1", name: "Profile seller" });
  });

  it("retains resolved member names when the unresolved profile batch fails", async () => {
    client({
      orders: [order, { ...order, id: "missing-order", seller_user_id: "missing-seller" }],
      profileError: true,
    });
    const result = await listPosOpenOrders(SITE_ID);
    expect(result.error).toBeUndefined();
    expect(result.data.find((row) => row.id === ORDER_ID)?.seller).toEqual(seller);
    expect(result.data.find((row) => row.id === "missing-order")?.seller).toEqual({ id: "missing-seller", name: "Seller unavailable" });
  });

  it.each([
    { members: [], profiles: [] },
    { sellerError: true },
    { sellerThrows: true },
  ])("keeps orders usable and seller IDs unchanged when enrichment is unavailable: %j", async (options) => {
    client(options);
    const detail = await getPosOrder(SITE_ID, ORDER_ID);
    expect(detail.error).toBeUndefined();
    expect(detail.data).toMatchObject({
      seller_user_id: "seller-1", seller: { id: "seller-1", name: "Seller unavailable" },
      sale_order_items: lines,
    });
    expect(posSessionFromOrder(detail.data, [])).toMatchObject({ sellerUserId: "seller-1", sellerName: "Seller unavailable" });
    client(options);
    const list = await listPosOpenOrders(SITE_ID);
    expect(list.error).toBeUndefined();
    expect(list.data[0]).toMatchObject({ seller_user_id: "seller-1", seller: { id: "seller-1", name: "Seller unavailable" } });
  });
});