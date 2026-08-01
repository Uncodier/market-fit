import { parseBuyerIdentityQr, resolveBuyerIdentityForSite } from "../../app/commerce/resolve-buyer-qr";
import { findOrCreateLeadForBuyer } from "../../app/commerce/resolve-buyer-lead";

// Mock the lead module
jest.mock("../../app/commerce/resolve-buyer-lead", () => ({
  findOrCreateLeadForBuyer: jest.fn()
}));

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

const mockAdminAuth = {
  auth: {
    admin: {
      getUserById: jest.fn()
    }
  }
};

jest.mock("../../lib/supabase/server", () => ({
  createClient: () => mockSupabase,
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => mockAdminAuth,
}));

describe("Buyer Identity QR", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("parseBuyerIdentityQr", () => {
    it("should extract userId correctly", async () => {
      expect(await parseBuyerIdentityQr("mf:user:123-abc")).toBe("123-abc");
    });

    it("should return null for invalid formats", async () => {
      expect(await parseBuyerIdentityQr("")).toBeNull();
      expect(await parseBuyerIdentityQr("mf:ticket:123")).toBeNull();
      expect(await parseBuyerIdentityQr("user:123")).toBeNull();
    });
  });

  describe("resolveBuyerIdentityForSite", () => {
    it("should fail if not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await resolveBuyerIdentityForSite({ code: "mf:user:123", siteId: "site-1" });
      expect(res.error).toBe("Not authenticated");
    });

    it("should fail if QR code is invalid", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "staff-1" } } });
      mockSupabase.single.mockResolvedValueOnce({ data: { id: "member-1", role: "admin" } }); // member check
      const res = await resolveBuyerIdentityForSite({ code: "invalid", siteId: "site-1" });
      expect(res.error).toBe("Invalid QR code format.");
    });

    it("should successfully resolve buyer and create lead", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "staff-1" } } });
      // member check
      mockSupabase.single.mockResolvedValueOnce({ data: { id: "member-1", role: "admin" } });
      // admin user fetch
      mockAdminAuth.auth.admin.getUserById.mockResolvedValueOnce({
        data: { user: { email: "buyer@example.com", user_metadata: { name: "John Doe" } } }
      });

      // findOrCreateLeadForBuyer mock
      (findOrCreateLeadForBuyer as jest.Mock).mockResolvedValueOnce({
        lead: { id: "lead-123", name: "John Doe", email: "buyer@example.com", buyer_user_id: "123" },
        error: null
      });

      // mock lists (reservations, tickets, orders) -> just empty for simplicity
      const emptyResult = { data: [] };
      mockSupabase.limit.mockResolvedValue(emptyResult);
      // Ensure in returns this for chaining
      mockSupabase.in.mockReturnValue(mockSupabase);
      
      mockSupabase.order.mockImplementation((col: string, opts: any) => {
        if (col === "start_time") {
          return Promise.resolve(emptyResult);
        }
        return mockSupabase;
      });

      // eq is terminal for tickets but intermediate for others
      mockSupabase.eq.mockImplementation((key: string, val: any) => {
        if (key === "is_active") {
          return Promise.resolve(emptyResult);
        }
        return mockSupabase;
      });

      const res = await resolveBuyerIdentityForSite({ code: "mf:user:123", siteId: "site-1" });
      
      expect(res.error).toBeNull();
      expect(res.data).toBeDefined();
      expect(res.data?.user.id).toBe("123");
      expect(res.data?.user.email).toBe("buyer@example.com");
      expect(res.data?.lead.id).toBe("lead-123");
    });
  });
});
