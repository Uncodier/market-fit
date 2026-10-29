import { cancelPosCheckout } from "@/app/pos/local/cancel-checkout";
import { getPosDb } from "@/app/pos/local/db";
import { applyPosCheckoutRecovery } from "@/app/pos/local/checkout-recovery";
import { isPosPermissionCurrent } from "@/app/pos/local/location-permission-state";
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/checkout-recovery", () => ({ applyPosCheckoutRecovery: jest.fn() }));
jest.mock("@/app/pos/local/remote-permission", () => ({
  requirePosRemotePermission: jest.fn(() => ({ siteId: "site", userId: "actor" })), assertPosRemotePermission: jest.fn(),
}));
jest.mock("@/app/pos/local/location-permission-state", () => ({ isPosPermissionCurrent: jest.fn(() => true) }));
jest.mock("@/app/pos/local/sync-engine", () => ({ refreshPosSyncCounts: jest.fn() }));
const row = { id: "row", siteId: "site", status: "failed", clientMutationId: "original",
  payload: { kind: "checkout", data: { userId: "actor" } } };
const get = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue(row);
  jest.mocked(getPosDb).mockReturnValue({ outbox: { get } } as unknown as ReturnType<typeof getPosDb>);
  jest.mocked(isPosPermissionCurrent).mockReturnValue(true);
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: { state: "rejected", message: "Operation cancelled" } }) } as Response);
});
it("keeps identity and applies only confirmed server rejection", async () => {
  await cancelPosCheckout("site", "row", " Mistake ");
  expect(fetch).toHaveBeenCalledWith("/api/pos/checkout-cancel", expect.objectContaining({
    body: JSON.stringify({ siteId: "site", clientMutationId: "original", reason: "Mistake" }),
  }));
  expect(applyPosCheckoutRecovery).toHaveBeenCalledWith(row, { state: "rejected", message: "Operation cancelled" });
});
it.each([409, 500])("never unlocks local payments on HTTP %s", async (status) => {
  jest.mocked(fetch).mockResolvedValue({ ok: false, status, json: async () => ({ error: "private failure" }) } as Response);
  await expect(cancelPosCheckout("site", "row", "Mistake")).rejects.toThrow(/Cancellation/);
  expect(applyPosCheckoutRecovery).not.toHaveBeenCalled();
});
it.each([
  ["not_found", "no admission record"], ["writes_started", "started checkout writes"],
  ["review_required", "started checkout writes"], ["completed", "started checkout writes"],
])("explains %s cancellation refusal without applying a local rejection", async (cancellationState, message) => {
  jest.mocked(fetch).mockResolvedValue({ ok: false, status: 409, json: async () => ({ cancellationState }) } as Response);
  await expect(cancelPosCheckout("site", "row", "Mistake")).rejects.toThrow(message);
  expect(applyPosCheckoutRecovery).not.toHaveBeenCalled();
});
it.each([{ siteId: "other" }, { status: "synced" }, { payload: { kind: "checkout", data: { userId: "other" } } }])(
  "rejects changed ownership or completed operation %j", async (patch) => {
    get.mockResolvedValue({ ...row, ...patch });
    await expect(cancelPosCheckout("site", "row", "Mistake")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
it("ignores the response after access revocation", async () => {
  jest.mocked(isPosPermissionCurrent).mockReturnValue(false);
  await expect(cancelPosCheckout("site", "row", "Mistake")).rejects.toThrow("POS access changed");
  expect(applyPosCheckoutRecovery).not.toHaveBeenCalled();
});
it("requires a reason and rejects malformed success", async () => {
  await expect(cancelPosCheckout("site", "row", " ")).rejects.toThrow("reason");
  expect(fetch).not.toHaveBeenCalled();
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: { state: "completed" } }) } as Response);
  await expect(cancelPosCheckout("site", "row", "Mistake")).rejects.toThrow();
  expect(applyPosCheckoutRecovery).not.toHaveBeenCalled();
});