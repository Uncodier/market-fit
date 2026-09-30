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
    type QueryResult = {
      data: Array<{
        id: string;
        quantity: number;
        catalog_items: { id: string; name: string } | Array<{ id: string; name: string }>;
      }>;
      count: number;
      error: { message: string } | null;
    };
    let queryResult: QueryResult;
    const createQuery = () => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      // Supabase builders remain chainable until awaited, including after range().
      then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(queryResult).then(resolve),
    });
    let mockQuery: ReturnType<typeof createQuery>;
    let mockSupabase: { from: jest.Mock };

    beforeEach(() => {
      jest.clearAllMocks();

      queryResult = { data: [], count: 0, error: null };
      mockQuery = createQuery();

      mockSupabase = {
        from: jest.fn().mockReturnValue(mockQuery),
      };

      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    });

    it("filters by siteId", async () => {
      await expect(listInventoryLevels({ siteId: "site-123" })).resolves.toEqual({ data: [], count: 0 });

      expect(mockSupabase.from).toHaveBeenCalledWith("inventory_levels");
      expect(mockQuery.select).toHaveBeenCalledWith(expect.stringContaining('catalog_items!inner(*)'), { count: 'exact' });
      expect(mockQuery.eq).toHaveBeenCalledWith("site_id", "site-123");
    });

    it("filters by catalogItemId when provided", async () => {
      await expect(listInventoryLevels({
        siteId: "site-123",
        catalogItemId: "item-456",
      })).resolves.toEqual({ data: [], count: 0 });

      expect(mockQuery.eq).toHaveBeenCalledWith("site_id", "site-123");
      expect(mockQuery.eq).toHaveBeenCalledWith("catalog_item_id", "item-456");
    });

    it("filters by locationId when provided", async () => {
      await expect(listInventoryLevels({
        siteId: "site-123",
        locationId: "loc-789",
      })).resolves.toEqual({ data: [], count: 0 });

      expect(mockQuery.eq).toHaveBeenCalledWith("site_id", "site-123");
      expect(mockQuery.eq).toHaveBeenCalledWith("location_id", "loc-789");
    });

    it("handles searching via ilike on catalog_items.name", async () => {
      await expect(listInventoryLevels({
        siteId: "site-123",
        q: "shirt",
      })).resolves.toEqual({ data: [], count: 0 });

      expect(mockQuery.ilike).toHaveBeenCalledWith("catalog_items.name", "%shirt%");
    });

    it("flattens catalog_items array structure", async () => {
      queryResult = {
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
      };

      const res = await listInventoryLevels({ siteId: "site-123" });

      expect(res.error).toBeUndefined();
      expect(res.count).toBe(2);
      expect(res.data).toHaveLength(2);
      expect(res.data[0].catalog_item).toEqual({ id: "item-1", name: "Shirt" });
      expect(res.data[1].catalog_item).toEqual({ id: "item-2", name: "Pants" });
    });

    it.each([
      [undefined, [['created_at', { ascending: false }]]],
      ['oldest', [['created_at', { ascending: true }]]],
      ['updated_at', [['updated_at', { ascending: false }], ['created_at', { ascending: false }]]],
    ] as const)('applies pagination and %s ordering before executing the query', async (sort, orders) => {
      await expect(listInventoryLevels({ siteId: 'site-123', page: 3, pageSize: 10, sort }))
        .resolves.toEqual({ data: [], count: 0 });
      expect(mockQuery.range).toHaveBeenCalledWith(20, 29);
      expect(mockQuery.order.mock.calls).toEqual(orders);
      expect(mockQuery.eq).toHaveBeenCalledWith('site_id', 'site-123');
    });

    it('reports database errors without returning inventory data', async () => {
      queryResult.error = { message: 'Permission denied' };
      await expect(listInventoryLevels({ siteId: 'other-site' })).resolves.toEqual({
        data: [], count: 0, error: 'Permission denied',
      });
      expect(mockQuery.eq).toHaveBeenCalledWith('site_id', 'other-site');
    });
  });
});
