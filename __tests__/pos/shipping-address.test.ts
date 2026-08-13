import {
  EMPTY_POS_SHIPPING_ADDRESS,
  isCompleteShippingAddress,
} from "@/app/pos/shipping-address";

describe("isCompleteShippingAddress", () => {
  it("requires line1, city, and zip", () => {
    expect(isCompleteShippingAddress(EMPTY_POS_SHIPPING_ADDRESS)).toBe(false);
    expect(
      isCompleteShippingAddress({
        ...EMPTY_POS_SHIPPING_ADDRESS,
        line1: "1 Main St",
        city: "Austin",
        zip: "78701",
      }),
    ).toBe(true);
  });
});
