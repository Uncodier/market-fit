import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import useSWR from "swr";
import CatalogPage from "@/app/catalog/page";
import { listCatalogItems } from "@/app/catalog/actions";
import { listCatalogPageCategories } from "@/app/catalog/list-categories";
import { reorderCatalogDisplay } from "@/app/catalog/reorder-actions";
import type { CatalogListParams, CatalogListResponse } from "@/app/catalog/types";
import type { DropResult } from "@hello-pangea/dnd";

const mockMutate = jest.fn();
let mockSite: { id: string } | null = { id: "site" };
let mockLoading = false;
let mockValidating = false;
let mockCategoriesComplete = true;
let mockItems = { data: [{ id: "item", category_id: "category", name: "Item" }], count: 1501 };
const categories = [{ id: "category", name: "Category" }];
const drag: DropResult = {
  draggableId: "item", type: "item", reason: "DROP", mode: "FLUID",
  source: { droppableId: "category", index: 0 },
  destination: { droppableId: "uncategorized", index: 0 }, combine: null,
};

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite }) }));
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }));
jest.mock("@/app/components/ui/sticky-header", () => ({
  StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
}));
jest.mock("@/app/catalog/actions", () => ({ listCatalogItems: jest.fn(), listCatalogCategories: jest.fn() }));
jest.mock("@/app/catalog/list-categories", () => ({ listCatalogPageCategories: jest.fn() }));
jest.mock("@/app/catalog/reorder-actions", () => ({ reorderCatalogDisplay: jest.fn() }));
jest.mock("@/app/hooks/use-mobile-view", () => ({
  useMobileView: () => React.useState("table"),
  useIsMobile: () => false,
}));
jest.mock("@/app/components/view-selector", () => ({
  ViewSelector: ({ onViewChange }: { onViewChange: (view: string) => void }) =>
    <button onClick={() => onViewChange("kanban")}>Kanban</button>,
}));
jest.mock("@/app/components/ui/sort-dropdown", () => ({
  SortDropdown: ({ sortBy, setSortBy }: { sortBy: string; setSortBy: (value: string) => void }) =>
    <select aria-label="Sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
      <option value="display_order">Display order</option>
      <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="updated_at">Updated</option>
    </select>,
}));
jest.mock("@/app/components/ui/pagination", () => ({
  Pagination: ({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) =>
    <nav aria-label="Pagination"><span>{currentPage}/{totalPages}</span><button onClick={() => onPageChange(currentPage + 1)}>Next page</button></nav>,
}));
type ListingProps = { isDragEnabled: boolean; onDragEnd: (result: DropResult) => void };
jest.mock("@/app/catalog/components/CatalogTable", () => ({
  CatalogTable: ({ isDragEnabled, onDragEnd }: ListingProps) =>
    <div data-testid="table" data-drag={isDragEnabled}><button onClick={() => onDragEnd(drag)}>Attempt drag</button></div>,
}));
jest.mock("@/app/catalog/components/KanbanView", () => ({
  KanbanView: ({ isDragEnabled, onDragEnd }: ListingProps) =>
    <div data-testid="kanban" data-drag={isDragEnabled}><button onClick={() => onDragEnd(drag)}>Attempt drag</button></div>,
}));
jest.mock("@/app/catalog/components/CreateCatalogItemDialog", () => ({ CreateCatalogItemDialog: () => null }));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => function ImportDialog({ open, siteId, onSuccess, onOpenChange }: {
    open: boolean; siteId: string; onSuccess: () => void; onOpenChange: (open: boolean) => void;
  }) {
    return open ? <div role="dialog">Import for {siteId}
      <button onClick={onSuccess}>Import success</button>
      <button onClick={() => onOpenChange(false)}>Close import</button>
    </div> : null;
  },
}));

function currentParams(): CatalogListParams {
  const calls = jest.mocked(useSWR).mock.calls;
  return calls[calls.length - 1][0] as CatalogListParams;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockSite = { id: "site" };
  mockLoading = false;
  mockValidating = false;
  mockCategoriesComplete = true;
  mockItems = { data: [{ id: "item", category_id: "category", name: "Item" }], count: 1501 };
  jest.mocked(useSWR).mockImplementation(() => ({
    data: { items: mockItems, categories, categoriesComplete: mockCategoriesComplete }, error: undefined,
    isLoading: mockLoading, isValidating: mockValidating, mutate: mockMutate,
  }));
  jest.mocked(reorderCatalogDisplay).mockResolvedValue({ success: true });
});
afterEach(() => { jest.useRealTimers(); });

it("always requests 50 items and exposes every page over 1000 in both views", async () => {
  render(<CatalogPage />);
  expect(currentParams()).toMatchObject({ page: 1, pageSize: 50, sortBy: "display_order", q: "" });
  expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent("1/31");
  expect(screen.getByTestId("table")).toHaveAttribute("data-drag", "false");
  fireEvent.click(screen.getByText("Next page"));
  expect(currentParams()).toMatchObject({ page: 2, pageSize: 50 });
  fireEvent.click(screen.getByText("Kanban"));
  expect(currentParams()).toMatchObject({ page: 2, pageSize: 50 });
  expect(screen.getByTestId("kanban")).toHaveAttribute("data-drag", "false");
  expect(screen.getByRole("navigation")).toHaveTextContent("2/31");
  fireEvent.click(screen.getByText("Attempt drag"));
  expect(reorderCatalogDisplay).not.toHaveBeenCalled();

  jest.mocked(listCatalogItems).mockResolvedValue(mockItems as CatalogListResponse);
  jest.mocked(listCatalogPageCategories).mockResolvedValue({ data: [], complete: false });
  const calls = jest.mocked(useSWR).mock.calls;
  const fetcher = calls[calls.length - 1][1] as (params: CatalogListParams) => Promise<unknown>;
  await fetcher(currentParams());
  expect(listCatalogItems).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 50, sortBy: "display_order" }));
  expect(listCatalogPageCategories).toHaveBeenCalledWith("site", ["category"], false);
});

it("debounces search, resets pagination immediately and disables drag during debounce", () => {
  mockItems.count = 1;
  render(<CatalogPage />);
  expect(screen.getByTestId("table")).toHaveAttribute("data-drag", "true");
  const input = screen.getAllByPlaceholderText("Search in catalog...")[0];
  fireEvent.change(input, { target: { value: "S" } });
  fireEvent.change(input, { target: { value: "SKU" } });
  expect(currentParams().q).toBe("");
  expect(screen.getByTestId("table")).toHaveAttribute("data-drag", "false");
  act(() => { jest.advanceTimersByTime(299); });
  expect(currentParams().q).toBe("");
  act(() => { jest.advanceTimersByTime(1); });
  expect(currentParams()).toMatchObject({ q: "SKU", page: 1 });
  expect(mockMutate).not.toHaveBeenCalled();
});

it("resets page on search, kind, status, sort and site without old-page requests", () => {
  const { rerender } = render(<CatalogPage />);
  const next = () => fireEvent.click(screen.getByText("Next page"));
  next();
  fireEvent.change(screen.getAllByPlaceholderText("Search in catalog...")[0], { target: { value: "name" } });
  expect(currentParams().page).toBe(1);
  act(() => { jest.advanceTimersByTime(300); });
  expect(currentParams()).toMatchObject({ q: "name", page: 1 });
  next();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Products" }));
  expect(currentParams()).toMatchObject({ kind: "product", page: 1 });
  next();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Archived" }));
  expect(currentParams()).toMatchObject({ status: "archived", page: 1 });
  next();
  fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "oldest" } });
  expect(currentParams()).toMatchObject({ sortBy: "oldest", page: 1 });
  next();
  mockSite = { id: "other-site" };
  jest.mocked(useSWR).mockClear();
  rerender(<CatalogPage />);
  expect(currentParams()).toMatchObject({ siteId: "other-site", page: 1 });
  expect(jest.mocked(useSWR).mock.calls.every(([key]) => (key as CatalogListParams).page === 1)).toBe(true);
  mockSite = { id: "site" };
  rerender(<CatalogPage />);
  expect(currentParams().page).toBe(1);
});

it.each([[51, 50], [50, 49], [1501, 50]])("blocks global reorder for count=%i loaded=%i", (count, loaded) => {
  mockItems.count = count;
  mockItems.data = Array.from({ length: loaded }, (_, i) => ({ id: `item-${i}`, category_id: "category", name: "Item" }));
  render(<CatalogPage />);
  fireEvent.click(screen.getByText("Attempt drag"));
  expect(screen.getByTestId("table")).toHaveAttribute("data-drag", "false");
  expect(reorderCatalogDisplay).not.toHaveBeenCalled();
  expect(mockMutate).not.toHaveBeenCalled();
});

it("allows reorder only for the complete active unfiltered dataset and preserves cached items", async () => {
  mockItems.count = 1;
  render(<CatalogPage />);
  await act(async () => { fireEvent.click(screen.getByText("Attempt drag")); });
  expect(reorderCatalogDisplay).toHaveBeenCalledWith({
    siteId: "site", categoryIds: ["category", "uncategorized"], itemIdsByCategory: { category: [], uncategorized: ["item"] },
  });
  expect(mockItems.data[0].category_id).toBe("category");
});

it("disables reorder for archived, kind-filtered and validating data", () => {
  mockItems.count = 1;
  const { rerender } = render(<CatalogPage />);
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Archived" }));
  expect(screen.getByTestId("table")).toHaveAttribute("data-drag", "false");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Active" }));
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Products" }));
  expect(screen.getByTestId("table")).toHaveAttribute("data-drag", "false");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "All items" }));
  mockValidating = true;
  rerender(<CatalogPage />);
  expect(screen.getByTestId("table")).toHaveAttribute("data-drag", "false");
  fireEvent.click(screen.getByText("Attempt drag"));
  expect(reorderCatalogDisplay).not.toHaveBeenCalled();
});

it("blocks reorder under timestamp sorts or incomplete categories", () => {
  mockItems.count = 1;
  const { rerender } = render(<CatalogPage />);
  fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "newest" } });
  expect(screen.getByTestId("table")).toHaveAttribute("data-drag", "false");
  fireEvent.click(screen.getByText("Attempt drag"));
  expect(reorderCatalogDisplay).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "display_order" } });
  mockCategoriesComplete = false;
  rerender(<CatalogPage />);
  expect(screen.getByTestId("table")).toHaveAttribute("data-drag", "false");
});

it("opens Import on demand with the site and refreshes on success", () => {
  render(<CatalogPage />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Import" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Import for site");
  fireEvent.click(screen.getByText("Import success"));
  expect(mockMutate).toHaveBeenCalledWith();
  fireEvent.click(screen.getByText("Close import"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("returns to the last available page when archival removes the current final page", () => {
  mockItems.count = 51;
  const { rerender } = render(<CatalogPage />);
  fireEvent.click(screen.getByText("Next page"));
  expect(currentParams().page).toBe(2);
  mockItems.count = 50;
  mockItems.data = [];
  rerender(<CatalogPage />);
  expect(currentParams().page).toBe(1);
});

it("disables Import and catalog fetching without a site", () => {
  mockSite = null;
  render(<CatalogPage />);
  expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  expect(currentParams()).toBeNull();
});