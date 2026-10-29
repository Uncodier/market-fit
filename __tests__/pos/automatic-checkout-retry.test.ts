import { checkoutRetryDelay, supportsAutomaticCheckoutRetry } from "@/app/pos/local/automatic-checkout-retry";
import type { PosOutboxRow } from "@/app/pos/local/types";

it("caps progressive retry waits at five minutes", () => {
  expect([0, 1, 2, 3, 6, 7, 100].map(checkoutRetryDelay))
    .toEqual([5000, 5000, 10000, 20000, 160000, 300000, 300000]);
});

it.each([undefined, null, {}, { version: 1 }, {
  version: 1, deviceId: "not-a-device", createdAt: "2026-10-28T12:00:00Z",
}])("does not opt legacy or malformed identity into automatic resend: %j", (identity) => {
  const row = { payload: { kind: "checkout", data: { posOperationIdentity: identity } } } as PosOutboxRow;
  expect(supportsAutomaticCheckoutRetry(row)).toBe(false);
});

it("recognizes persisted protocol metadata after serialization", () => {
  const row = { payload: { kind: "checkout", data: { posOperationIdentity: {
    version: 1, deviceId: "11111111-1111-4111-8111-111111111111", createdAt: "2026-10-28T12:00:00Z",
  } } } } as PosOutboxRow;
  expect(supportsAutomaticCheckoutRetry(JSON.parse(JSON.stringify(row)))).toBe(true);
});