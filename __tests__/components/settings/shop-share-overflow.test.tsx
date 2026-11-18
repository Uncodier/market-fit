import { fireEvent, render, screen } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import { TextEncoder } from "node:util"
import { ShopSection } from "@/app/components/settings/ShopSection"

const siteUrl = "https://www.facebook.com/profile.php?id=100094205021272"
const handleCopyUrl = jest.fn()
const handleDownloadQR = jest.fn()

jest.mock("@/app/components/settings/use-shop-section", () => ({
  useShopSection: () => ({ siteUrl, handleCopyUrl, handleDownloadQR }),
}))
jest.mock("@/app/components/settings/ShopHeroCard", () => ({ ShopHeroCard: () => null }))
jest.mock("@/app/components/settings/ShopTrustCard", () => ({ ShopTrustCard: () => null }))
jest.mock("@/app/components/settings/ShopPayoutsCard", () => ({ ShopPayoutsCard: () => null }))
jest.mock("@/app/components/settings/ShopPaymentsCard", () => ({ ShopPaymentsCard: () => null }))
jest.mock("@/app/components/settings/ShopSelfServiceCard", () => ({ ShopSelfServiceCard: () => null }))
jest.mock("@/app/components/settings/ShopKioskShareCard", () => ({ ShopKioskShareCard: () => null }))

function TestShopSection() {
  const form = useForm()
  return <FormProvider {...form}><ShopSection active /></FormProvider>
}

beforeAll(() => {
  Object.defineProperty(globalThis, "TextEncoder", { configurable: true, value: TextEncoder })
})

it("allows long store links to shrink inside the card without shrinking sharing actions", () => {
  render(<TestShopSection />)
  const url = screen.getByText(siteUrl)
  expect(url).toHaveClass("flex-1", "min-w-0", "truncate")
  expect(url.parentElement?.parentElement).toHaveClass("flex-1", "min-w-0", "w-full")
  const copy = screen.getByRole("button", { name: "Copy Link" })
  expect(copy.parentElement).toHaveClass("shrink-0")
  expect(copy.parentElement).toContainElement(screen.getByRole("button", { name: "Open Link" }))
  fireEvent.click(copy)
  expect(handleCopyUrl).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: "Download" }))
  expect(handleDownloadQR).toHaveBeenCalledTimes(1)
})