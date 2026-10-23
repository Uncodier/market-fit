import { createPendingSplitOrders } from "@/app/pos/create-pending-split-orders";
import { enqueueCheckout, enqueueCreateLead } from "@/app/pos/local/outbox";
import { syncPosCheckout } from "@/app/pos/local/sync-engine";
import { resolveRelationId } from "@/app/commerce/resolve-relation";

const put = jest.fn();
jest.mock("@/app/pos/local/db", () => ({ getPosDb: () => ({ pendingOrders: { put } }) }));
jest.mock("@/app/pos/local/outbox", () => ({ enqueueCheckout: jest.fn(), enqueueCreateLead: jest.fn() }));
jest.mock("@/app/pos/local/sync-engine", () => ({ syncPosCheckout: jest.fn(), refreshPosSyncCounts: jest.fn() }));
jest.mock("@/app/commerce/resolve-relation", () => ({ resolveRelationId: jest.fn(() => new Promise(() => {})) }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: () => ({}), isPosPermissionCurrent: () => true,
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  jest.mocked(syncPosCheckout).mockReturnValue(new Promise(() => {}));
});

it("saves every split and its new customer locally without waiting for sync or a customer action", async () => {
  const item = { id: "coffee", name: "Coffee", cartQty: 1, cartPrice: 10 };
  await createPendingSplitOrders({
    siteId: "site", userId: "actor", fulfillment: "pickup", originLocationId: "store", priceListId: "none",
    leadRelationValue: { mode: "create", label: "New customer" },
    orders: [{ title: "First", items: [item] }, { title: "Second", items: [item] }],
  } as Parameters<typeof createPendingSplitOrders>[0]);
  expect(resolveRelationId).not.toHaveBeenCalled();
  expect(enqueueCreateLead).toHaveBeenCalledTimes(1);
  expect(enqueueCheckout).toHaveBeenCalledTimes(2);
  expect(put).toHaveBeenCalledTimes(2);
  const localLeadId = jest.mocked(enqueueCreateLead).mock.calls[0][1].localLeadId;
  for (const [, queued] of jest.mocked(enqueueCheckout).mock.calls) {
    expect(queued).toMatchObject({ localLeadId, payments: [], intent: "send" });
    expect(syncPosCheckout).toHaveBeenCalledWith("site", queued.clientMutationId);
  }
});

it("keeps offline split customers in the local queue instead of silently dropping attribution", async () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  await createPendingSplitOrders({
    siteId: "site", userId: "actor", fulfillment: "pickup", originLocationId: "store", priceListId: "none",
    leadRelationValue: { mode: "create", label: "New customer" },
    orders: [{ title: "First", items: [{ id: "coffee", cartQty: 1, cartPrice: 10 }] }],
  } as Parameters<typeof createPendingSplitOrders>[0]);
  expect(enqueueCreateLead).toHaveBeenCalledTimes(1);
  expect(enqueueCheckout).toHaveBeenCalledTimes(1);
  expect(syncPosCheckout).not.toHaveBeenCalled();
});