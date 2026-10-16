import type { ComponentProps } from "react"
import { render, screen, within } from "@testing-library/react"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import { ShopCatalogSections } from "@/app/shop/[siteSlug]/ShopCatalogSections"
import {
  buildShopCategorySections,
  categoryDomId,
} from "@/app/shop/[siteSlug]/shop-catalog-shared"
import { shopItem } from "./catalog-fixture"

jest.mock("@/app/components/commerce/PromoListingCard", () => ({
  PromoListingCard: () => null,
}))

type SectionsProps = ComponentProps<typeof ShopCatalogSections>

const offsets = [
  { name: "Coffee", offset: 0, count: 3 },
  { name: "Tea", offset: 3, count: 2 },
  { name: "Other", offset: 5, count: 1 },
]
const allItems = [
  shopItem("coffee-1", "Coffee"),
  shopItem("coffee-2", "Coffee"),
  shopItem("coffee-3", "Coffee"),
  shopItem("tea-1", "Tea"),
  shopItem("tea-2", "Tea"),
  shopItem("other-1", "Other"),
]

function renderCard(item: (typeof allItems)[number]) {
  return <article key={item.id} data-testid={`card-${item.id}`}>{item.name}</article>
}

function sectionElement(name: string) {
  const element = document.getElementById(categoryDomId(name))
  expect(element).toBeInTheDocument()
  return element!
}

function sectionGrid(section: HTMLElement) {
  const grid = section.querySelector<HTMLDivElement>("[data-shop-category-grid] > .grid")
  expect(grid).toBeInTheDocument()
  return grid!
}

function ui(props: SectionsProps) {
  return (
    <LocalizationProvider preferredLocale="en">
      <ShopCatalogSections {...props} />
    </LocalizationProvider>
  )
}

const baseProps: Omit<SectionsProps, "sections"> = {
  catalogCount: 16,
  siteSlug: "example",
  categoryPromosByName: {},
  renderCard,
  renderFeaturedRail: (items) => <div data-testid="featured-rail">{items.map(renderCard)}</div>,
}

describe("ShopCatalogSections", () => {
  it("mounts every server category in order with exactly the unloaded card slots", () => {
    const loaded = [allItems[3]]
    const { container } = render(ui({
      ...baseProps,
      sections: buildShopCategorySections(loaded, offsets),
    }))

    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent))
      .toEqual(["Coffee", "Tea", "Other"])
    expect(Array.from(container.querySelectorAll("section")).map((section) => section.id))
      .toEqual(offsets.map(({ name }) => categoryDomId(name)))

    for (const [name, pending, slots] of [["Coffee", 3, 3], ["Tea", 1, 2], ["Other", 1, 1]] as const) {
      const section = sectionElement(name)
      expect(section).toHaveAttribute("data-shop-category", name)
      expect(section).toHaveAttribute("data-shop-pending-count", String(pending))
      expect(section).toHaveAttribute("aria-busy", "true")
      expect(section.querySelector("[data-shop-pending-space]")).toHaveAttribute("data-shop-pending-space", String(pending))
      expect(sectionGrid(section).querySelectorAll("article").length + pending).toBe(slots)
      expect(sectionGrid(section)).toHaveClass("grid-cols-2", "xl:grid-cols-4")
    }

    expect(container.querySelectorAll("[data-shop-placeholder]")).toHaveLength(0)
    expect(container.querySelectorAll("[data-shop-pending-space]")).toHaveLength(3)
    expect(screen.getByTestId("card-tea-1")).toBeInTheDocument()
    expect(screen.queryByTestId("featured-rail")).not.toBeInTheDocument()
  })

  it.each([6, 16])(
    "preserves section, heading, grid identity and slot counts as a %i-item catalog fills",
    (catalogCount) => {
      const props = { ...baseProps, catalogCount }
      const { rerender, container } = render(ui({
        ...props,
        sections: buildShopCategorySections([allItems[3]], offsets),
      }))
      const originalTeaCard = screen.getByTestId("card-tea-1")
      const originalNodes = offsets.map(({ name, count }) => {
        const section = sectionElement(name)
        return {
          name,
          count,
          section,
          heading: within(section).getByRole("heading", { level: 2, name }),
          grid: sectionGrid(section),
        }
      })

      for (const loaded of [[allItems[0], allItems[3]], allItems]) {
        rerender(ui({ ...props, sections: buildShopCategorySections(loaded, offsets) }))

        for (const { name, count, section, heading, grid } of originalNodes) {
          const loadedCount = loaded.filter((item) => item._shop?.categoryName === name).length
          const pending = count - loadedCount
          expect(sectionElement(name)).toBe(section)
          expect(within(section).getByRole("heading", { level: 2, name })).toBe(heading)
          expect(sectionGrid(section)).toBe(grid)
          expect(grid.querySelectorAll("article").length + pending).toBe(count)
          expect(section.querySelectorAll("[data-shop-placeholder]")).toHaveLength(0)
          if (pending) expect(section.querySelector("[data-shop-pending-space]")).toHaveAttribute("data-shop-pending-space", String(pending))
          else expect(section.querySelector("[data-shop-pending-space]")).toBeNull()
          expect(section).toHaveAttribute("data-shop-pending-count", String(pending))
          expect(section).toHaveAttribute("aria-busy", String(pending > 0))
          expect(within(section).queryAllByRole("article")).toHaveLength(loadedCount)
        }
        expect(screen.getByTestId("card-tea-1")).toBe(originalTeaCard)
      }

      expect(container.querySelectorAll("[data-shop-placeholder]")).toHaveLength(0)
      expect(screen.getAllByRole("article")).toHaveLength(6)
      expect(originalNodes[0].grid).toHaveClass(catalogCount > 10 ? "grid-cols-2" : "grid-cols-1")
    }
  )

  it.each([
    { catalogCount: 1, loadedCount: 0, pendingCount: 1, posterCount: 1, aspect: "aspect-[5/4]" },
    { catalogCount: 2, loadedCount: 0, pendingCount: 2, posterCount: 2, aspect: "aspect-[4/5]" },
    { catalogCount: 2, loadedCount: 1, pendingCount: 1, posterCount: 2, aspect: "aspect-[4/5]" },
  ])("uses $posterCount correctly sized featured skeletons for $loadedCount loaded + $pendingCount pending items", ({
    catalogCount, loadedCount, pendingCount, posterCount, aspect,
  }) => {
    const items = allItems.slice(0, catalogCount)
    const renderFeaturedRail = jest.fn(baseProps.renderFeaturedRail)
    const renderListing = jest.fn(renderCard)
    const props = { ...baseProps, catalogCount, renderCard: renderListing, renderFeaturedRail }
    const { rerender } = render(ui({
      ...props,
      sections: [{ name: "Coffee", items: items.slice(0, loadedCount), pendingCount }],
    }))
    const section = sectionElement("Coffee")
    const heading = within(section).getByRole("heading", { name: "Coffee" })
    const posters = section.querySelectorAll('[class*="relative w-full overflow-hidden rounded-2xl border"]')

    expect(posters).toHaveLength(posterCount)
    for (const poster of posters) {
      expect(poster).toHaveClass(aspect)
      expect(poster.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0)
    }
    expect(section).toHaveAttribute("data-shop-pending-count", String(pendingCount))
    expect(section).toHaveAttribute("aria-busy", "true")
    expect(section.querySelector("[data-shop-placeholder]")).toBeNull()
    expect(renderListing).not.toHaveBeenCalled()
    expect(renderFeaturedRail).not.toHaveBeenCalled()

    rerender(ui({ ...props, sections: [{ name: "Coffee", items, pendingCount: 0 }] }))

    expect(sectionElement("Coffee")).toBe(section)
    expect(within(section).getByRole("heading", { name: "Coffee" })).toBe(heading)
    expect(section).toHaveAttribute("aria-busy", "false")
    expect(renderFeaturedRail).toHaveBeenCalledWith(items)
    expect(within(section).getAllByRole("article")).toHaveLength(posterCount)
    expect(section.querySelector(".animate-pulse")).toBeNull()
  })

  it("does not treat fulfillment-hidden loaded items as pending placeholders", () => {
    const visible = [allItems[0]]
    const rawLoaded = [allItems[0], allItems[1], allItems[3], allItems[4], allItems[5]]
    const { container, rerender } = render(ui({
      ...baseProps,
      sections: buildShopCategorySections(visible, offsets, rawLoaded),
    }))
    const coffee = sectionElement("Coffee")

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1)
    expect(coffee).toHaveAttribute("data-shop-pending-count", "1")
    expect(coffee.querySelector("[data-shop-pending-space]")).toHaveAttribute("data-shop-pending-space", "1")
    expect(sectionGrid(coffee).querySelectorAll("article")).toHaveLength(1)
    expect(container.querySelector(`#${categoryDomId("Tea")}`)).toBeNull()
    expect(container.querySelector(`#${categoryDomId("Other")}`)).toBeNull()
    expect(screen.queryByTestId("card-coffee-2")).not.toBeInTheDocument()

    // The last missing item is loaded but also hidden by fulfillment.
    rerender(ui({ ...baseProps, sections: buildShopCategorySections(visible, offsets, allItems) }))
    expect(sectionElement("Coffee")).toBe(coffee)
    expect(coffee).toHaveAttribute("data-shop-pending-count", "0")
    expect(coffee).toHaveAttribute("aria-busy", "false")
    expect(container.querySelectorAll("[data-shop-placeholder]")).toHaveLength(0)
    expect(screen.getAllByRole("article")).toHaveLength(1)
  })
})