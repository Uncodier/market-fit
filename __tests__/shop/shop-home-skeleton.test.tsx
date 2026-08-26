import { render } from "@testing-library/react"
import { ShopHomeSkeleton } from "@/app/shop/[siteSlug]/ShopHomeSkeleton"
import { resolveShopHomeSkeletonLayout } from "@/app/shop/[siteSlug]/shop-home-skeleton-layout"

const clementeLike = {
  name: "Clemente",
  logo_url: "https://example.com/logo.jpg",
  settings: {
    shop: {
      hero_title: "Barberia y bar",
      hero_subtitle: "El mejor espacio",
      hero_image_url: "https://example.com/hero.jpg",
      hero_cta_label: "Reserva",
      hero_order_bar: null,
      trust_badges: [],
    },
  },
}

describe("resolveShopHomeSkeletonLayout", () => {
  it("matches a hero shop without order bar, badges, or a trending header", () => {
    const layout = resolveShopHomeSkeletonLayout(clementeLike, true)
    expect(layout.showHero).toBe(true)
    expect(layout.showOrderBar).toBe(false)
    expect(layout.showBadges).toBe(false)
    expect(layout.hasCategories).toBe(true)
    expect(layout.hasLogo).toBe(true)
    expect(layout.heroCtaLabel).toBe("Reserva")
  })

  it("hides the hero when the shop has no cover content", () => {
    const layout = resolveShopHomeSkeletonLayout({
      name: "Plain",
      settings: { shop: { trust_badges: [], hero_order_bar: false } },
    })
    expect(layout.showHero).toBe(false)
    expect(layout.showOrderBar).toBe(false)
    expect(layout.showBadges).toBe(false)
  })

  it("shows the order bar and trust strip only when those settings are on", () => {
    const layout = resolveShopHomeSkeletonLayout({
      name: "Full",
      settings: {
        shop: {
          hero_title: "Hello",
          hero_order_bar: true,
          trust_badges: [{ title: "A" }, { title: "B" }],
        },
      },
    })
    expect(layout.showHero).toBe(true)
    expect(layout.showOrderBar).toBe(true)
    expect(layout.showBadges).toBe(true)
    expect(layout.badgeCount).toBe(2)
  })

  it("defaults unknown shops to hero + categories without optional chrome", () => {
    const layout = resolveShopHomeSkeletonLayout()
    expect(layout.showHero).toBe(true)
    expect(layout.showOrderBar).toBe(false)
    expect(layout.showBadges).toBe(false)
    expect(layout.hasCategories).toBe(true)
  })
})

describe("ShopHomeSkeleton", () => {
  it("does not paint fulfillment or trust chrome for a Clemente-like shop", () => {
    const { getByTestId, queryByTestId } = render(
      <ShopHomeSkeleton site={clementeLike} hasCategories />
    )
    expect(getByTestId("shop-skeleton-hero")).toBeTruthy()
    expect(queryByTestId("shop-skeleton-fulfillment")).toBeNull()
    expect(queryByTestId("shop-skeleton-trust")).toBeNull()
    expect(getByTestId("shop-skeleton-categories")).toBeTruthy()
    expect(getByTestId("shop-skeleton-section-heading")).toBeTruthy()
    expect(queryByTestId("shop-skeleton-trending")).toBeNull()
  })

  it("centers a 40% search field like ShopHeader on desktop", () => {
    const { container } = render(<ShopHomeSkeleton site={clementeLike} />)
    const searchWrap = container.querySelector('[class*="w-2/5"]')
    expect(searchWrap).toBeTruthy()
    expect(searchWrap?.className).toContain("-translate-x-1/2")
  })

  it("uses a trending heading instead of chips when there are no categories", () => {
    const { getByTestId, queryByTestId } = render(
      <ShopHomeSkeleton
        site={{ name: "Small", settings: { shop: {} } }}
        hasCategories={false}
      />
    )
    expect(queryByTestId("shop-skeleton-categories")).toBeNull()
    expect(getByTestId("shop-skeleton-trending")).toBeTruthy()
    expect(queryByTestId("shop-skeleton-hero")).toBeNull()
  })
})
