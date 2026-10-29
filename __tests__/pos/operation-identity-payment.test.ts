import { enqueueRegisteredCheckout } from "@/app/pos/register/prepare-payment";
import { enqueueCheckout, listOutbox } from "@/app/pos/local/outbox";
import { fetchActivePaymentRegister } from "@/app/pos/operation-client";
import { syncPosCheckout } from "@/app/pos/local/sync-engine";
import type { CheckoutOutboxPayload, PosOutboxRow } from "@/app/pos/local/types";
import { checkoutInput, foreignId, locationId, sessionId, siteId, userId } from "./operation-fixtures";

jest.mock("@/app/pos/local/outbox", () => ({ enqueueCheckout: jest.fn(), listOutbox: jest.fn() }));
jest.mock("@/app/pos/operation-client", () => ({ fetchActivePaymentRegister: jest.fn() }));
jest.mock("@/app/pos/local/sync-engine", () => ({ syncPosCheckout: jest.fn() }));
jest.mock("@/app/pos/register/queue-guard", () => ({
  withRegisterPaymentLock: async (_site: string, operation: () => Promise<unknown>) => operation(),
}));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: () => ({ siteId, userId }), isPosPermissionCurrent: () => true,
}));
jest.mock("@/app/pos/local/remote-permission", () => ({ assertPosRemotePermission: jest.fn() }));
jest.mock("@/app/pos/local/checkout-attempt-storage", () => ({ getCheckoutCartSession: () => "new:cart" }));

const payload: CheckoutOutboxPayload = {
  ...checkoutInput, originLocationId: locationId,
  payments: [{ method: "cash", amount: 10, tendered: 10, change: 0 }],
};
let queued: PosOutboxRow;

beforeEach(() => {
  jest.clearAllMocks();
  queued = {
    id: "row", siteId, kind: "checkout", clientMutationId: payload.clientMutationId,
    payload: { kind: "checkout", data: { ...payload, registerSessionId: sessionId,
      payments: payload.payments!.map((payment) => ({ ...payment, paymentId: foreignId })),
      posOperationIdentity: { version: 1, deviceId: foreignId, createdAt: "2026-10-23T10:00:00Z" },
    } },
    checkoutCartSessionId: "new:cart", status: "failed", attempts: 1,
    createdAt: "2026-10-23T10:00:00Z", updatedAt: "2026-10-23T10:01:00Z",
  };
  jest.mocked(listOutbox).mockImplementation(async () => [queued]);
});

it.each(["same", "alias"])("reuses a tagged queued payment for a metadata-free %s UI attempt", async (attempt) => {
  const original = JSON.stringify(queued);
  const input = attempt === "same" ? payload : { ...payload, clientMutationId: foreignId };
  const onReceipt = jest.fn();
  const result = await enqueueRegisteredCheckout(siteId, input, onReceipt, undefined, { waitForConfirmation: false });
  expect(result).toBe(queued);
  expect(onReceipt).toHaveBeenCalledWith(queued.clientMutationId);
  expect(JSON.stringify(queued)).toBe(original);
  expect(enqueueCheckout).not.toHaveBeenCalled();
  expect(fetchActivePaymentRegister).not.toHaveBeenCalled();
});

it("dispatches the original durable mutation and identity when confirmation is requested", async () => {
  const original = JSON.stringify(queued.payload);
  jest.mocked(syncPosCheckout).mockImplementationOnce(async (_site, mutationId) => {
    expect(mutationId).toBe(queued.clientMutationId);
    expect(JSON.stringify(queued.payload)).toBe(original);
    queued.status = "synced";
  });
  expect(await enqueueRegisteredCheckout(siteId, payload)).toBe(queued);
  expect(syncPosCheckout).toHaveBeenCalledWith(siteId, queued.clientMutationId);
  expect(enqueueCheckout).not.toHaveBeenCalled();
  expect(JSON.stringify(queued.payload)).toBe(original);
});

it("still rejects changed payment content rather than ignoring business fields", async () => {
  await expect(enqueueRegisteredCheckout(siteId, { ...payload, payments: [{ method: "cash", amount: 11 }] },
    undefined, undefined, { waitForConfirmation: false })).rejects.toThrow("unresolved payment");
  expect(enqueueCheckout).not.toHaveBeenCalled();
  expect(syncPosCheckout).not.toHaveBeenCalled();
});