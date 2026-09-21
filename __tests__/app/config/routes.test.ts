import {
  routeProvidesOwnMainLandmark,
  shouldUseLayout,
  shouldWrapNoLayoutContentInMain,
} from "@/app/config/routes"

describe("shouldUseLayout", () => {
  it("does not wrap buyer portal screens in workspace chrome", () => {
    expect(shouldUseLayout("/buyer")).toBe(false)
    expect(shouldUseLayout("/buyer/profile")).toBe(false)
  })

  it("uses workspace chrome for the account profile on app", () => {
    expect(shouldUseLayout("/profile")).toBe(true)
  })

  it("uses workspace chrome for order lines", () => {
    expect(shouldUseLayout("/order-lines")).toBe(true)
  })

  it("does not wrap billing success in workspace chrome, but wraps other billing paths", () => {
    expect(shouldUseLayout("/billing/success")).toBe(false)
    expect(shouldUseLayout("/billing/success?credits=10")).toBe(false)
    expect(shouldUseLayout("/billing")).toBe(true)
    expect(shouldUseLayout("/billing?tab=history")).toBe(true)
  })
})

describe("no-layout main landmarks", () => {
  it.each([
    "/marketplace",
    "/marketplace/product-id",
    "/marketplace/product-id/book",
    "/marketplace/promo/promotion-id",
    "/shop/store-slug",
    "/shop/store-slug/product-id",
    "/shop/store-slug/privacy",
    "/shop/store-slug/product-id/book",
    "/shop/store-slug/promo/promotion-id",
    "/buyer/orders",
    "/book/site/user/event",
    "/cart/checkout",
  ])("does not nest a main landmark on %s", (pathname) => {
    expect(routeProvidesOwnMainLandmark(pathname)).toBe(true)
    expect(shouldWrapNoLayoutContentInMain(pathname)).toBe(false)
  })

  it.each([
    "/",
    "/auth",
    "/projects",
    "/i/public-token",
    "/checkout?credits=20",
    "/book/incomplete",
    "/cart/checkout/unknown",
    "/marketplace/item/unknown/path",
    "/shop/store-slug/unknown/path",
  ])("adds the missing main landmark on %s", (pathname) => {
    expect(routeProvidesOwnMainLandmark(pathname)).toBe(false)
    expect(shouldWrapNoLayoutContentInMain(pathname)).toBe(true)
  })

  it("leaves workspace routes to the workspace layout main", () => {
    expect(shouldWrapNoLayoutContentInMain("/content")).toBe(false)
  })
})
