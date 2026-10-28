import { normalizePosPromoFingerprint, posPromoCartFingerprint, posPromoOrderContext } from "@/app/pos/recorded-order-promo";
import type { PosCartItem } from "@/app/pos/cart-types";

const context = { leadValue: { mode: "existing" as const, id: "lead", label: "Ada" },
  buyerUserId: "buyer", fulfillment: "pickup", originLocationId: "store" };
const cart = [{ id: "coffee", lineKey: "line", currency: "USD", cartQty: 1, cartPrice: 100 }] as PosCartItem[];

it.each([undefined, "invalid", "{}", "null"])("keeps origin changes significant without an explicit null-origin baseline: %s", (version) => {
  const original = posPromoOrderContext({ ...context, expectedOrderVersion: version });
  expect(posPromoOrderContext({ ...context, originLocationId: "other", expectedOrderVersion: version })).not.toBe(original);
});

it("ignores initial origin assignment only for an explicit null-origin baseline", () => {
  const version = JSON.stringify({ origin_location_id: null });
  expect(posPromoOrderContext({ ...context, originLocationId: "", expectedOrderVersion: version }))
    .toBe(posPromoOrderContext({ ...context, expectedOrderVersion: version }));
});

it("does not confuse creating a customer with a walk-in or an existing customer", () => {
  const walkIn = posPromoOrderContext({ ...context, leadValue: null });
  expect(posPromoOrderContext({ ...context, leadValue: { mode: "create", label: "Ada" } })).not.toBe(walkIn);
  expect(posPromoOrderContext({ ...context, leadValue: { mode: "create", label: "Ada" } }))
    .not.toBe(posPromoOrderContext(context));
});

it("keeps normalized and legacy blocked fingerprints stable", () => {
  const fingerprint = posPromoCartFingerprint(cart, posPromoOrderContext(context));
  expect(normalizePosPromoFingerprint(fingerprint)).toBe(fingerprint);
  expect(normalizePosPromoFingerprint("legacy-promotion-review")).toBe("legacy-promotion-review");
});

it("normalizes old origin assignment and labels without modifying saved line evidence", () => {
  const lines = [["coffee", "line", "USD", 1, 100, null]];
  const old = JSON.stringify([JSON.stringify([context.leadValue, context.buyerUserId, context.fulfillment, ""]), lines]);
  const normalized = normalizePosPromoFingerprint(old, JSON.stringify({ origin_location_id: null }));
  expect(JSON.parse(normalized)).toEqual([posPromoOrderContext({ ...context,
    expectedOrderVersion: JSON.stringify({ origin_location_id: null }) }), lines]);
});

it.each(["{}", "[]", "null", JSON.stringify(["null", []]), JSON.stringify(["[]", []]),
  JSON.stringify([JSON.stringify([{ mode: "unknown" }, null, "pickup", "store"]), []])])(
  "retains malformed evidence instead of fabricating a usable baseline: %s", (saved) => {
    expect(normalizePosPromoFingerprint(saved)).toBe(saved);
  },
);