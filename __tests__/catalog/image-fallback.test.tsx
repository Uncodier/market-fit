import { fireEvent, render, screen } from "@testing-library/react"
import { CatalogTable } from "@/app/catalog/components/CatalogTable"
import { KanbanView } from "@/app/catalog/components/KanbanView"
import { resolveItemImage } from "@/app/lib/image-utils"
import { IMAGE_PLACEHOLDER_PATH } from "@/app/lib/prompt-image-url"
import type { CatalogCategory, CatalogItem } from "@/app/types"
import { marketplaceItem } from "../marketplace/catalog-fixture"

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: { id: "site" } }),
}))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "" }),
}))
jest.mock("@/app/catalog/actions", () => ({ updateCatalogAvailability: jest.fn() }))
jest.mock("@/app/catalog/components/EditCatalogCategoryDialog", () => ({
  EditCatalogCategoryDialog: ({ category, open }: { category: CatalogCategory | null; open: boolean }) =>
    open ? <div role="dialog">{category?.name}</div> : null,
}))

const category: CatalogCategory = {
  id: "category", site_id: "site", name: "Coffee", status: "active",
  sort_order: 0, created_at: "2026-10-12", updated_at: "2026-10-12",
}
const sourceCases = [
  ["generated", undefined],
  ["uploaded", "https://cdn.test/catalog-coffee.png"],
] as const

function catalogItem(id: string, imageUrl: string | undefined = undefined): CatalogItem {
  return {
    ...marketplaceItem(id), name: `Coffee ${id}`, category_id: category.id,
    image_url: imageUrl, currency: "USD", sku: `SKU-${id}`,
  }
}

function renderCatalog(view: "table" | "kanban", items: CatalogItem[]) {
  return render(view === "table"
    ? <CatalogTable items={items} categories={[category]} onUpdate={jest.fn()} isDragEnabled />
    : <KanbanView items={items} categories={[category]} isDragEnabled />)
}

describe.each(["table", "kanban"] as const)("Catalog %s image fallback", (view) => {
  it.each(sourceCases)("substitutes failed %s images without changing layout or item details", (_, imageUrl) => {
    const item = catalogItem("one", imageUrl)
    renderCatalog(view, [item])

    const image = screen.getByRole("img", { name: item.name })
    const frame = image.parentElement!
    const imageClass = image.className
    const frameClass = frame.className
    const editLink = screen.getByRole("link")
    const editClass = editLink.className
    expect(image).toHaveAttribute("src", resolveItemImage(item))
    expect(image).not.toHaveAttribute("src", IMAGE_PLACEHOLDER_PATH)
    expect(editLink).toHaveAttribute("href", `/catalog/${item.id}`)

    fireEvent.error(image)

    expect(image).toHaveAttribute("src", IMAGE_PLACEHOLDER_PATH)
    expect(image).toBeVisible()
    expect(image.className).toBe(imageClass)
    expect(image).toHaveClass("w-full", "h-full", "object-cover")
    expect(image.parentElement).toBe(frame)
    expect(frame.className).toBe(frameClass)
    expect(frame).toHaveClass(...(view === "table" ? ["h-9", "w-9", "rounded-md"] : ["h-32", "w-full"]))
    expect(screen.getByText(item.name)).toBeInTheDocument()
    expect(screen.getByText(item.sku!)).toBeInTheDocument()
    expect(screen.getByText("$10.00")).toBeInTheDocument()
    expect(screen.getByText(view === "table" ? "Always Available" : "Always")).toBeInTheDocument()
    expect(editLink).toHaveAttribute("href", `/catalog/${item.id}`)
    expect(editLink.className).toBe(editClass)
    if (view === "table") {
      expect(image.closest("tr")).toHaveAttribute("data-rfd-draggable-id", item.id)
      fireEvent.click(screen.getByRole("button", { name: "Edit category" }))
      expect(screen.getByRole("dialog")).toHaveTextContent(category.name)
    } else {
      expect(image.closest("[data-rfd-draggable-id]")).toHaveAttribute("data-rfd-draggable-id", item.id)
    }
  })

  it("keeps category grouping and load-more actions working after an image fails", () => {
    const items = Array.from({ length: 11 }, (_, index) => catalogItem(String(index)))
    renderCatalog(view, items)
    const image = screen.getByRole("img", { name: items[0].name })
    fireEvent.error(image)

    expect(screen.getByText(category.name)).toBeInTheDocument()
    expect(screen.getAllByRole("img")).toHaveLength(10)
    expect(screen.queryByText(items[10].name)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Load 10 more" }))
    expect(screen.getAllByRole("img")).toHaveLength(11)
    expect(screen.getByText(items[10].name)).toBeInTheDocument()
    expect(image).toHaveAttribute("src", IMAGE_PLACEHOLDER_PATH)
  })
})