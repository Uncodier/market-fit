import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { LocalizationProvider, useLocalization } from "@/app/context/LocalizationContext"
import { ProductDetailPage } from "@/app/components/commerce/pdp/ProductDetailPage"
import { PdpPageSkeleton } from "@/app/components/commerce/pdp/PdpPageSkeleton"
import type { CatalogItem } from "@/app/types"

const toggleTheme = jest.fn()
jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ theme: "dark", toggleTheme }) }))
jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({
    setStoreCurrency: jest.fn(), formatPrice: (amount: number) => `$${amount}`,
    mode: "local", rates: {}, localCurrency: "USD", displayCurrency: "USD", setMode: jest.fn(),
  }),
}))
jest.mock("@/app/components/auth/auth-provider", () => ({
  useAuthContext: () => ({ user: { id: "buyer", user_metadata: { avatar_url: "/avatar.png" } } }),
}))
jest.mock("@/app/components/commerce/use-commerce-sign-in-href", () => ({
  useCommerceSignInHref: () => ({ href: "/auth", onClick: jest.fn() }),
}))
jest.mock("@/app/components/commerce/pdp/ProductPdpLayout", () => ({ ProductPdpLayout: () => null }))
jest.mock("@/app/components/commerce/pdp/ServicePdpLayout", () => ({ ServicePdpLayout: () => null }))
jest.mock("@/app/components/commerce/pdp/CoursePdpLayout", () => ({ CoursePdpLayout: () => null }))
jest.mock("@/app/components/commerce/pdp/TicketPdpLayout", () => ({ TicketPdpLayout: () => null }))
jest.mock("@/app/components/commerce/pdp/PassPdpLayout", () => ({ PassPdpLayout: () => null }))
jest.mock("@/app/components/commerce/pdp/DigitalPdpLayout", () => ({ DigitalPdpLayout: () => null }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

function SwitchLocale() {
  const { setLocale } = useLocalization()
  return <button onClick={() => setLocale("es")}>es</button>
}

test("updates header account/avatar and both footer theme controls with the selected locale", () => {
  const item = { id: "item", name: "Product", site_id: "seller", kind: "product", metadata: {} } as CatalogItem
  render(<LocalizationProvider preferredLocale="en">
    <SwitchLocale />
    <ProductDetailPage item={item} backUrl="/marketplace" />
  </LocalizationProvider>)
  expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/buyer")
  expect(screen.getByRole("img", { name: "Avatar" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "es" }))
  expect(screen.getByRole("link", { name: "Cuenta" })).toBeInTheDocument()
  expect(screen.getByRole("img", { name: "Avatar" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Cambiar al modo claro" }))
  expect(toggleTheme).toHaveBeenCalledTimes(1)
})

test("localizes the account placeholder on the loading PDP", () => {
  render(<LocalizationProvider preferredLocale="fr"><PdpPageSkeleton /></LocalizationProvider>)
  expect(screen.getByRole("button", { name: "Compte" })).toBeDisabled()
  expect(screen.queryByRole("button", { name: "Account" })).not.toBeInTheDocument()
})