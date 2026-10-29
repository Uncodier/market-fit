import { posOperationSchema } from "@/app/pos/operation-schemas";
import { claimPosCheckout, posCheckoutFingerprint } from "@/app/pos/checkout-attempt-server";
import type { PosOperationIdentity } from "@/app/commerce/checkout-types";
import { checkoutInput, foreignId, userId } from "./operation-fixtures";

jest.mock("server-only", () => ({}));

const identity = { version: 1 as const, deviceId: foreignId, createdAt: "2026-10-23T10:00:00.123Z" };
const parse = (metadata: unknown) => posOperationSchema.safeParse({
  operation: "checkout", input: { ...checkoutInput, posOperationIdentity: metadata },
});

it("accepts identity and preserves its exact timestamp representation", () => {
  for (const createdAt of [identity.createdAt, "2026-10-23T11:00:00+01:00"]) {
    const metadata = { ...identity, createdAt };
    expect(parse(metadata)).toMatchObject({ success: true, data: { input: { posOperationIdentity: metadata } } });
  }
});

it("accepts legacy payloads without injecting identity", () => {
  const operation = { operation: "checkout", input: checkoutInput };
  expect(posOperationSchema.parse(operation)).toEqual(operation);
});

it.each([
  null, {}, { ...identity, version: 2 }, { ...identity, version: "1" },
  { ...identity, deviceId: "device" }, { ...identity, deviceId: null },
  { ...identity, createdAt: "yesterday" }, { ...identity, createdAt: "2026-10-23" },
  { ...identity, createdAt: "2026-10-23T10:00:00" }, { ...identity, createdAt: 123 },
  { ...identity, createdAt: "2026-02-30T10:00:00Z" },
  { ...identity, extra: true }, { version: 1, deviceId: foreignId },
  { version: 1, createdAt: identity.createdAt },
])("rejects malformed metadata at the HTTP schema and direct server claim: %j", async (metadata) => {
  expect(parse(metadata).success).toBe(false);
  const params = { ...checkoutInput, posOperationIdentity: metadata as unknown as PosOperationIdentity };
  expect(() => posCheckoutFingerprint(params)).toThrow();
  const rpc = jest.fn();
  await expect(claimPosCheckout({ rpc }, params, userId)).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});

it("includes metadata in the server fingerprint without changing legacy fingerprint behavior", () => {
  const legacy = posCheckoutFingerprint(checkoutInput);
  expect(posCheckoutFingerprint({ ...checkoutInput, posOperationIdentity: undefined })).toBe(legacy);
  const tagged = { ...checkoutInput, posOperationIdentity: identity };
  expect(posCheckoutFingerprint(tagged)).toMatch(/^[a-f0-9]{64}$/);
  expect(posCheckoutFingerprint(tagged)).not.toBe(legacy);
  expect(posCheckoutFingerprint(JSON.parse(JSON.stringify(tagged)))).toBe(posCheckoutFingerprint(tagged));
  expect(posCheckoutFingerprint({ ...tagged, posOperationIdentity: { ...identity, createdAt: "2026-10-24T10:00:00Z" } }))
    .not.toBe(posCheckoutFingerprint(tagged));
  expect(posCheckoutFingerprint({ ...tagged, posOperationIdentity: { ...identity, deviceId: userId } }))
    .not.toBe(posCheckoutFingerprint(tagged));
  expect(posCheckoutFingerprint({ ...tagged, clientMutationId: foreignId }))
    .not.toBe(posCheckoutFingerprint(tagged));
});