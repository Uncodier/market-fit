/** @jest-environment node */
import { readPosPriceListItems } from "@/app/pos/actions/price-list-snapshot";

it("pages items and batches list IDs instead of querying each product", async () => {
  const ids = Array.from({ length: 101 }, (_, i) => `list-${i}`);
  const rows = Array.from({ length: 1001 }, (_, i) => ({ id: `price-${i}`, price_list_id: ids[0],
    catalog_item_id: `sku-${i}`, unit_price: i }));
  const calls: unknown[] = [];
  const supabase = { from: jest.fn((table) => ({ select: jest.fn(() => ({ eq: (key: string, site: string) => ({
    in: (column: string, batch: string[]) => ({ order: (order: string) => ({ range: async (start: number, end: number) => {
      calls.push([table, key, site, column, batch.length, order, start, end]);
      return { data: batch[0] === ids[0] ? rows.slice(start, end + 1) : [], error: null };
    } }) }),
  }) })) })) };
  expect(await readPosPriceListItems(supabase as never, "site", ids)).toEqual(rows);
  expect(calls).toEqual([
    ["price_list_items", "site_id", "site", "price_list_id", 100, "id", 0, 999],
    ["price_list_items", "site_id", "site", "price_list_id", 100, "id", 1000, 1999],
    ["price_list_items", "site_id", "site", "price_list_id", 1, "id", 0, 999],
  ]);
});

it("rejects incomplete price datasets", async () => {
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ in: () => ({
    order: () => ({ range: async () => ({ data: null, error: { message: "private" } }) }),
  }) }) }) }) };
  await expect(readPosPriceListItems(supabase as never, "site", ["list"]))
    .rejects.toThrow("Failed to load POS price list items");
});