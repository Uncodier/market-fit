import { grantFromOrder } from "../../app/commerce/entitlements";

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock("../../lib/supabase/server", () => ({
  createClient: () => mockSupabase,
  createServiceClient: () => mockSupabase,
}));

describe("Entitlements: grantFromOrder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should grant entitlement with uses for pass", async () => {
    // 1. Order fetch
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: "order-1",
        site_id: "site-1",
        buyer_user_id: "user-1",
        order_number: "ORD-001",
        items: [
          {
            catalog_item_id: "pass-1",
            quantity: 1,
            name: "10 Class Pass"
          }
        ]
      },
      error: null
    });

    // 2. Existing entitlements check
    mockSupabase.limit.mockResolvedValueOnce({
      data: []
    });

    // 3. Catalog items fetch
    mockSupabase.in.mockResolvedValueOnce({
      data: [
        {
          id: "pass-1",
          kind: "digital_asset",
          digital_subtype: "pass",
          pass_uses: 10,
          pass_validity_days: 30
        }
      ]
    });

    // 4. Insert entitlements
    mockSupabase.insert.mockResolvedValueOnce({ error: null });

    await grantFromOrder("order-1");

    expect(mockSupabase.insert).toHaveBeenCalledTimes(1);
    
    // Check what was inserted
    const insertCall = mockSupabase.insert.mock.calls[0][0];
    expect(insertCall).toHaveLength(1);
    expect(insertCall[0]).toMatchObject({
      catalog_item_id: "pass-1",
      uses_total: 10,
      uses_remaining: 10,
      source_type: "purchase",
      source_id: "order-1",
    });
    // Check if expires_at is set properly (roughly 30 days from now)
    expect(insertCall[0].expires_at).toBeDefined();
    const expiry = new Date(insertCall[0].expires_at);
    const now = new Date();
    const diffDays = Math.round((expiry.getTime() - now.getTime()) / (1000 * 3600 * 24));
    expect(diffDays).toBe(30);
  });

  it("should grant entitlement with ticket token for ticket", async () => {
    // 1. Order fetch
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: "order-2",
        site_id: "site-1",
        buyer_user_id: "user-1",
        order_number: "ORD-002",
        items: [
          {
            catalog_item_id: "ticket-1",
            quantity: 2,
            name: "VIP Ticket"
          }
        ]
      },
      error: null
    });

    // 2. Existing entitlements check
    mockSupabase.limit.mockResolvedValueOnce({
      data: []
    });

    // 3. Catalog items fetch
    mockSupabase.in.mockResolvedValueOnce({
      data: [
        {
          id: "ticket-1",
          kind: "digital_asset",
          digital_subtype: "ticket",
          pass_uses: null,
          pass_validity_days: null
        }
      ]
    });

    // 4. Insert entitlements
    mockSupabase.insert.mockResolvedValueOnce({ error: null });

    await grantFromOrder("order-2");

    expect(mockSupabase.insert).toHaveBeenCalledTimes(1);
    
    // Check what was inserted
    const insertCall = mockSupabase.insert.mock.calls[0][0];
    expect(insertCall).toHaveLength(2); // Qty 2
    expect(insertCall[0]).toMatchObject({
      catalog_item_id: "ticket-1",
      uses_total: 1, // Auto-set for ticket
      uses_remaining: 1,
      source_type: "purchase",
      source_id: "order-2",
    });
    // Check if token was minted
    expect(insertCall[0].metadata.ticket_token).toBeDefined();
    expect(typeof insertCall[0].metadata.ticket_token).toBe("string");
  });
});
