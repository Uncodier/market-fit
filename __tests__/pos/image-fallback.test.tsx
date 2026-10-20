import { fireEvent, render, screen, within } from "@testing-library/react"
import { PosCatalogGrid } from "@/app/pos/components/PosCatalogGrid"
import { PosCartLines } from "@/app/pos/components/PosCartLines"
import { PosAppliedPromoCard } from "@/app/pos/components/PosAppliedPromoCard"
import { resolveItemImage, resolvePromotionImage } from "@/app/lib/image-utils"
import { IMAGE_PLACEHOLDER_PATH } from "@/app/lib/prompt-image-url"
import type { CatalogItem } from "@/app/types"
import type { PosCartItem } from "@/app/pos/cart-types"
import type { LocalPromoMatch } from "@/app/pos/local/resolve-promo-local"
import { marketplaceItem } from "../marketplace/catalog-fixture"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: "en", t: () => "" }),
}))
jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ formatPrice: (amount: number) => `$${amount.toFixed(2)}` }),
}))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))

const sourceCases = [
  ["generated", undefined],
  ["uploaded", "https://cdn.test/pos-coffee.png"],
] as const

function catalogItem(imageUrl: string | undefined = undefined): CatalogItem {
  return { ...marketplaceItem("coffee"), name: "Coffee", sku: "COFFEE-1", image_url: imageUrl }
}

function failImage(name: string, expectedSource: string) {
  const image = screen.getByRole("img", { name })
  const imageClass = image.className
  const frame = image.parentElement!
  const frameClass = frame.className
  expect(image).toHaveAttribute("src", expectedSource)
  expect(image).not.toHaveAttribute("src", IMAGE_PLACEHOLDER_PATH)

  fireEvent.error(image)

  expect(image).toHaveAttribute("src", IMAGE_PLACEHOLDER_PATH)
  expect(image).toBeVisible()
  expect(image.className).toBe(imageClass)
  expect(image).toHaveClass("w-full", "h-full", "object-cover")
  expect(image.parentElement).toBe(frame)
  expect(frame.className).toBe(frameClass)
  return image
}

describe("POS image fallback integration", () => {
  it.each(sourceCases)("keeps grid layout and mouse/keyboard additions after a %s image error", (_, imageUrl) => {
    const item = catalogItem(imageUrl)
    const onAdd = jest.fn()
    render(<PosCatalogGrid items={[item]} loading={false} onAdd={onAdd} t={() => ""} />)

    const image = failImage(item.name, resolveItemImage(item, "card"))
    const card = screen.getByRole("button", { name: item.name })
    expect(image).toHaveClass("absolute", "inset-0", "z-0")
    expect(card).toHaveClass("h-40", "min-w-[180px]")
    expect(card.parentElement).toHaveClass("grid-cols-[repeat(auto-fill,minmax(180px,1fr))]", "gap-4")
    expect(card).toHaveAttribute("aria-disabled", "false")
    expect(card).toHaveAttribute("tabindex", "0")
    expect(screen.getByText("COFFEE-1")).toBeInTheDocument()
    expect(screen.getByText("$10.00")).toBeInTheDocument()
    fireEvent.click(card)
    fireEvent.keyDown(card, { key: "Enter" })
    fireEvent.keyDown(card, { key: " " })
    expect(onAdd).toHaveBeenCalledTimes(3)
    expect(onAdd).toHaveBeenCalledWith(item)
  })

  it("retains sold-out guards after the grid image fails", () => {
    const item = catalogItem(undefined)
    const onAdd = jest.fn()
    render(<PosCatalogGrid items={[item]} loading={false} onAdd={onAdd} t={() => ""}
      getAvailability={() => ({ sellable: false, status: "sold_out", backorderQty: 0 })} />)
    failImage(item.name, resolveItemImage(item, "card"))

    const card = screen.getByRole("button", { name: item.name })
    expect(screen.getByText("Sold Out")).toBeInTheDocument()
    expect(card).toHaveAttribute("aria-disabled", "true")
    expect(card).toHaveAttribute("tabindex", "-1")
    fireEvent.click(card)
    fireEvent.keyDown(card, { key: "Enter" })
    expect(onAdd).not.toHaveBeenCalled()
  })

  it.each(sourceCases)("keeps cart selection and quantity actions after a %s image error", (_, imageUrl) => {
    const item: PosCartItem = {
      ...catalogItem(imageUrl), lineKey: "coffee-line", cartQty: 2, cartPrice: 10,
      backorderQty: 1,
      modifiers: [{ groupId: "extras", catalogItemId: "milk", name: "Oat milk", cartQty: 1, cartPrice: 2 }],
    }
    const select = jest.fn()
    const updateQty = jest.fn()
    render(<PosCartLines cart={[item]} selectedCartItemId="coffee-line"
      setSelectedCartItemId={select} updateQty={updateQty} />)

    const image = failImage(item.name, resolveItemImage(item, "thumb"))
    expect(image.parentElement).toHaveClass("w-16", "aspect-square", "rounded-md", "overflow-hidden")
    expect(image.closest(".border")).toHaveClass("border-primary/50")
    expect(screen.getByText("Backorder: 1")).toBeInTheDocument()
    expect(screen.getByText("Extras")).toBeInTheDocument()
    expect(screen.getByText("Oat milk")).toBeInTheDocument()
    expect(screen.getByText("$12.00 · $24.00")).toBeInTheDocument()
    fireEvent.click(image)
    expect(select).toHaveBeenCalledWith("coffee-line")

    const [decrease, increase] = screen.getAllByRole("button")
    fireEvent.click(decrease)
    fireEvent.click(increase)
    expect(updateQty.mock.calls).toEqual([["coffee-line", -1], ["coffee-line", 1]])
    expect(select).toHaveBeenCalledTimes(1)
  })

  it.each(sourceCases)("shows the promo placeholder rather than hiding the failed %s image", (_, imageUrl) => {
    const promo: LocalPromoMatch = {
      promotionId: "promo", promotionName: "Coffee deal", code: "SAVE10", discount: 2,
      orderSubtotal: 20, byConditions: false, imageUrl,
    }
    const onClear = jest.fn()
    render(<PosAppliedPromoCard promo={promo} money={(amount) => `$${amount.toFixed(2)}`}
      onClear={onClear} label={(_, fallback) => fallback} />)

    const image = failImage(promo.promotionName, resolvePromotionImage({
      image_url: imageUrl, name: promo.promotionName,
    }, "hero"))
    expect(image).not.toHaveStyle({ opacity: "0" })
    expect(image.parentElement).toHaveClass("h-full", "aspect-square", "rounded-l-lg")
    const card = image.parentElement!.parentElement!
    expect(card).toHaveClass("h-14", "border-green-500/30")
    expect(within(card).getByText("Coffee deal")).toBeInTheDocument()
    expect(within(card).getByText("Code: SAVE10")).toBeInTheDocument()
    expect(within(card).getByText("−$2.00")).toBeInTheDocument()
    fireEvent.click(within(card).getByRole("button", { name: "Clear promo" }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})