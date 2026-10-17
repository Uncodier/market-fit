import { fireEvent, render, screen } from "@testing-library/react"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import { localeMessages } from "@/app/context/locale-catalog"
import { MarketplaceFilters } from "@/app/marketplace/MarketplaceFilters"
import { MarketplaceSortControl } from "@/app/marketplace/MarketplaceSortControl"
import MarketplaceNotFound from "@/app/marketplace/not-found"
import { useMarketplaceTitle } from "@/app/marketplace/use-marketplace-title"
import type { ComponentProps } from "react"
import type { SupportedLocale } from "@/app/context/locale-preferences"

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ displayCurrency: "MXN" }),
}))

const onChange = jest.fn()
const props: ComponentProps<typeof MarketplaceFilters> = {
  filters: {}, onChange, isLoading: false, locationRestricted: true,
  regions: [{ country: "united states", label: "United States", count: 70 }],
  buyerLocation: {
    effectiveBuyerGeo: { country: "Mexico", city: "Celaya" }, label: "Celaya", showPill: true,
    selectedLocationId: null, sheetOpen: false, setSheetOpen: jest.fn(), locating: false,
    applyPlace: jest.fn(), applyStore: jest.fn(), useMyLocation: jest.fn(), searchPlaces: jest.fn(),
  },
}

function Controls({ locale }: { locale: SupportedLocale }) {
  return <LocalizationProvider preferredLocale={locale}>
    <MarketplaceFilters {...props} />
    <MarketplaceSortControl selectedSort="featured" setSelectedSort={onChange} />
  </LocalizationProvider>
}

function TitleProbe() {
  useMarketplaceTitle("digital_asset", "course")
  return null
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  document.cookie = "makinari-locale=; Max-Age=0; path=/"
})

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
beforeAll(() => { HTMLElement.prototype.scrollIntoView = jest.fn() })
afterAll(() => { HTMLElement.prototype.scrollIntoView = originalScrollIntoView })

it.each(["es", "fr", "de", "ja"] as const)("renders translated filters, country labels and all sort options in %s", async (locale) => {
  render(<Controls locale={locale} />)
  const messages = localeMessages[locale]
  expect(screen.getByRole("button", { name: messages["marketplace.filters.setLocation"] })).toBeInTheDocument()
  expect(screen.getByRole("checkbox", { name: messages["marketplace.filters.availableNow"] })).toBeInTheDocument()
  expect(screen.getByLabelText(messages["marketplace.filters.minPrice"])).toHaveAttribute("placeholder", messages["marketplace.filters.noMin"])
  const country = new Intl.DisplayNames([locale], { type: "region" }).of("US")!
  fireEvent.click(screen.getByRole("radio", { name: country }))
  expect(onChange).toHaveBeenCalledWith({ regionCountry: "united states", nearMe: undefined })
  fireEvent.keyDown(screen.getByTitle(messages["marketplace.sort.by"]), { key: "ArrowDown" })
  expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(
    ["featured", "best_selling", "newest", "price_asc", "price_desc"].map((sort) => messages[`marketplace.sort.${sort}`]),
  )
})

it("retranslates a visible validation error and preserves price input on language change", () => {
  const { rerender } = render(<Controls locale="en" />)
  fireEvent.change(screen.getByLabelText("Min price"), { target: { value: "50" } })
  fireEvent.change(screen.getByLabelText("Max price"), { target: { value: "10" } })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  expect(screen.getByRole("alert")).toHaveTextContent(localeMessages.en["marketplace.filters.invertedPrice"])
  rerender(<Controls locale="es" />)
  expect(screen.getByRole("alert")).toHaveTextContent(localeMessages.es["marketplace.filters.invertedPrice"])
  expect(screen.getByLabelText(localeMessages.es["marketplace.filters.minPrice"])).toHaveValue(50)
  expect(onChange).not.toHaveBeenCalled()
})

it("updates the filtered browser title when the display language changes", () => {
  const { rerender } = render(<LocalizationProvider preferredLocale="en"><TitleProbe /></LocalizationProvider>)
  expect(document.title).toBe("Courses | Marketplace")
  rerender(<LocalizationProvider preferredLocale="es"><TitleProbe /></LocalizationProvider>)
  expect(document.title).toBe(`${localeMessages.es["marketplace.subtypes.courses"]} | Marketplace`)
})

it.each(["en", "es", "fr", "de", "ja"] as const)("localizes invalid marketplace links in %s", (locale) => {
  render(<LocalizationProvider preferredLocale={locale}><MarketplaceNotFound /></LocalizationProvider>)
  expect(screen.getByRole("heading")).toHaveTextContent(localeMessages[locale]["marketplace.notFound.title"])
  expect(screen.getByRole("link", { name: localeMessages[locale]["marketplace.cart.browse"] })).toHaveAttribute("href", "/marketplace")
})