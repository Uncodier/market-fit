import { upsertPromotionDiscountExpense } from "../../app/promotions/promo-discount-expense";

function lookupBuilder(result: { data: any; error: any }) {
  const builder: any = {
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

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
    const lookup = lookupBuilder({ data: null, error: null });

    const from = jest.fn((table: string) => {
      if (table === "transactions") {
        const eqForList = jest.fn().mockResolvedValue({
          data: [{ type: "variable", amount: 15 }],
          error: null,
        });
        let selectCalls = 0;
        return {
          select: jest.fn().mockImplementation(() => {
            selectCalls += 1;
            return selectCalls === 1 ? lookup : { eq: eqForList };
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
    expect(lookup.eq).toHaveBeenCalledWith("sale_order_id", "order1");
    expect(lookup.eq).toHaveBeenCalledWith("category", "promotions");
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
    const lookup = lookupBuilder({
      data: { id: "txn1" },
      error: null,
    });

    const from = jest.fn((table: string) => {
      if (table === "transactions") {
        return {
          select: jest.fn().mockReturnValue(lookup),
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
    expect(lookup.eq).toHaveBeenCalledWith("category", "promotions");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 25, category: "promotions" })
    );
    expect(updateEq).toHaveBeenCalledWith("id", "txn1");
  });

  it("retries update on unique violation only for promotions category", async () => {
    const insert = jest.fn().mockResolvedValue({
      error: { code: "23505", message: "duplicate" },
    });
    const retryEqCategory = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        data: [{ id: "txn-promo" }],
        error: null,
      }),
    });
    const retryEqOrder = jest.fn().mockReturnValue({
      eq: retryEqCategory,
    });
    const update = jest.fn().mockReturnValue({ eq: retryEqOrder });
    const lookup = lookupBuilder({ data: null, error: null });

    const from = jest.fn((table: string) => {
      if (table === "transactions") {
        return {
          select: jest.fn().mockReturnValue(lookup),
          insert,
          update,
        };
      }
      return {};
    });

    const res = await upsertPromotionDiscountExpense({
      supabase: { from },
      siteId: "site1",
      saleOrderId: "order1",
      discount: 12,
      campaignId: null,
      leadId: null,
      locationId: null,
      userId: "user1",
      currency: "USD",
      date: "2026-08-11",
      promotionCode: "SAVE",
    });

    expect(res.skipped).toBe(false);
    expect(retryEqOrder).toHaveBeenCalledWith("sale_order_id", "order1");
    expect(retryEqCategory).toHaveBeenCalledWith("category", "promotions");
  });

  it("throws when unique violation is a non-promotion transaction", async () => {
    const insert = jest.fn().mockResolvedValue({
      error: { code: "23505", message: "duplicate" },
    });
    const retryEqCategory = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    const from = jest.fn((table: string) => {
      if (table === "transactions") {
        return {
          select: jest.fn().mockReturnValue(
            lookupBuilder({ data: null, error: null })
          ),
          insert,
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({ eq: retryEqCategory }),
          }),
        };
      }
      return {};
    });

    await expect(
      upsertPromotionDiscountExpense({
        supabase: { from },
        siteId: "site1",
        saleOrderId: "order1",
        discount: 12,
        campaignId: null,
        leadId: null,
        locationId: null,
        userId: "user1",
        currency: "USD",
        date: "2026-08-11",
        promotionCode: "SAVE",
      })
    ).rejects.toThrow(
      "a non-promotion transaction already exists for this order"
    );
  });
});
