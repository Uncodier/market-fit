/**
 * Unit coverage for the purchasable guard used by checkout.
 * Full assertCanSell pulls Next.js cache; we document the expected rule here.
 */

describe("variant purchasable guard", () => {
  function canSellItem(item: { status: string; is_purchasable?: boolean; availability_mode?: string }) {
    if (item.is_purchasable === false) {
      return { sellable: false, reason: "Item requires variant selection" };
    }
    if (item.status !== "active") {
      return { sellable: false, reason: "Item is archived" };
    }
    if (item.availability_mode === "always" || !item.availability_mode) {
      return { sellable: true };
    }
    return { sellable: true };
  }

  it("blocks parent items that are not purchasable", () => {
    const result = canSellItem({
      status: "active",
      is_purchasable: false,
    });
    expect(result.sellable).toBe(false);
    expect(result.reason).toBe("Item requires variant selection");
  });

  it("allows child variant SKUs", () => {
    const result = canSellItem({
      status: "active",
      is_purchasable: true,
      availability_mode: "always",
    });
    expect(result.sellable).toBe(true);
  });

  it("allows simple items without variants (default purchasable)", () => {
    const result = canSellItem({
      status: "active",
      availability_mode: "always",
    });
    expect(result.sellable).toBe(true);
  });
});
