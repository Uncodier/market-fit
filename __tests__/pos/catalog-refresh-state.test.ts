import { CatalogRefreshState } from "@/app/pos/local/catalog-refresh-state";
import type { PosPermissionLease } from "@/app/pos/local/location-permission-state";
import type { PosOutboxRow } from "@/app/pos/local/types";

const permission: PosPermissionLease = {
  siteId: "site", userId: "cashier", role: "owner", generation: 1, expiresAt: Infinity,
};
function row(patch: Partial<PosOutboxRow> = {}): PosOutboxRow {
  return {
    id: "row", siteId: "site", clientMutationId: "mutation", kind: "checkout", status: "pending", attempts: 0,
    createdAt: "2026-10-23T12:00:00Z", updatedAt: "2026-10-23T12:00:00Z",
    payload: { kind: "checkout", data: {
      siteId: "site", userId: "cashier", clientMutationId: "mutation", source: "pos", fulfillment: "pickup", lines: [],
    } }, ...patch,
  };
}

it("requires a new persisted confirmation and cannot be re-armed by out-of-order reads", () => {
  const state = new CatalogRefreshState();
  expect(state.observe(permission, [row()])).toBe(false);
  expect(state.observe(permission, [row({ status: "synced" })])).toBe(true);
  expect(state.observe(permission, [row()])).toBe(false);
  expect(state.observe(permission, [row({ status: "synced" })])).toBe(false);
  expect(state.observe(permission, [row({ id: "historical", status: "synced" })])).toBe(false);
});

it("does not treat removed rows, non-checkouts, mismatched sites or foreign actors as confirmation", () => {
  const state = new CatalogRefreshState();
  state.observe(permission, [row()]);
  expect(state.observe(permission, [])).toBe(false);
  expect(state.observe(permission, [row({ status: "synced", siteId: "other" })])).toBe(false);
  const foreign = row({ status: "synced" });
  if (foreign.payload.kind === "checkout") foreign.payload.data.userId = "other";
  expect(state.observe(permission, [foreign])).toBe(false);
  expect(state.observe(permission, [row({ status: "synced", kind: "check_in" })])).toBe(false);
});

it("retains same-scope observations through lease generations but isolates actor and role changes", () => {
  const state = new CatalogRefreshState();
  state.observe(permission, [row()]);
  expect(state.observe({ ...permission, generation: 2 }, [row({ status: "synced" })])).toBe(true);
  expect(state.observe({ ...permission, role: "collaborator" }, [row({ status: "synced" })])).toBe(false);
  state.observe(permission, [row()]);
  expect(state.observe({ ...permission, userId: "other" }, [row({ status: "synced" })])).toBe(false);
});

it("bounds exponential cooldown per site and resets it after success or permission invalidation", () => {
  jest.useFakeTimers();
  try {
    const state = new CatalogRefreshState();
    for (const delay of [30_000, 60_000, 120_000, 240_000, 300_000, 300_000]) {
      state.failed("site");
      expect(state.canRetry("other")).toBe(true);
      jest.advanceTimersByTime(delay - 1);
      expect(state.canRetry("site")).toBe(false);
      jest.advanceTimersByTime(1);
      expect(state.canRetry("site")).toBe(true);
    }
    state.succeeded("site");
    state.failed("site");
    jest.advanceTimersByTime(30_000);
    expect(state.canRetry("site")).toBe(true);
    state.failed("site");
    state.resetCooldowns();
    expect(state.canRetry("site")).toBe(true);
  } finally { jest.useRealTimers(); }
});