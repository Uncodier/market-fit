/**
 * Pure idempotency decision tests (no Supabase).
 * Mirrors checkoutCart early-return behavior when a mutation already exists.
 */

type PosMutationReplay = {
  sale_id: string | null;
  order_id: string | null;
};

function applyIdempotentCheckout(
  existing: PosMutationReplay | null,
): { success: true; saleId?: string; orderId?: string; idempotent: true } | null {
  if (!existing) return null;
  return {
    success: true,
    saleId: existing.sale_id || undefined,
    orderId: existing.order_id || undefined,
    idempotent: true,
  };
}

describe("pos checkout idempotency apply", () => {
  it("returns prior sale/order without re-running checkout", () => {
    const result = applyIdempotentCheckout({
      sale_id: "sale-1",
      order_id: "order-1",
    });
    expect(result).toEqual({
      success: true,
      saleId: "sale-1",
      orderId: "order-1",
      idempotent: true,
    });
  });

  it("allows first-time apply when no prior mutation", () => {
    expect(applyIdempotentCheckout(null)).toBeNull();
  });
});
