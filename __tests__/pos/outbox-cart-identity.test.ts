import { enqueueCheckout } from "@/app/pos/local/outbox";
import { getPosDb } from "@/app/pos/local/db";
import type { CheckoutOutboxPayload } from "@/app/pos/local/types";

jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }));
jest.mock("@/app/pos/local/location-permission-state", () => ({
  requirePosPermission: () => ({ siteId: "site", userId: "actor" }),
  isPosPermissionCurrent: () => true,
}));

const payload: CheckoutOutboxPayload = {
  siteId: "site", userId: "actor", source: "pos", fulfillment: "none",
  lines: [], clientMutationId: "original", payments: [{ method: "cash", amount: 10, paymentId: "receipt" }],
};
const add = jest.fn();
const first = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  first.mockResolvedValue(undefined);
  jest.mocked(getPosDb).mockReturnValue({
    outbox: { where: () => ({ equals: () => ({ first }) }), add },
  } as never);
});

it("persists cart identity with the initial outbox write, outside the checkout payload", async () => {
  const row = await enqueueCheckout("site", payload, "new:cart-a");
  expect(add).toHaveBeenCalledWith(expect.objectContaining({ checkoutCartSessionId: "new:cart-a" }));
  expect(row.payload).toEqual({ kind: "checkout", data: payload });
  expect(row.payload.data).not.toHaveProperty("checkoutCartSessionId");
});

it("retains original receipt and cart identity when another cart encounters its mutation", async () => {
  const original = await enqueueCheckout("site", payload, "cart-a");
  first.mockResolvedValue(original);
  expect(await enqueueCheckout("site", payload, "new:cart-b")).toBe(original);
  expect(add).toHaveBeenCalledTimes(1);
  expect(original.checkoutCartSessionId).toBe("cart-a");
});