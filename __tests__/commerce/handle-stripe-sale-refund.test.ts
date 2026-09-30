import {
  handleStripeSaleRefund,
  isFullStripeChargeRefund,
  resolveStripeRefundPaymentIntent,
  stripePaymentIntentId,
} from "../../app/commerce/handle-stripe-sale-refund";
import { revokeOrderFulfillment } from "../../app/commerce/order-fulfillment-sync";

jest.mock("../../app/commerce/order-fulfillment-sync", () => ({
  revokeOrderFulfillment: jest.fn().mockResolvedValue(undefined),
}));

describe("stripePaymentIntentId", () => {
  it("reads string or expanded payment intents", () => {
    expect(stripePaymentIntentId("pi_123")).toBe("pi_123");
    expect(stripePaymentIntentId({ id: "pi_456" })).toBe("pi_456");
    expect(stripePaymentIntentId(null)).toBeNull();
  });
});

describe("resolveStripeRefundPaymentIntent", () => {
  it("reads payment_intent from charges and disputes", async () => {
    await expect(
      resolveStripeRefundPaymentIntent({ payment_intent: "pi_direct" })
    ).resolves.toBe("pi_direct");
    await expect(
      resolveStripeRefundPaymentIntent({
        charge: { id: "ch_1", payment_intent: "pi_expanded" },
      })
    ).resolves.toBe("pi_expanded");
  });

  it("loads the charge when a dispute only has the charge id", async () => {
    const retrieveCharge = jest.fn().mockResolvedValue({ payment_intent: "pi_from_charge" });

    await expect(
      resolveStripeRefundPaymentIntent({ charge: "ch_99" }, retrieveCharge)
    ).resolves.toBe("pi_from_charge");
    expect(retrieveCharge).toHaveBeenCalledWith("ch_99");
  });
});

describe("isFullStripeChargeRefund", () => {
  it("treats refunded charges and fully refunded amounts as full", () => {
    expect(isFullStripeChargeRefund({ refunded: true, amount: 1000, amount_refunded: 1000 })).toBe(true);
    expect(isFullStripeChargeRefund({ refunded: false, amount: 1000, amount_refunded: 1000 })).toBe(true);
    expect(isFullStripeChargeRefund({ refunded: false, amount: 1000, amount_refunded: 400 })).toBe(false);
  });
});

describe("handleStripeSaleRefund", () => {
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

  it("marks the sale refunded and revokes the linked order", async () => {
    const sales = createChain();
    sales.maybeSingle.mockResolvedValue({
      data: { id: "sale-1", site_id: "site-1", status: "completed" },
    });
    const orders = createChain();
    orders.maybeSingle.mockResolvedValue({ data: { id: "order-1" } });

    const supabase = {
      from: jest.fn((table: string) => (table === "sales" ? sales : orders)),
    };

    const result = await handleStripeSaleRefund(supabase, "pi_123");

    expect(result).toEqual({ saleId: "sale-1" });
    expect(sales.update).toHaveBeenCalledWith({
      status: "refunded", accounting_state: "pending", updated_at: expect.any(String),
    });
    expect(sales.eq).toHaveBeenCalledWith("site_id", "site-1");
    expect(revokeOrderFulfillment).toHaveBeenCalledWith(supabase, "order-1", { cancelOrder: true });
  });

  it("retries fulfillment for sales that are already refunded", async () => {
    const sales = createChain();
    sales.maybeSingle.mockResolvedValue({
      data: { id: "sale-1", site_id: "site-1", status: "refunded" },
    });
    const orders = createChain();
    orders.maybeSingle.mockResolvedValue({ data: { id: "order-1" } });
    const supabase = { from: jest.fn((table) => table === "sales" ? sales : orders) };

    const result = await handleStripeSaleRefund(supabase, "pi_123");

    expect(result).toEqual({ saleId: "sale-1" });
    expect(sales.update).not.toHaveBeenCalled();
    expect(revokeOrderFulfillment).toHaveBeenCalledWith(supabase, "order-1", { cancelOrder: true });
  });

  it("skips unknown payment intents", async () => {
    const sales = createChain();
    sales.maybeSingle.mockResolvedValue({ data: null });
    const supabase = { from: jest.fn().mockReturnValue(sales) };

    const result = await handleStripeSaleRefund(supabase, "pi_missing");

    expect(result.skipped).toBe("sale_not_found");
  });

  it("finds a sale stored only on payment_details", async () => {
    const sales = createChain();
    sales.maybeSingle
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({
        data: { id: "sale-2", site_id: "site-1", status: "completed" },
      });
    const orders = createChain();
    orders.maybeSingle.mockResolvedValue({ data: { id: "order-2" } });

    const supabase = {
      from: jest.fn((table: string) => (table === "sales" ? sales : orders)),
    };

    const result = await handleStripeSaleRefund(supabase, "pi_details");

    expect(result).toEqual({ saleId: "sale-2" });
    expect(revokeOrderFulfillment).toHaveBeenCalledWith(supabase, "order-2", {
      cancelOrder: true,
    });
  });

  it("does not change payment or accounting state for a dispute", async () => {
    const sales = createChain();
    sales.maybeSingle.mockResolvedValue({ data: { id: "sale-1", site_id: "site-1", status: "completed" } });
    const orders = createChain();
    orders.maybeSingle.mockResolvedValue({ data: { id: "order-1" } });
    const supabase = { from: jest.fn((table) => table === "sales" ? sales : orders) };
    await handleStripeSaleRefund(supabase, "pi_1", { revokeOnly: true });
    expect(sales.update).not.toHaveBeenCalled();
    expect(revokeOrderFulfillment).toHaveBeenCalledTimes(1);
  });

  it.each(["source", "update", "order"])("propagates %s database errors for webhook retries", async (stage) => {
    const sales = createChain();
    sales.maybeSingle.mockResolvedValue(stage === "source" ? { error: { message: "offline" } } : {
      data: { id: "sale-1", site_id: "site-1", status: "completed" },
    });
    if (stage === "update") sales.error = { message: "write failed" };
    const orders = createChain();
    orders.maybeSingle.mockResolvedValue({ error: { message: "order unavailable" } });
    const supabase = { from: jest.fn((table) => table === "sales" ? sales : orders) };
    await expect(handleStripeSaleRefund(supabase, "pi_1")).rejects.toThrow("Unable to");
    expect(revokeOrderFulfillment).not.toHaveBeenCalled();
  });
});
