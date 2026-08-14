import { applyPromotionToOrder } from "../../app/promotions/apply-promotion-to-order";
import { upsertPromotionDiscountExpense } from "../../app/promotions/promo-discount-expense";
import { createClient, createServiceClient } from "../../lib/supabase/server";
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

const mockedUpsertExpense = upsertPromotionDiscountExpense as jest.MockedFunction<
  typeof upsertPromotionDiscountExpense
>;

// Mock next/cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("../../app/promotions/promo-discount-expense", () => ({
  upsertPromotionDiscountExpense: jest.fn().mockResolvedValue({ skipped: false }),
}));

jest.mock("../../app/accounting/ensure", () => ({
  upsertPolizaForExpense: jest.fn().mockResolvedValue(undefined),
}));

// Mock Supabase Server
jest.mock("../../lib/supabase/server", () => {
  const mockSupabase = {
    from: jest.fn(),
  };
  return {
    createClient: jest.fn(() => Promise.resolve(mockSupabase)),
    createServiceClient: jest.fn(() => Promise.resolve(mockSupabase)),
  };
});

describe("applyPromotionToOrder", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUpsertExpense.mockResolvedValue({ skipped: false });
    mockSupabase = {
      from: jest.fn(),
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    (createServiceClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  const setupMocks = (
    promoData: any,
    itemsData: any[],
    orderData: any,
    priorUses: number = 0,
    promoItems: any[] = [],
    promoCategories: any[] = [],
    catalogItems: any[] = []
  ) => {
    const queryBuilder = (tableName: string) => {
      const qb: any = {};
      qb.select = jest.fn().mockReturnValue(qb);
      qb.eq = jest.fn().mockReturnValue(qb);
      qb.single = jest.fn().mockReturnValue(qb);
      qb.maybeSingle = jest.fn().mockReturnValue(qb);
      qb.in = jest.fn().mockReturnValue(qb);
      qb.neq = jest.fn().mockReturnValue(qb);
      qb.not = jest.fn().mockReturnValue(qb);
      qb.update = jest.fn().mockReturnValue(qb);

      if (tableName === "promotions") {
        qb.single = jest.fn().mockResolvedValue(promoData ? { data: promoData } : { data: null });
        qb.maybeSingle = jest.fn().mockResolvedValue(promoData ? { data: promoData } : { data: null });
        qb.update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
      } else if (tableName === "sale_order_items") {
        qb.eq = jest.fn().mockResolvedValue({ data: itemsData });
      } else if (tableName === "sale_orders") {
        const isCountQuery = () =>
          qb.select.mock.calls.some(
            (call: any) => call[1] && call[1].count === "exact" && call[1].head === true
          );
        qb.not = jest.fn().mockImplementation(() => {
          if (isCountQuery()) return Promise.resolve({ count: priorUses });
          return qb;
        });
        qb.neq = jest.fn().mockImplementation(() => {
          if (isCountQuery()) return qb;
          return qb;
        });
        qb.eq = jest.fn().mockImplementation((col) => {
          if (isCountQuery()) return qb;
          if (col === "id" && !qb.update.mock.calls.length) {
            return { single: jest.fn().mockResolvedValue({ data: orderData }) };
          }
          return qb;
        });
        qb.update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
      } else if (tableName === "promotion_catalog_items") {
        qb.eq = jest.fn().mockResolvedValue({ data: promoItems });
      } else if (tableName === "promotion_catalog_categories") {
        qb.eq = jest.fn().mockResolvedValue({ data: promoCategories });
      } else if (tableName === "catalog_items") {
        qb.in = jest.fn().mockResolvedValue({ data: catalogItems });
      } else if (tableName === "settings") {
        qb.maybeSingle = jest.fn().mockResolvedValue({ data: { business_hours: null } });
      } else if (tableName === "sales" || tableName === "leads") {
        qb.update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
      } else if (tableName === "transactions") {
        qb.select = jest.fn().mockReturnValue(qb);
        qb.eq = jest.fn().mockReturnValue(qb);
        qb.maybeSingle = jest.fn().mockResolvedValue({ data: { id: "txn-promo" }, error: null });
      }
      return qb;
    };
    mockSupabase.from.mockImplementation(queryBuilder);
  };

  it("applies a valid ALL promotion", async () => {
    setupMocks(
      { id: "promo1", code: "CODE", status: "active", applies_to: "all", discount_type: "percent", discount_value: 10, usage_count: 0 },
      [{ id: "line1", subtotal: 100 }],
      { id: "order1", buyer_user_id: "user1", tax_total: 10 }
    );

    const res = await applyPromotionToOrder("site1", "order1", "CODE");
    expect(res.error).toBeUndefined();
    expect(res.discount).toBe(10); // 10% of 100
    expect(res.total).toBe(100); // 100 - 10 + 10 tax
  });

  it("rejects if per-user limit reached", async () => {
    setupMocks(
      { id: "promo1", code: "CODE", status: "active", applies_to: "all", usage_limit_per_user: 2, usage_count: 5 },
      [{ id: "line1", subtotal: 100 }],
      { id: "order1", buyer_user_id: "user1" },
      2 // prior uses
    );

    const res = await applyPromotionToOrder("site1", "order1", "CODE");
    expect(res.error).toBe("You have already used this promotion the maximum number of times");
  });

  it("applies if per-user limit NOT reached", async () => {
    setupMocks(
      { id: "promo1", code: "CODE", status: "active", applies_to: "all", discount_type: "fixed", discount_value: 20, usage_limit_per_user: 2, usage_count: 5 },
      [{ id: "line1", subtotal: 100 }],
      { id: "order1", buyer_user_id: "user1", tax_total: 0 },
      1 // prior uses
    );

    const res = await applyPromotionToOrder("site1", "order1", "CODE");
    expect(res.error).toBeUndefined();
    expect(res.discount).toBe(20);
  });

  it("rejects if per-user limit set but no buyer identity", async () => {
    setupMocks(
      { id: "promo1", code: "CODE", status: "active", applies_to: "all", usage_limit_per_user: 1 },
      [{ id: "line1", subtotal: 100 }],
      { id: "order1", buyer_user_id: null, lead_id: null } // no identity
    );

    const res = await applyPromotionToOrder("site1", "order1", "CODE");
    expect(res.error).toBe("Promotion requires an identifiable buyer");
  });

  it("calculates discount based ONLY on eligible products/categories", async () => {
    setupMocks(
      { id: "promo1", code: "CODE", status: "active", applies_to: "selected_items", discount_type: "percent", discount_value: 50 },
      [
        { id: "line1", catalog_item_id: "item1", subtotal: 100 }, // matched explicitly
        { id: "line2", catalog_item_id: "item2", subtotal: 50 }, // matched via category
        { id: "line3", catalog_item_id: "item3", subtotal: 200 } // not matched
      ],
      { id: "order1", buyer_user_id: "user1" },
      0,
      [{ catalog_item_id: "item1" }], // explicitly eligible item
      [{ catalog_category_id: "cat_promo" }], // eligible category
      [
        { id: "item1", category_id: "other_cat" },
        { id: "item2", category_id: "cat_promo" },
        { id: "item3", category_id: "other_cat" }
      ]
    );

    const res = await applyPromotionToOrder("site1", "order1", "CODE");
    expect(res.error).toBeUndefined();
    // Eligible subtotal = 100 (item1) + 50 (item2) = 150.
    // 50% of 150 = 75
    expect(res.discount).toBe(75);
  });

  it("rejects if applies_to selected_items but no items are eligible", async () => {
    setupMocks(
      { id: "promo1", code: "CODE", status: "active", applies_to: "selected_items", discount_type: "percent", discount_value: 50 },
      [
        { id: "line3", catalog_item_id: "item3", subtotal: 200 } // not matched
      ],
      { id: "order1", buyer_user_id: "user1" },
      0,
      [{ catalog_item_id: "item1" }], 
      [{ catalog_category_id: "cat_promo" }], 
      [
        { id: "item3", category_id: "other_cat" }
      ]
    );

    const res = await applyPromotionToOrder("site1", "order1", "CODE");
    expect(res.error).toBe("No eligible items for this promotion");
  });

  it("attributes sale and lead to the promotion campaign", async () => {
    const salesUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    const leadsUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

    setupMocks(
      {
        id: "promo1",
        code: "CODE",
        status: "active",
        applies_to: "all",
        discount_type: "fixed",
        discount_value: 5,
        usage_count: 0,
        campaign_id: "camp1",
      },
      [{ id: "line1", catalog_item_id: "item1", subtotal: 100, quantity: 1 }],
      {
        id: "order1",
        sale_id: "sale1",
        buyer_user_id: "user1",
        tax_total: 0,
        sales: { source: "shop", lead_id: "lead1" },
      }
    );

    mockSupabase.from.mockImplementation((tableName: string) => {
      const qb: any = {};
      qb.select = jest.fn().mockReturnValue(qb);
      qb.eq = jest.fn().mockReturnValue(qb);
      qb.single = jest.fn().mockReturnValue(qb);
      qb.maybeSingle = jest.fn().mockReturnValue(qb);
      qb.in = jest.fn().mockReturnValue(qb);
      qb.neq = jest.fn().mockReturnValue(qb);
      qb.not = jest.fn().mockResolvedValue({ count: 1, error: null });
      qb.update = jest.fn().mockReturnValue(qb);

      if (tableName === "promotions") {
        qb.maybeSingle = jest.fn().mockResolvedValue({
          data: {
            id: "promo1",
            code: "CODE",
            status: "active",
            applies_to: "all",
            discount_type: "fixed",
            discount_value: 5,
            usage_count: 0,
            campaign_id: "camp1",
          },
        });
        qb.single = jest.fn().mockResolvedValue({
          data: { usage_count: 0, campaign_id: "camp1" },
        });
        qb.update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
      } else if (tableName === "sale_order_items") {
        qb.eq = jest.fn().mockResolvedValue({
          data: [{ id: "line1", catalog_item_id: "item1", subtotal: 100, quantity: 1 }],
        });
      } else if (tableName === "sale_orders") {
        qb.eq = jest.fn().mockImplementation((col: string) => {
          if (col === "id") {
            return {
              single: jest.fn().mockResolvedValue({
                data: {
                  id: "order1",
                  sale_id: "sale1",
                  buyer_user_id: "user1",
                  tax_total: 0,
                  sales: { source: "shop", lead_id: "lead1" },
                },
              }),
            };
          }
          return qb;
        });
        qb.update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
      } else if (tableName === "settings") {
        qb.maybeSingle = jest.fn().mockResolvedValue({ data: { business_hours: null } });
      } else if (tableName === "promotion_catalog_items" || tableName === "promotion_catalog_categories") {
        qb.eq = jest.fn().mockResolvedValue({ data: [] });
      } else if (tableName === "sales") {
        qb.update = salesUpdate;
      } else if (tableName === "leads") {
        qb.update = leadsUpdate;
      }
      return qb;
    });

    const res = await applyPromotionToOrder("site1", "order1", "CODE");
    expect(res.error).toBeUndefined();
    expect(salesUpdate).toHaveBeenCalledWith({
      amount: 95,
      amount_due: 95,
      campaign_id: "camp1",
    });
    expect(leadsUpdate).toHaveBeenCalledWith({ campaign_id: "camp1" });
  });

  it("does not mark a paid POS sale as unpaid after applying a discount", async () => {
    const salesUpdate = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    setupMocks(
      { id: "promo1", code: "NEWPIG20", status: "active", applies_to: "all", discount_type: "fixed", discount_value: 32, usage_count: 0 },
      [{ id: "line1", catalog_item_id: "item1", subtotal: 160, quantity: 1 }],
      {
        id: "order1",
        sale_id: "sale1",
        buyer_user_id: "user1",
        tax_total: 0,
        shipping_cost: 0,
        sales: {
          source: "pos",
          lead_id: "lead1",
          amount: 160,
          amount_due: 0,
          payments: [{ amount: 160 }],
          status: "completed",
        },
      }
    );
    mockSupabase.from.mockImplementation((tableName: string) => {
      const qb: any = {};
      qb.select = jest.fn().mockReturnValue(qb);
      qb.eq = jest.fn().mockReturnValue(qb);
      qb.single = jest.fn().mockReturnValue(qb);
      qb.maybeSingle = jest.fn().mockResolvedValue({ data: { id: "txn-promo" }, error: null });
      qb.in = jest.fn().mockReturnValue(qb);
      qb.neq = jest.fn().mockReturnValue(qb);
      qb.not = jest.fn().mockResolvedValue({ count: 1, error: null });
      qb.update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });

      if (tableName === "promotions") {
        qb.maybeSingle = jest.fn().mockResolvedValue({
          data: { id: "promo1", code: "NEWPIG20", status: "active", applies_to: "all", discount_type: "fixed", discount_value: 32, usage_count: 0 },
        });
        qb.single = jest.fn().mockResolvedValue({ data: { usage_count: 0 } });
      } else if (tableName === "sale_order_items") {
        qb.eq = jest.fn().mockResolvedValue({
          data: [{ id: "line1", catalog_item_id: "item1", subtotal: 160, quantity: 1 }],
        });
      } else if (tableName === "sale_orders") {
        qb.eq = jest.fn().mockImplementation((col: string) => {
          if (col === "id") {
            return {
              single: jest.fn().mockResolvedValue({
                data: {
                  id: "order1",
                  sale_id: "sale1",
                  buyer_user_id: "user1",
                  tax_total: 0,
                  shipping_cost: 0,
                  sales: {
                    source: "pos",
                    lead_id: "lead1",
                    amount: 160,
                    amount_due: 0,
                    payments: [{ amount: 160 }],
                    status: "completed",
                  },
                },
              }),
            };
          }
          return qb;
        });
      } else if (tableName === "sales") {
        qb.update = salesUpdate;
      } else if (tableName === "settings") {
        qb.maybeSingle = jest.fn().mockResolvedValue({ data: { business_hours: null } });
      } else if (tableName === "promotion_catalog_items" || tableName === "promotion_catalog_categories") {
        qb.eq = jest.fn().mockResolvedValue({ data: [] });
      }
      return qb;
    });

    const res = await applyPromotionToOrder("site1", "order1", "NEWPIG20");
    expect(res.error).toBeUndefined();
    expect(salesUpdate).toHaveBeenCalledWith({
      amount: 128,
      amount_due: 0,
    });
  });

  it("records the discount expense with service role on POS (no forceServiceRole)", async () => {
    setupMocks(
      { id: "promo1", code: "CODE", status: "active", applies_to: "all", discount_type: "percent", discount_value: 10, usage_count: 0, name: "Ten off" },
      [{ id: "line1", catalog_item_id: "item1", subtotal: 100, quantity: 1 }],
      { id: "order1", site_id: "site1", user_id: "staff1", buyer_user_id: "user1", tax_total: 10, origin_location_id: "loc1", sales: { source: "pos", lead_id: "lead1", sale_date: "2026-08-13", user_id: "staff1" } }
    );

    const res = await applyPromotionToOrder("site1", "order1", "CODE");
    expect(res.error).toBeUndefined();
    expect(createClient).toHaveBeenCalled();
    expect(createServiceClient).toHaveBeenCalledWith(true);
    expect(mockedUpsertExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        saleOrderId: "order1",
        siteId: "site1",
        discount: 10,
        campaignId: null,
        leadId: "lead1",
        locationId: "loc1",
        userId: "staff1",
        promotionCode: "CODE",
        promotionName: "Ten off",
      })
    );
  });

  it("records the discount expense with service role on shop (forceServiceRole)", async () => {
    setupMocks(
      { id: "promo1", code: "CODE", status: "active", applies_to: "all", discount_type: "fixed", discount_value: 5, usage_count: 0, campaign_id: "camp1" },
      [{ id: "line1", catalog_item_id: "item1", subtotal: 100, quantity: 1 }],
      { id: "order1", site_id: "site1", user_id: "owner1", buyer_user_id: "user1", tax_total: 0, sales: { source: "shop", lead_id: "lead1" } }
    );

    const res = await applyPromotionToOrder("site1", "order1", "CODE", true);
    expect(res.error).toBeUndefined();
    expect(createServiceClient).toHaveBeenCalledWith(true);
    expect(mockedUpsertExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        saleOrderId: "order1",
        discount: 5,
        campaignId: "camp1",
        leadId: "lead1",
      })
    );
  });

  it("returns error if recording the promotion expense fails", async () => {
    mockedUpsertExpense.mockRejectedValueOnce(
      new Error("Failed to create promotion expense: permission denied")
    );
    setupMocks(
      { id: "promo1", code: "CODE", status: "active", applies_to: "all", discount_type: "percent", discount_value: 10, usage_count: 0 },
      [{ id: "line1", catalog_item_id: "item1", subtotal: 100, quantity: 1 }],
      { id: "order1", buyer_user_id: "user1", tax_total: 10 }
    );

    const res = await applyPromotionToOrder("site1", "order1", "CODE");
    expect(res.error).toBe("Failed to create promotion expense: permission denied");
  });
});