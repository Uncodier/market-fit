import { listPromotionRedemptions } from "../../app/promotions/list-redemptions";
import { createClient } from "../../lib/supabase/server";

jest.mock("../../lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

describe("listPromotionRedemptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty when the campaign has no promotions", async () => {
    const from = jest.fn((table: string) => {
      if (table === "promotions") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    (createClient as jest.Mock).mockResolvedValue({ from });

    const res = await listPromotionRedemptions({
      siteId: "site-1",
      campaignId: "camp-1",
    });

    expect(res).toEqual({ data: [], count: 0 });
    expect(from).toHaveBeenCalledWith("promotions");
    expect(from).not.toHaveBeenCalledWith("sale_orders");
  });

  it("maps orders that used the campaign promotions", async () => {
    const range = jest.fn().mockResolvedValue({
      data: [
        {
          id: "ord-1",
          order_number: "POS-12",
          created_at: "2026-08-12T18:00:00.000Z",
          discount_total: 10,
          total: 50,
          currency: "USD",
          status: "completed",
          promotion_id: "promo-1",
          promotions: { name: "2x1 en papas", code: null },
          sales: { source: "pos", leads: { name: "Ana" } },
        },
      ],
      count: 1,
      error: null,
    });
    const order = jest.fn().mockReturnValue({ range });
    const promotionIn = jest.fn().mockReturnValue({ order });
    const siteEq = jest.fn().mockReturnValue({ in: promotionIn });
    const select = jest.fn().mockReturnValue({ eq: siteEq });

    const from = jest.fn((table: string) => {
      if (table === "promotions") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ id: "promo-1" }],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "sale_orders") {
        return { select };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    (createClient as jest.Mock).mockResolvedValue({ from });

    const res = await listPromotionRedemptions({
      siteId: "site-1",
      campaignId: "camp-1",
    });

    expect(promotionIn).toHaveBeenCalledWith("promotion_id", ["promo-1"]);
    expect(res.count).toBe(1);
    expect(res.data[0]).toMatchObject({
      id: "ord-1",
      orderNumber: "POS-12",
      promotionName: "2x1 en papas",
      customerName: "Ana",
      source: "pos",
      discountTotal: 10,
    });
  });

  it("lists redemptions for a single promotion", async () => {
    const range = jest.fn().mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    });
    const order = jest.fn().mockReturnValue({ range });
    const promotionIn = jest.fn().mockReturnValue({ order });
    const siteEq = jest.fn().mockReturnValue({ in: promotionIn });

    const from = jest.fn((table: string) => {
      if (table === "sale_orders") {
        return {
          select: jest.fn().mockReturnValue({ eq: siteEq }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    (createClient as jest.Mock).mockResolvedValue({ from });

    await listPromotionRedemptions({
      siteId: "site-1",
      promotionId: "promo-1",
    });

    expect(from).not.toHaveBeenCalledWith("promotions");
    expect(promotionIn).toHaveBeenCalledWith("promotion_id", ["promo-1"]);
  });
});
