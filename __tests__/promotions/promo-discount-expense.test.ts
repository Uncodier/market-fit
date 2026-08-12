import { upsertPromotionDiscountExpense } from "../../app/promotions/promo-discount-expense";

describe("upsertPromotionDiscountExpense", () => {
  it("skips when discount is zero", async () => {
    const supabase = { from: jest.fn() };
    const res = await upsertPromotionDiscountExpense({
      supabase,
      siteId: "site1",
      saleOrderId: "order1",
      discount: 0,
      campaignId: "camp1",
      leadId: null,
      locationId: null,
      userId: "user1",
      currency: "USD",
      date: "2026-08-11",
      promotionCode: "SAVE",
    });
    expect(res.skipped).toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("inserts a promotions expense when none exists", async () => {
    const insert = jest.fn().mockResolvedValue({ error: null });
    const campaignUpdateEq = jest.fn().mockResolvedValue({ error: null });

    const from = jest.fn((table: string) => {
      if (table === "transactions") {
        return {
          select: jest.fn().mockImplementation((_cols?: string) => ({
            eq: jest.fn().mockImplementation(() => ({
              maybeSingle: jest
                .fn()
                .mockResolvedValue({ data: null, error: null }),
              // campaign refresh path: select('type, amount').eq(...)
              then: undefined,
              data: [{ type: "variable", amount: 15 }],
              error: null,
            })),
          })),
          insert,
        };
      }
      if (table === "campaigns") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { budget: { allocated: 1000 } },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({ eq: campaignUpdateEq }),
        };
      }
      return {};
    });

    // Make the second transactions select awaitable as a thenable result
    from.mockImplementation((table: string) => {
      if (table === "transactions") {
        const eqForLookup = jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        });
        const eqForList = jest.fn().mockResolvedValue({
          data: [{ type: "variable", amount: 15 }],
          error: null,
        });
        let selectCalls = 0;
        return {
          select: jest.fn().mockImplementation(() => {
            selectCalls += 1;
            return {
              eq: selectCalls === 1 ? eqForLookup : eqForList,
            };
          }),
          insert,
        };
      }
      if (table === "campaigns") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { budget: { allocated: 1000 } },
                error: null,
              }),
            }),
          }),
          update: jest.fn().mockReturnValue({ eq: campaignUpdateEq }),
        };
      }
      return {};
    });

    const res = await upsertPromotionDiscountExpense({
      supabase: { from },
      siteId: "site1",
      saleOrderId: "order1",
      discount: 15,
      campaignId: "camp1",
      leadId: "lead1",
      locationId: null,
      userId: "user1",
      currency: "USD",
      date: "2026-08-11",
      promotionCode: "SAVE",
    });

    expect(res.skipped).toBe(false);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "promotions",
        amount: 15,
        sale_order_id: "order1",
        campaign_id: "camp1",
        type: "variable",
      })
    );
    expect(campaignUpdateEq).toHaveBeenCalled();
  });

  it("updates existing expense for the same sale order", async () => {
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq: updateEq });

    const from = jest.fn((table: string) => {
      if (table === "transactions") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: "txn1" },
                error: null,
              }),
            }),
          }),
          update,
        };
      }
      return {};
    });

    const res = await upsertPromotionDiscountExpense({
      supabase: { from },
      siteId: "site1",
      saleOrderId: "order1",
      discount: 25,
      campaignId: null,
      leadId: null,
      locationId: null,
      userId: "user1",
      currency: "MXN",
      date: "2026-08-11",
      promotionName: "Summer",
    });

    expect(res.skipped).toBe(false);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 25, category: "promotions" })
    );
    expect(updateEq).toHaveBeenCalledWith("id", "txn1");
  });
});
