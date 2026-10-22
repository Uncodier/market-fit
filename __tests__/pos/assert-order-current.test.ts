/** @jest-environment node */
import { readFileSync } from "node:fs";
import path from "node:path";
import { assertPosOrderCurrent } from "@/app/pos/assert-order-current";
import { getPosOrder } from "@/app/pos/actions/get-order";
import { posOrderVersion } from "@/app/pos/order-version";

jest.mock("server-only", () => ({}));
jest.mock("@/app/pos/actions/get-order", () => ({ getPosOrder: jest.fn() }));

const order = { id: "order", site_id: "site", status: "pending", total: 100,
  notes: "Original notes", seller_user_id: "seller-1",
  sales: { amount: 100, amount_due: 100, payments: [] },
  sale_order_items: [{ id: "line", catalog_item_id: "sku", quantity: 1, unit_price: 100, status: "sent" }],
};
const baseline = posOrderVersion(order);

describe("server POS stale-order guard", () => {
  beforeEach(() => jest.clearAllMocks());

  it("accepts an unchanged snapshot", async () => {
    jest.mocked(getPosOrder).mockResolvedValue({ data: order } as never);
    await expect(assertPosOrderCurrent("site", "order", baseline)).resolves.toBeUndefined();
    expect(getPosOrder).toHaveBeenCalledWith("site", "order");
  });

  it.each([
    { ...order, status: "cancelled" },
    { ...order, sales: { ...order.sales, amount_due: 0 } },
    { ...order, sales: { ...order.sales, amount_due: 40, payments: [{ amount: 60 }] } },
    { ...order, sale_order_items: [{ ...order.sale_order_items[0], quantity: 2 }] },
    { ...order, sale_order_items: [{ ...order.sale_order_items[0], status: "cancelled" }] },
    { ...order, site_id: "foreign" },
    { ...order, notes: "New instructions" },
    { ...order, notes: null },
    { ...order, seller_user_id: "seller-2" },
    { ...order, seller_user_id: null },
  ])("rejects changed, settled or foreign orders", async (changed) => {
    jest.mocked(getPosOrder).mockResolvedValue({ data: changed } as never);
    await expect(assertPosOrderCurrent("site", "order", baseline)).rejects.toThrow("has changed");
  });

  it("fails closed on an unreadable order", async () => {
    jest.mocked(getPosOrder).mockResolvedValue({ error: "Forbidden" });
    await expect(assertPosOrderCurrent("site", "order", baseline)).rejects.toThrow("has changed");
  });
  it("accepts kitchen progress without accepting changed financial or cancelled lines", async () => {
    jest.mocked(getPosOrder).mockResolvedValue({ data: { ...order, status: "completed",
      sale_order_items: [{ ...order.sale_order_items[0], status: "completed" }],
    } } as never);
    await expect(assertPosOrderCurrent("site", "order", baseline)).resolves.toBeUndefined();
  });

  it.each(["", "x".repeat(500_001)])("rejects invalid versions before querying", async (version) => {
    await expect(assertPosOrderCurrent("site", "order", version)).rejects.toThrow("Invalid POS");
    expect(getPosOrder).not.toHaveBeenCalled();
  });

  it("canonicalizes line order but detects modifier and payment changes", () => {
    const two = { ...order, sale_order_items: [order.sale_order_items[0], { id: "extra", metadata: { modifier_group_id: "milk" } }] };
    expect(posOrderVersion(two)).toBe(posOrderVersion({ ...two, sale_order_items: [...two.sale_order_items].reverse() }));
    expect(posOrderVersion({ ...two, sale_order_items: [...two.sale_order_items, { id: "extra-2" }] })).not.toBe(posOrderVersion(two));
    expect(posOrderVersion({ ...order, notes: "New notes" })).not.toBe(baseline);
    expect(posOrderVersion({ ...order, seller_user_id: "seller-2" })).not.toBe(baseline);
  });

  it("keeps successful idempotent retries before validation and validates before side effects", () => {
    const source = readFileSync(path.join(process.cwd(), "app/commerce/checkout.ts"), "utf8");
    const guard = source.indexOf("await assertPosOrderCurrent(");
    expect(guard).toBeGreaterThan(source.indexOf("idempotent: true"));
    expect(guard).toBeLessThan(source.indexOf("await prepareCheckoutEnvironment("));
    expect(guard).toBeLessThan(source.indexOf("await processCheckoutLines("));
    expect(source).toContain('params.source === "pos" && params.existingOrderId && params.expectedOrderVersion !== undefined');
  });
});