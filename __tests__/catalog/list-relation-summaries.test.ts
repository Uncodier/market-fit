/** @jest-environment node */
import { attachCatalogRelationSummaries } from "@/app/catalog/relation-summaries";
import { createClient } from "@/lib/supabase/server";
import type { CatalogItem } from "@/app/types";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); });

it("avoids lookup reads for empty pages and unrelated items", async () => {
  await attachCatalogRelationSummaries([]);
  const items = [{ id: "product" }] as CatalogItem[];
  expect(await attachCatalogRelationSummaries(items)).toBe(items);
  expect(createClient).not.toHaveBeenCalled();
});

it("batches only returned plan/pass IDs into at most 50 per RLS lookup", async () => {
  const query = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn(async (column: string, ids: string[]) => ({
      data: ids.map(id => column === "plan_catalog_item_id" ? {
        plan_catalog_item_id: id, digital_catalog_item: { id: `digital-${id}`, name: "Digital", kind: "digital_asset" },
      } : {
        pass_catalog_item_id: id, reservable_catalog_item: { id: `service-${id}`, name: "Service", kind: "service" },
      }), error: null,
    })),
  };
  const from = jest.fn(() => query);
  jest.mocked(createClient).mockResolvedValue({ from });
  const items = Array.from({ length: 101 }, (_, index) => ({
    id: `item-${index}`, is_recurring: true, digital_subtype: "pass",
  })) as CatalogItem[];
  const summarized = await attachCatalogRelationSummaries(items);
  expect(createClient).toHaveBeenCalledWith();
  expect(query.in).toHaveBeenCalledTimes(6);
  for (const column of ["plan_catalog_item_id", "pass_catalog_item_id"]) {
    const ids = query.in.mock.calls.filter(([key]) => key === column).flatMap(([, values]) => values);
    expect(ids).toEqual(items.map(item => item.id));
  }
  expect(query.in.mock.calls.every(([, ids]) => ids.length <= 50)).toBe(true);
  expect(summarized[100].plan_includes?.[0].id).toBe("digital-item-100");
  expect(summarized[100].pass_redeems?.[0].id).toBe("service-item-100");
});