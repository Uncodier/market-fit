import { fireEvent, render, screen } from "@testing-library/react"
import { CatalogTable } from "@/app/catalog/components/CatalogTable"
import type { CatalogCategory } from "@/app/types"
import { KanbanView } from "@/app/catalog/components/KanbanView"
import { marketplaceItem } from "../marketplace/catalog-fixture"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site" } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/catalog/actions", () => ({ updateCatalogAvailability: jest.fn() }))
jest.mock("@/app/catalog/components/EditCatalogCategoryDialog", () => ({
  EditCatalogCategoryDialog: ({ category, open }: { category: CatalogCategory | null; open: boolean }) =>
    open ? <div role="dialog">{category?.name}</div> : null,
}))

const category: CatalogCategory = {
  id: "category", site_id: "site", name: "Empty category", status: "active",
  sort_order: 0, created_at: "2026-10-12", updated_at: "2026-10-12",
}

it.each(["active", "archived"] as const)("keeps an empty %s category editable", (status) => {
  render(<CatalogTable items={[]} categories={[{ ...category, status }]} onUpdate={jest.fn()} />)
  expect(screen.getByText("Empty category")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Edit category" }))
  expect(screen.getByRole("dialog")).toHaveTextContent("Empty category")
})

it("preserves the empty state when no items or categories exist", () => {
  render(<CatalogTable items={[]} categories={[]} onUpdate={jest.fn()} />)
  expect(screen.getByText("No items found")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Edit category" })).not.toBeInTheDocument()
})

it.each([CatalogTable, KanbanView])("preserves relevance across categories and variants in search", Component => {
  const ranked = [
    { ...marketplaceItem("best"), name: "Best match", parent_id: "parent" },
    { ...marketplaceItem("second"), name: "Second match", category_id: category.id },
    { ...marketplaceItem("third"), name: "Third match" },
  ]
  const { container } = render(<Component items={ranked} categories={[category]} searchQuery="query" onUpdate={jest.fn()} />)
  expect(screen.getByText("Search results · relevance")).toBeInTheDocument()
  expect(screen.queryByText("Empty category")).not.toBeInTheDocument()
  const text = container.textContent || ""
  expect(text.indexOf("Best match")).toBeLessThan(text.indexOf("Second match"))
  expect(text.indexOf("Second match")).toBeLessThan(text.indexOf("Third match"))
})