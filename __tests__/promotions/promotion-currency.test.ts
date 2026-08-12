import { resolvePromotionCurrency } from "@/app/promotions/promotion-currency";

describe("resolvePromotionCurrency", () => {
  it("prefers promo override over site currency", () => {
    expect(resolvePromotionCurrency({ currency: "eur" }, "MXN")).toBe("EUR");
  });

  it("falls back to site currency when promo has none", () => {
    expect(resolvePromotionCurrency({ currency: null }, "MXN")).toBe("MXN");
    expect(resolvePromotionCurrency({}, "mxn")).toBe("MXN");
  });

  it("defaults to USD when neither is set", () => {
    expect(resolvePromotionCurrency(null, null)).toBe("USD");
    expect(resolvePromotionCurrency(undefined, undefined)).toBe("USD");
  });
});
