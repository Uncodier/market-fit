import { expect } from "@jest/globals"
import "@testing-library/jest-dom/jest-globals"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { SelfServicePromotion } from "@/app/shop/[siteSlug]/self-service/SelfServicePromotion"
import { selfServicePromotionItems } from "@/app/shop/[siteSlug]/self-service/self-service-promotion-requirements"
import { useSelfService } from "@/app/shop/[siteSlug]/self-service/SelfServiceProvider"
import type { PromoBundleData } from "@/app/components/commerce/PromoBundleExperience"
import { shopItem } from "./catalog-fixture"

jest.mock("@/app/shop/[siteSlug]/self-service/SelfServiceProvider", () => ({ useSelfService: jest.fn() }))
jest.mock("@/app/shop/[siteSlug]/self-service/SelfServiceHeader", () => ({ SelfServiceHeader: () => null }))
jest.mock("@/app/context/DisplayCurrencyContext", () => ({ useDisplayCurrency: () => ({ formatPrice: (price: number) => `$${price}` }) }))
jest.mock("@/app/components/commerce/PromptImage", () => ({ PromptImage: () => null }))

const promo: PromoBundleData = { id: "promo", site_id: "site", name: "Breakfast", discount_type: "percent", discount_value: 10,
  required_items: [{ catalog_item_id: "coffee", min_quantity: 3 }, { catalog_item_id: "coffee", min_quantity: 2 }],
  required_categories: [{ catalog_category_id: "drinks", min_quantity: 5, category: { id: "drinks", name: "Drinks" } }],
  category_pick_items: [{ id: "coffee", category_id: "drinks" }, { id: "tea", category_id: "drinks" }] }
const addItem = jest.fn()
const coffee = { ...shopItem("coffee", "Coffee"), category_id: "drinks" }
const tea = { ...shopItem("tea", "Tea"), category_id: "drinks" }

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useSelfService).mockReturnValue({ context: { site: { id: "site" }, location: { id: "branch" }, fulfillmentOptions: ["pickup"] },
    fulfillment: "pickup", cart: [{ ...coffee, cartQty: 1 }, { ...tea, id: "small-tea", parent_id: "tea", cartQty: 2 }], addItem, setPromotion: jest.fn(),
  } as unknown as ReturnType<typeof useSelfService>)
})

it("retains the maximum explicit item minimum even when it is also a category candidate", () => {
  expect(selfServicePromotionItems(promo)).toEqual([{ id: "coffee", minimum: 3 }, { id: "tea", minimum: 0 }])
})

it("displays aggregate category requirements without requiring every category candidate", () => {
  render(<SelfServicePromotion promo={promo} availableNow items={[
    { item: coffee, minimum: 3, configurable: false }, { item: tea, minimum: 0, configurable: false },
  ]} />)
  expect(screen.getByText("Minimum 3 · 1 in order")).toBeVisible()
  expect(screen.getByText("Category choice · 2 in order")).toBeVisible()
  expect(screen.queryByText(/Minimum 1/)).not.toBeInTheDocument()
  expect(within(screen.getByRole("region", { name: "Drinks requirement" })).getByText("Choose at least 5 total from this category · 3 in order")).toBeVisible()
  fireEvent.click(screen.getAllByRole("button", { name: "Add" })[0])
  expect(addItem).toHaveBeenCalledWith(coffee, 2)
  fireEvent.click(screen.getAllByRole("button", { name: "Add" })[1])
  expect(addItem).toHaveBeenCalledWith(tea, 1)
})

it("communicates any-mode instead of claiming all requirements must be met", () => {
  render(<SelfServicePromotion promo={{ ...promo, required_items_mode: "any" }} availableNow items={[]} />)
  expect(screen.getByText("Meet at least one of the following requirements.")).toBeVisible()
  expect(screen.queryByText("Meet all of the following requirements.")).not.toBeInTheDocument()
})