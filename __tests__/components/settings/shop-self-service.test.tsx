import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import { brandCommerceFields } from "@/app/components/settings/brand-commerce-schema"
import { type SiteFormValues } from "@/app/components/settings/form-schema"
import { ShopSelfServiceCard } from "@/app/components/settings/ShopSelfServiceCard"
import { LocationSelfServiceShare } from "@/app/components/settings/LocationSelfServiceShare"
import { selfServiceLocationUrl } from "@/app/components/settings/share-qr"

jest.mock("react-qr-code", () => ({ __esModule: true, default: ({ value }: { value: string }) => <svg data-testid="qr" data-value={value} /> }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

function Harness({ shop, save }: { shop: SiteFormValues["shop"]; save: jest.Mock }) {
  const form = useForm<SiteFormValues>({ defaultValues: { shop } })
  return <FormProvider {...form}><ShopSelfServiceCard form={form} savingCard={null} handleSave={async () => { save(form.getValues("shop")) }} /></FormProvider>
}

it("only accepts pickup and dine-in in the settings schema and preserves explicit disabled state", () => {
  expect(brandCommerceFields.shop.safeParse({ self_service_fulfillment_options: ["ship"] }).success).toBe(false)
  expect(brandCommerceFields.shop.safeParse({ self_service_fulfillment_options: ["none"] }).success).toBe(false)
  expect(brandCommerceFields.shop.parse({ self_service_fulfillment_options: [] }).self_service_fulfillment_options).toEqual([])
  expect(brandCommerceFields.shop.parse({}).self_service_fulfillment_options).toBeUndefined()
})

it("defaults from normal delivery options without changing them and saves only self-service choices", async () => {
  const save = jest.fn()
  render(<Harness shop={brandCommerceFields.shop.parse({ default_delivery_options: ["pickup", "ship"] })} save={save} />)
  expect(screen.getAllByRole("switch")).toHaveLength(2)
  expect(screen.getByRole("switch", { name: "Pickup" })).toBeChecked()
  expect(screen.getByRole("switch", { name: "Dine in" })).not.toBeChecked()
  fireEvent.click(screen.getByRole("switch", { name: "Dine in" }))
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
    default_delivery_options: ["pickup", "ship"], self_service_fulfillment_options: ["pickup", "dine_in"],
  })))
})

it("allows disabling both choices and explains the resulting unavailable self-service ordering", () => {
  render(<Harness shop={brandCommerceFields.shop.parse({ self_service_fulfillment_options: [] })} save={jest.fn()} />)
  expect(screen.getAllByRole("switch").every((element) => element.getAttribute("aria-checked") === "false")).toBe(true)
  expect(screen.getByText(/Self-service ordering is disabled/)).toBeVisible()
})

it("shares the canonical location URL rather than a tenant storefront or account link", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
  render(<LocationSelfServiceShare locationId="location-123" locationName="Main counter" />)
  const url = `${window.location.origin}/shop/location-123/`
  expect(screen.getByTestId("qr")).toHaveAttribute("data-value", url)
  expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", url)
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(url))
  expect(selfServiceLocationUrl("location-123", "https://app.makinari.com")).toBe("https://www.makinari.com/shop/location-123/")
})

it("does not generate a public link for an unsaved location", () => {
  render(<LocationSelfServiceShare locationName="New location" />)
  expect(screen.queryByTestId("qr")).not.toBeInTheDocument()
  expect(screen.getByText(/Save this location/)).toBeVisible()
})