/** @jest-environment node */

import { pullPosInventorySnapshot } from "@/app/pos/actions/inventory-snapshot";
import { createClient } from "@/lib/supabase/server";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const createClientMock = jest.mocked(createClient);
type Level = { catalog_item_id: string; location_id: string; quantity: unknown };

function client({
  levels = [] as Level[],
  commerce = {} as Record<string, unknown> | null,
  authenticated = true,
  role = "owner" as string | null,
  settingsError = false,
  failedOffset = -1,
} = {}) {
  const eq = jest.fn();
  const range = jest.fn(async (start: number, end: number) => ({
    data: start === failedOffset ? null : levels.slice(start, end + 1),
    error: start === failedOffset ? { message: "private database detail" } : null,
  }));
  const order = jest.fn(() => ({ range }));
  const maybeSingle = jest.fn(async () => ({
    data: commerce === null ? null : { commerce },
    error: settingsError ? { message: "private database detail" } : null,
  }));
  const supabase = {
    auth: { getUser: jest.fn(async () => ({ data: { user: authenticated ? { id: "user-1" } : null }, error: null })) },
    rpc: jest.fn(async () => ({ data: role, error: null })),
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({
        eq: (column: string, value: string) => {
          eq(table, column, value);
          return { order, maybeSingle };
        },
      })),
    })),
  };
  createClientMock.mockResolvedValue(supabase);
  return { ...supabase, eq, range, order };
}

describe("pullPosInventorySnapshot", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads all pages under the authorized site and normalizes numeric quantities", async () => {
    const levels = Array.from({ length: 2001 }, (_, index) => ({
      catalog_item_id: `item-${index}`, location_id: "location-1", quantity: "2.5",
    }));
    const supabase = client({ levels, commerce: { stock_shortage_policy: "block" } });
    const result = await pullPosInventorySnapshot("site-1");
    expect("data" in result && result.data.levels).toHaveLength(2001);
    expect("data" in result && result.data.policy).toBe("block");
    expect("data" in result && result.data.levels[2000].quantity).toBe(2.5);
    expect(supabase.range.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(supabase.eq.mock.calls).toEqual([
      ["settings", "site_id", "site-1"],
      ...Array.from({ length: 3 }, () => ["inventory_levels", "site_id", "site-1"]),
    ]);
    expect(supabase.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: "site-1" });
    expect(supabase.order).toHaveBeenCalledWith("id", { ascending: true });
  });

  it.each([{}, null, { stock_shortage_policy: "" }])("defaults absent policy to allow", async (commerce) => {
    client({ commerce });
    expect(await pullPosInventorySnapshot("site-1")).toEqual({ data: { levels: [], policy: "allow" } });
  });

  it("rejects a corrupt nonempty stock policy", async () => {
    client({ commerce: { stock_shortage_policy: "invalid" } });
    expect(await pullPosInventorySnapshot("site-1")).toEqual({ error: "Failed to load POS inventory availability" });
  });

  it("keeps warn policy and finite negative stock", async () => {
    client({ commerce: { stock_shortage_policy: "warn" }, levels: [-2, 0, "2.5"].map((quantity) => ({
      catalog_item_id: "item-1", location_id: "location-1", quantity,
    })) });
    const result = await pullPosInventorySnapshot("site-1");
    expect("data" in result && result.data.policy).toBe("warn");
    expect("data" in result && result.data.levels.map((level) => level.quantity)).toEqual([-2, 0, 2.5]);
  });

  it.each([null, undefined, "", "  ", "bad", NaN, Infinity, {}, false])("rejects malformed persisted quantity %s rather than pretending zero stock", async (quantity) => {
    client({ levels: [{ catalog_item_id: "item-1", location_id: "location-1", quantity }] });
    expect(await pullPosInventorySnapshot("site-1")).toEqual({ error: "Failed to load POS inventory availability" });
  });

  it.each([0, 1000])("returns an error, not a partial/empty snapshot, for page %s failures", async (failedOffset) => {
    client({ failedOffset, levels: Array.from({ length: 1001 }, () => ({
      catalog_item_id: "item-1", location_id: "location-1", quantity: 5,
    })) });
    expect(await pullPosInventorySnapshot("site-1")).toEqual({ error: "Failed to load POS inventory availability" });
  });

  it("does not fall back to allow on settings query errors", async () => {
    const supabase = client({ settingsError: true });
    expect(await pullPosInventorySnapshot("site-1")).toEqual({ error: "Failed to load POS inventory availability" });
    expect(supabase.range).not.toHaveBeenCalled();
  });

  it.each([
    { authenticated: false, role: "owner", error: "Not authenticated" },
    { authenticated: true, role: null, error: "Forbidden" },
  ])("rejects missing identity or cross-site access before data reads: $error", async ({ authenticated, role, error }) => {
    const supabase = client({ authenticated, role });
    expect(await pullPosInventorySnapshot("other-site")).toEqual({ error });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it.each(["", "   ", null])("rejects malformed site input %s before authentication", async (siteId) => {
    expect(await pullPosInventorySnapshot(siteId as string)).toEqual({ error: "siteId is required" });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("sanitizes thrown query errors", async () => {
    createClientMock.mockRejectedValue(new Error("private provider details"));
    expect(await pullPosInventorySnapshot("site-1")).toEqual({ error: "Failed to load POS inventory availability" });
  });
});