import {
  formatOrderListDescription,
  formatOrderProductSummary,
  formatOrderTime,
  orderProductSearchText,
} from "@/app/orders/order-list-description";

const items = [
  {
    name: "Cheeseburger",
    quantity: 2,
    parent_sale_order_item_id: null,
  },
  {
    name: "Extra cheese",
    quantity: 2,
    parent_sale_order_item_id: "burger-line",
  },
  {
    name: "Iced tea",
    quantity: 1,
    parent_sale_order_item_id: null,
  },
];

describe("order list descriptions", () => {
  it("summarizes primary products with their quantities", () => {
    expect(formatOrderProductSummary(items)).toBe(
      "Cheeseburger ×2, Iced tea",
    );
  });

  it("excludes removed sent products from the active summary but retains searchable history", () => {
    const cancelled = items.map((item) => ({ ...item, status: "cancelled" }));
    expect(formatOrderProductSummary([...cancelled, { name: "Coffee", quantity: 1, status: "new" }])).toBe("Coffee");
    expect(formatOrderProductSummary(cancelled)).toBe("");
    expect(orderProductSearchText(cancelled)).toContain("Cheeseburger");
  });

  it("keeps every line searchable, including modifiers", () => {
    expect(orderProductSearchText(items)).toBe(
      "Cheeseburger Extra cheese Iced tea",
    );
  });

  it("combines products with the order hour and minute", () => {
    const createdAt = "2026-09-19T19:07:00.000Z";
    expect(
      formatOrderListDescription({
        created_at: createdAt,
        sale_order_items: items,
      }),
    ).toBe(`Cheeseburger ×2, Iced tea · ${formatOrderTime(createdAt)}`);
  });
});
