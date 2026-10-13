import { fireEvent, render, screen } from "@testing-library/react"
import { CatalogTable } from "@/app/catalog/components/CatalogTable"
import type { CatalogCategory } from "@/app/types"

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