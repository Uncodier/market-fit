import {
  shouldFulfillPaidSale,
  shouldRevokeSale,
  fulfillLinkedOrderAfterPayment,
  revokeOrderFulfillment,
} from "../../app/commerce/order-fulfillment-sync";
import { grantFromOrder, revokeFromOrder } from "../../app/commerce/entitlements";
import { processPostPaymentFulfillment } from "../../app/commerce/post-payment";
import { restockOrderInventory } from "../../app/commerce/restock-order-inventory";

jest.mock("../../app/commerce/entitlements", () => ({
  grantFromOrder: jest.fn().mockResolvedValue(undefined),
  revokeFromOrder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../app/commerce/post-payment", () => ({
  processPostPaymentFulfillment: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../app/commerce/restock-order-inventory", () => ({
  restockOrderInventory: jest.fn().mockResolvedValue(undefined),
}));

describe("shouldFulfillPaidSale", () => {
  it("grants when a pending sale is fully paid and completed", () => {
    expect(shouldFulfillPaidSale("pending", "completed", 0)).toBe(true);
  });

  it("grants when the client already sent completed (register payment)", () => {
    expect(shouldFulfillPaidSale("pending", "completed", 0)).toBe(true);
  });

  it("does not grant while a balance remains", () => {
    expect(shouldFulfillPaidSale("pending", "completed", 10)).toBe(false);
  });

  it("does not grant again for an already completed sale", () => {
    expect(shouldFulfillPaidSale("completed", "completed", 0)).toBe(false);
  });

  it("does not grant a cancelled sale", () => {
    expect(shouldFulfillPaidSale("cancelled", "completed", 0)).toBe(false);
  });
});

describe("shouldRevokeSale", () => {
  it("revokes when completing a paid sale is cancelled or refunded", () => {
    expect(shouldRevokeSale("completed", "cancelled")).toBe(true);
    expect(shouldRevokeSale("completed", "refunded")).toBe(true);
    expect(shouldRevokeSale("pending", "cancelled")).toBe(true);
  });

  it("does not revoke when already terminal", () => {
    expect(shouldRevokeSale("cancelled", "cancelled")).toBe(false);
    expect(shouldRevokeSale("refunded", "refunded")).toBe(false);
    expect(shouldRevokeSale("cancelled", "refunded")).toBe(false);
  });

  it("does not revoke on payment", () => {
    expect(shouldRevokeSale("pending", "completed")).toBe(false);
  });
});

describe("fulfillLinkedOrderAfterPayment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createChain = () => {
    const chain: any = {};
    chain.select = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.maybeSingle = jest.fn();
    return chain;
  };

  it("completes a pending order and runs post-payment fulfillment", async () => {
    const orders = createChain();
    orders.maybeSingle.mockResolvedValue({ data: { id: "order-1", status: "pending" } });
    const supabase = {
      from: jest.fn().mockReturnValue(orders),
    };

    await fulfillLinkedOrderAfterPayment({
      supabase,
      siteId: "site-1",
      saleId: "sale-1",
      leadId: "lead-1",
      userId: "user-1",
    });

    expect(orders.update).toHaveBeenCalledWith({ status: "completed" });
    expect(processPostPaymentFulfillment).toHaveBeenCalledWith(
      "order-1",
      "site-1",
      "sale-1",
      "lead-1",
      "user-1",
    );
    expect(grantFromOrder).not.toHaveBeenCalled();
  });

  it("grants entitlements on in_progress without re-running inventory fulfillment", async () => {
    const orders = createChain();
    orders.maybeSingle.mockResolvedValue({ data: { id: "order-2", status: "in_progress" } });
    const supabase = {
      from: jest.fn().mockReturnValue(orders),
    };

    await fulfillLinkedOrderAfterPayment({
      supabase,
      siteId: "site-1",
      saleId: "sale-1",
      userId: "user-1",
    });

    expect(processPostPaymentFulfillment).not.toHaveBeenCalled();
    expect(grantFromOrder).toHaveBeenCalledWith("order-2", true);
  });
});

describe("revokeOrderFulfillment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("cancels items and reservations and revokes entitlements", async () => {
    const orders = {
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: "order-1",
          status: "completed",
          site_id: "site-1",
          origin_location_id: null,
          items: [],
        },
      }),
    };
    const items = {
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [{ id: "item-1" }] }),
    };
    const reservations = {
      update: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({}),
    };
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "sale_orders") return orders;
        if (table === "sale_order_items") return items;
        if (table === "reservations") return reservations;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          then: (resolve: any) => Promise.resolve({ data: [] }).then(resolve),
        };
      }),
    };

    await revokeOrderFulfillment(supabase, "order-1", { cancelOrder: true });

    expect(orders.update).toHaveBeenCalledWith({ status: "cancelled" });
    expect(revokeFromOrder).toHaveBeenCalledWith("order-1", true);
    expect(reservations.update).toHaveBeenCalledWith({ status: "cancelled" });
    expect(reservations.in).toHaveBeenCalledWith("sale_order_item_id", ["item-1"]);
    expect(restockOrderInventory).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ id: "order-1", status: "completed" }),
    );
  });
});
