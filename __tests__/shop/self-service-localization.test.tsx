import { fireEvent, render, screen } from "@testing-library/react"
import { LocalizationProvider, useLocalization } from "@/app/context/LocalizationContext"
import { rawLocaleMessages } from "@/app/context/locale-catalog"
import { selfServiceMessages } from "@/app/context/locales/self-service"
import { selfServiceHeaderMessages } from "@/app/context/locales/self-service/header"
import { SelfServiceHeader } from "@/app/shop/[siteSlug]/self-service/SelfServiceHeader"
import { SelfServiceShopSkeleton } from "@/app/shop/[siteSlug]/self-service/SelfServiceShopSkeleton"
import { useSelfService } from "@/app/shop/[siteSlug]/self-service/SelfServiceProvider"

jest.mock("@/app/shop/[siteSlug]/self-service/SelfServiceProvider", () => ({ useSelfService: jest.fn() }))
jest.mock("@/app/shop/[siteSlug]/self-service/BuyerIdentityScan", () => ({ BuyerIdentityScan: () => null }))
jest.mock("@/app/context/DisplayCurrencyContext", () => ({ useDisplayCurrency: () => ({ formatPrice: (value: number) => `$${value}` }) }))

const locales = ["en", "es", "fr", "de", "ja"] as const
const messages = (locale: typeof locales[number]) => ({ ...selfServiceMessages[locale], ...selfServiceHeaderMessages[locale] })

it.each(locales)("registers every kiosk translation and preserves interpolation in %s", (locale) => {
  expect(Object.keys(messages(locale)).sort()).toEqual(Object.keys(messages("en")).sort())
  const parameters = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort()
  for (const [key, value] of Object.entries(messages("en"))) {
    expect(rawLocaleMessages[locale][key]).toBe(messages(locale)[key])
    expect(messages(locale)[key].trim()).not.toBe("")
    expect(parameters(messages(locale)[key])).toEqual(parameters(value))
  }
})

it("switches header, offers and loading labels without resetting the order or changing its links", () => {
  const startNewOrder = jest.fn()
  jest.mocked(useSelfService).mockReturnValue({
    context: { site: { name: "Coffee Shop" }, location: { id: "branch" } }, cart: [{ cartQty: 2 }],
    identity: { name: "Alex" }, startNewOrder, setIdentity: jest.fn(),
  } as unknown as ReturnType<typeof useSelfService>)
  function LocaleSwitch() {
    const { setLocale } = useLocalization()
    return <button onClick={() => setLocale("es")}>Español</button>
  }
  render(<LocalizationProvider preferredLocale="en">
    <LocaleSwitch />
    <SelfServiceHeader onSearchChange={jest.fn()} promos={[{ id: "offer", name: "Coffee deal", discount_type: "percent", discount_value: 10, catalog_item_ids: [], category_ids: [] }]} />
    <SelfServiceShopSkeleton />
  </LocalizationProvider>)
  expect(screen.getByRole("region", { name: "Offers" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Español" }))
  expect(screen.getByRole("region", { name: "Ofertas" })).toHaveAttribute("aria-roledescription", "carrusel")
  expect(screen.getByText("Ver oferta y elegir artículos")).toBeInTheDocument()
  expect(screen.getByRole("textbox", { name: "Buscar en el menú" })).toHaveAttribute("placeholder", "Buscar en el menú…")
  expect(screen.getByRole("button", { name: "¿No eres Alex? Quitar" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Carrito, 2 artículos" })).toHaveAttribute("href", "/shop/branch?cart=1")
  expect(screen.getByRole("status", { name: "Cargando menú" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /Coffee deal/ })).toHaveAttribute("href", "/shop/branch/promo/offer")
  expect(startNewOrder).not.toHaveBeenCalled()
})