import { reconcilePosCheckout } from "@/app/pos/local/checkout-recovery";
import { getPosDb } from "@/app/pos/local/db";
import { getPosPermissionLease, type PosPermissionLease } from "@/app/pos/local/location-permission-state";
import { fetchPosCheckoutStatus } from "@/app/pos/checkout-status-client";
import { updateOutboxRow } from "@/app/pos/local/outbox";
import type { PosOutboxRow } from "@/app/pos/local/types";

jest.mock("@/app/pos/local/location-permission-state", () => ({
  getPosPermissionLease: jest.fn(),
  requirePosPermission: () => getPosPermissionLease("site"),
  isPosPermissionCurrent: (token: PosPermissionLease) => token.generation === getPosPermissionLease("site")?.generation,
}));
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/checkout-status-client", () => ({ fetchPosCheckoutStatus: jest.fn() }));
jest.mock("@/app/pos/local/outbox", () => ({ updateOutboxRow: jest.fn(), mapLocalId: jest.fn() }));
jest.mock("@/app/pos/local/sync-engine", () => ({ refreshPosSyncCounts: jest.fn() }));
const grant: PosPermissionLease = { userId: "actor", siteId: "site", generation: 1, role: "owner", expiresAt: Infinity, remoteGeneration: 1 };
const row: PosOutboxRow = { id: "row", siteId: "site", kind: "checkout", status: "failed", attempts: 1,
  createdAt: "", updatedAt: "", clientMutationId: "mutation", payload: { kind: "checkout", data: {
    userId: "actor", siteId: "site", clientMutationId: "mutation", lines: [], fulfillment: "pickup", source: "pos",
  } } };
const read = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  jest.mocked(getPosPermissionLease).mockReturnValue(grant);
  read.mockResolvedValue(row);
  jest.mocked(getPosDb).mockReturnValue({ outbox: { get: read },
    transaction: async (_mode: string, _tables: unknown, action: () => Promise<void>) => action(),
  } as unknown as ReturnType<typeof getPosDb>);
});

it.each(["before", "during local read"])("does not start payment status requests offline %s", async (when) => {
  const offline = () => jest.mocked(getPosPermissionLease).mockReturnValue({ ...grant, offline: true });
  if (when === "before") offline();
  else read.mockImplementationOnce(async () => { offline(); return row; });
  await expect(reconcilePosCheckout("site", row.id)).rejects.toThrow("verify POS access");
  expect(fetchPosCheckoutStatus).not.toHaveBeenCalled();
  expect(updateOutboxRow).not.toHaveBeenCalled();
});

it("applies explicit evidence returned after going offline to the same local scope", async () => {
  jest.mocked(fetchPosCheckoutStatus).mockImplementationOnce(async () => {
    jest.mocked(getPosPermissionLease).mockReturnValue({ ...grant, offline: true });
    return { data: { state: "rejected", message: "No payment was recorded" } };
  });
  await expect(reconcilePosCheckout("site", row.id)).resolves.toMatchObject({ state: "rejected" });
  expect(updateOutboxRow).toHaveBeenCalledWith(row.id, expect.objectContaining({ status: "failed", recoveryState: "rejected" }));
});