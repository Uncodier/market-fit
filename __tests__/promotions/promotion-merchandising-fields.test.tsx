import { useState } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { PromotionDetailMerchandisingFields, PromotionMerchandisingFields, type PromotionMerchandisingValue } from "@/app/promotions/components/PromotionMerchandisingFields"
import { generatePromotionImage } from "@/app/promotions/generate-promotion-image"
import type { PromotionWithCampaign } from "@/app/promotions/types"

jest.mock("@/app/promotions/generate-promotion-image", () => ({ generatePromotionImage: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() } }))
jest.mock("@/app/components/ui/image-upload", () => ({
  ImageUpload: ({ value, onRemove }: { value: string; onRemove: () => void }) => (
    <div><output data-testid="image-preview-url">{value}</output><button onClick={onRemove}>Remove image</button></div>
  ),
}))

const siteId = "00000000-0000-4000-8000-000000000001"
const imageUrl = "https://unit-project.supabase.co/storage/v1/object/public/generative_images/prompt_cache/confirmed"
const baseProps = { siteId, name: "Summer offer", discount_type: "percent", discount_value: 20, siteName: "Store" }
const onChange = jest.fn()

function Form({ initial = {}, props = {} }: {
  initial?: PromotionMerchandisingValue
  props?: Partial<Omit<typeof baseProps, "siteId">> & { siteId?: string | null }
}) {
  const [value, setValue] = useState<PromotionMerchandisingValue>({ show_on_shop: false, show_on_marketplace: false, ...initial })
  return <PromotionMerchandisingFields {...baseProps} {...props} value={value} onChange={patch => {
    onChange(patch)
    setValue(current => ({ ...current, ...patch }))
  }} />
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(generatePromotionImage).mockReset().mockResolvedValue({ imageUrl })
})

it("updates the editable image with one patch before reporting button generation success", async () => {
  render(<Form initial={{ show_on_shop: true }} />)
  fireEvent.click(screen.getByRole("button", { name: "Generate with AI" }))
  await waitFor(() => expect(screen.getByTestId("image-preview-url")).toHaveTextContent(imageUrl))
  expect(generatePromotionImage).toHaveBeenCalledWith(baseProps)
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith({ image_url: imageUrl })
  expect(onChange.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(toast.success).mock.invocationCallOrder[0])
  expect(screen.getByRole("switch", { name: "Show on Shop" })).toHaveAttribute("aria-checked", "true")
  expect(screen.getByRole("switch", { name: "Show on Marketplace" })).toHaveAttribute("aria-checked", "false")
})

it("explicit generation replaces an existing image instead of short-circuiting", async () => {
  render(<Form initial={{ image_url: "https://store.test/old.png", show_on_marketplace: true }} />)
  fireEvent.click(screen.getByRole("button", { name: "Generate with AI" }))
  await waitFor(() => expect(onChange).toHaveBeenCalledWith({ image_url: imageUrl }))
  expect(generatePromotionImage).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId("image-preview-url")).toHaveTextContent(imageUrl)
  expect(screen.getByRole("switch", { name: "Show on Marketplace" })).toHaveAttribute("aria-checked", "true")
})

it.each([
  ["Show on Shop", "show_on_shop"], ["Show on Marketplace", "show_on_marketplace"],
])("enabling %s without an image applies visibility and image atomically", async (label, key) => {
  render(<Form />)
  fireEvent.click(screen.getByRole("switch", { name: label }))
  await waitFor(() => expect(onChange).toHaveBeenCalledWith({ image_url: imageUrl, [key]: true }))
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId("image-preview-url")).toHaveTextContent(imageUrl)
  expect(screen.getByRole("switch", { name: label })).toHaveAttribute("aria-checked", "true")
  expect(toast.success).not.toHaveBeenCalled()
})

it("visibility changes reuse existing images and disabling never generates", () => {
  render(<Form initial={{ image_url: imageUrl, show_on_marketplace: true }} />)
  fireEvent.click(screen.getByRole("switch", { name: "Show on Shop" }))
  fireEvent.click(screen.getByRole("switch", { name: "Show on Marketplace" }))
  expect(onChange.mock.calls).toEqual([[{ show_on_shop: true }], [{ show_on_marketplace: false }]])
  expect(generatePromotionImage).not.toHaveBeenCalled()
})

it.each(["resolved error", "rejected action"])("failed button generation preserves the image, resets loading and never reports success (%s)", async kind => {
  if (kind === "resolved error") jest.mocked(generatePromotionImage).mockResolvedValueOnce({ error: "Generation unavailable." })
  else jest.mocked(generatePromotionImage).mockRejectedValueOnce(new Error("private action failure"))
  render(<Form initial={{ image_url: "https://store.test/old.png" }} />)
  const button = screen.getByRole("button", { name: "Generate with AI" })
  fireEvent.click(button)
  await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
  expect(button).not.toBeDisabled()
  expect(screen.getByTestId("image-preview-url")).toHaveTextContent("https://store.test/old.png")
  expect(onChange).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  // A user-driven retry is available after failure.
  fireEvent.click(button)
  await waitFor(() => expect(onChange).toHaveBeenCalledWith({ image_url: imageUrl }))
})

it("failed toggle generation does not enable placement or update the image", async () => {
  jest.mocked(generatePromotionImage).mockRejectedValueOnce(new Error("private action failure"))
  render(<Form />)
  const toggle = screen.getByRole("switch", { name: "Show on Shop" })
  fireEvent.click(toggle)
  await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
  expect(onChange).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  expect(toggle).toHaveAttribute("aria-checked", "false")
  expect(toggle).not.toBeDisabled()
  expect(screen.getByTestId("image-preview-url")).toBeEmptyDOMElement()
})

it("disables generation and placement while a generation request is pending", async () => {
  let finish!: (result: { imageUrl: string }) => void
  jest.mocked(generatePromotionImage).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  render(<Form />)
  const button = screen.getByRole("button", { name: "Generate with AI" })
  fireEvent.click(button)
  expect(button).toBeDisabled()
  for (const toggle of screen.getAllByRole("switch")) expect(toggle).toBeDisabled()
  expect(onChange).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  await act(async () => { finish({ imageUrl }) })
  expect(button).not.toBeDisabled()
  for (const toggle of screen.getAllByRole("switch")) expect(toggle).not.toBeDisabled()
})

it("requires a site ID for generation even when a site name is available", async () => {
  render(<Form props={{ siteId: null }} />)
  expect(screen.getByRole("button", { name: "Generate with AI" })).toBeDisabled()
  fireEvent.click(screen.getByRole("switch", { name: "Show on Shop" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Select a site to generate promotion images."))
  expect(generatePromotionImage).not.toHaveBeenCalled()
  expect(onChange).not.toHaveBeenCalled()
})

it("removing an image still clears both visibility flags with one patch", () => {
  render(<Form initial={{ image_url: imageUrl, show_on_shop: true, show_on_marketplace: true }} />)
  fireEvent.click(screen.getByRole("button", { name: "Remove image" }))
  expect(onChange).toHaveBeenCalledWith({ image_url: null, show_on_shop: false, show_on_marketplace: false })
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(generatePromotionImage).not.toHaveBeenCalled()
})

it("detail callers authorize the record site rather than a different currently selected site", async () => {
  const promo = {
    id: "promotion-id", site_id: siteId, name: "Summer offer", discount_type: "percent", discount_value: 20,
    image_url: null, show_on_shop: false, show_on_marketplace: false,
  } as PromotionWithCampaign
  const setPromo = jest.fn()
  render(<PromotionDetailMerchandisingFields promo={promo} setPromo={setPromo} site={{ id: "another-site", name: "Unrelated brand" }} />)
  fireEvent.click(screen.getByRole("button", { name: "Generate with AI" }))
  await waitFor(() => expect(setPromo).toHaveBeenCalledTimes(1))
  expect(generatePromotionImage).toHaveBeenCalledWith({
    siteId, name: "Summer offer", discount_type: "percent", discount_value: 20,
    bogo_buy_qty: undefined, bogo_get_qty: undefined, siteName: null,
  })
  const update = setPromo.mock.calls[0][0] as (current: PromotionWithCampaign | null) => PromotionWithCampaign | null
  expect(update({ ...promo, name: "Concurrent edit", show_on_marketplace: true })).toEqual({
    ...promo, name: "Concurrent edit", show_on_marketplace: true, image_url: imageUrl,
  })
  expect(update(null)).toBeNull()
})

it("detail callers pass branding only from the matching record site", async () => {
  const promo = { ...baseProps, site_id: siteId, image_url: null } as unknown as PromotionWithCampaign
  render(<PromotionDetailMerchandisingFields promo={promo} setPromo={jest.fn()} site={{ id: siteId, name: "Matching brand" }} />)
  fireEvent.click(screen.getByRole("button", { name: "Generate with AI" }))
  await waitFor(() => expect(generatePromotionImage).toHaveBeenCalledTimes(1))
  expect(generatePromotionImage).toHaveBeenCalledWith(expect.objectContaining({ siteId, siteName: "Matching brand" }))
})