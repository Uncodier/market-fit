/** @jest-environment node */
import { listCatalogPageCategories } from "@/app/catalog/list-categories";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
const query = {
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(), or: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
  range: jest.fn(),
};
const from = jest.fn(() => query);
beforeEach(() => {
  jest.clearAllMocks();
  query.range.mockReset();
  jest.mocked(createClient).mockResolvedValue({ from });
});

it("looks up only a bounded set of page categories under the user's RLS client", async () => {
  query.range.mockResolvedValue({ data: [{ id: "category" }], error: null });
  expect(await listCatalogPageCategories("site", ["category", "category"], false)).toMatchObject({ complete: false });
  expect(createClient).toHaveBeenCalledWith();
  expect(query.eq).toHaveBeenCalledWith("site_id", "site");
  expect(query.in).toHaveBeenCalledWith("id", ["category"]);
  expect(query.range).toHaveBeenCalledWith(0, 49);
});

it("retains empty category sections for small complete active catalogs", async () => {
  const data = [{ id: "empty-category" }];
  query.range.mockResolvedValue({ data, count: 1, error: null });
  expect(await listCatalogPageCategories("site", [], true)).toEqual({ data, complete: true });
  expect(query.or).toHaveBeenCalledWith("status.eq.active,status.is.null");
  expect(query.in).not.toHaveBeenCalled();
});

it("never downloads/renders thousands of empty categories or marks them safe to reorder", async () => {
  query.range.mockResolvedValueOnce({ data: [], count: 1501, error: null })
    .mockResolvedValueOnce({ data: [{ id: "page-category" }], error: null });
  expect(await listCatalogPageCategories("site", ["page-category"], true)).toEqual({ data: [{ id: "page-category" }], complete: false });
  expect(query.range.mock.calls).toEqual([[0, 49], [0, 49]]);
  expect(query.in).toHaveBeenCalledWith("id", ["page-category"]);
});

it("fails closed when the category count exceeds returned data or is unknown", async () => {
  query.range.mockResolvedValue({ data: [], count: null, error: null });
  expect(await listCatalogPageCategories("site", [], true)).toEqual({ data: [], complete: false });
});

it("avoids reads for an empty filtered page", async () => {
  expect(await listCatalogPageCategories("site", [], false)).toEqual({ data: [], complete: false });
  expect(from).not.toHaveBeenCalled();
});