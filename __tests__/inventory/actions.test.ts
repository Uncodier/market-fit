/**
 * @jest-environment node
 */
import { listInventoryLevels } from "../../app/inventory/actions";
import { createClient } from "../../lib/supabase/server";

// Mock Supabase client
jest.mock("../../lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

describe("inventory actions", () => {
  describe("listInventoryLevels", () => {
    let mockSupabase: any;
    let mockQuery: any;

    beforeEach(() => {
      jest.clearAllMocks();

      mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], count: 0, error: null }),
      };

      mockSupabase = {
        from: jest.fn().mockReturnValue(mockQuery),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    });

    it("filters by siteId", async () => {
      await listInventoryLevels({ siteId: "site-123" });

      expect(mockSupabase.from).toHaveBeenCalledWith("inventory_levels");
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith("site_id", "site-123");
    });

    it("filters by catalogItemId when provided", async () => {
      await listInventoryLevels({
        siteId: "site-123",
        catalogItemId: "item-456",
      });

      expect(mockQuery.eq).toHaveBeenCalledWith("site_id", "site-123");
      expect(mockQuery.eq).toHaveBeenCalledWith("catalog_item_id", "item-456");
    });

    it("filters by locationId when provided", async () => {
      await listInventoryLevels({
        siteId: "site-123",
        locationId: "loc-789",
      });

      expect(mockQuery.eq).toHaveBeenCalledWith("site_id", "site-123");
      expect(mockQuery.eq).toHaveBeenCalledWith("location_id", "loc-789");
    });

    it("handles searching via ilike on catalog_items.name", async () => {
      await listInventoryLevels({
        siteId: "site-123",
        q: "shirt",
      });

      expect(mockQuery.ilike).toHaveBeenCalledWith("catalog_items.name", "%shirt%");
    });

    it("flattens catalog_items array structure", async () => {
      mockQuery.range.mockResolvedValue({
        data: [
          {
            id: "lvl-1",
            quantity: 10,
            catalog_items: [{ id: "item-1", name: "Shirt" }],
          },
          {
            id: "lvl-2",
            quantity: 5,
            catalog_items: { id: "item-2", name: "Pants" }, // Not an array, test both cases
          },
        ],
        count: 2,
        error: null,
      });

      const res = await listInventoryLevels({ siteId: "site-123" });

      expect(res.data[0].catalog_item).toEqual({ id: "item-1", name: "Shirt" });
      expect(res.data[1].catalog_item).toEqual({ id: "item-2", name: "Pants" });
    });
  });
});
