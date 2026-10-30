import { NAV_ITEM_ICON } from "@/app/config/module-visuals"
import { Boxes, Sliders } from "@/app/components/ui/icons"
import { getModuleImagePrompt, getModuleImageUrl } from "@/app/config/module-image-visuals"

describe("inventory minimums icon", () => {
  it("uses level controls instead of inventory boxes", () => {
    expect(NAV_ITEM_ICON.inventory).toBe(Boxes)
    expect(NAV_ITEM_ICON.inventoryMinimums).toBe(Sliders)
    expect(NAV_ITEM_ICON.inventoryMinimums).not.toBe(NAV_ITEM_ICON.inventory)
  })

  it("uses its own image generation prompt regardless of the translated title", () => {
    const prompt = getModuleImagePrompt("operations", "inventoryMinimums", "Inventory minimums")
    const apiUrl = process.env.NEXT_PUBLIC_API_SERVER_URL || "http://localhost:3001"
    const expected = `${apiUrl}/api/public/image/prompt/${encodeURIComponent(prompt.trim())}?width=256&height=256`
    expect(getModuleImageUrl("operations", "inventoryMinimums", "Inventory minimums")).toBe(expected)
    expect(getModuleImageUrl("operations", "inventoryMinimums", "Minimum stock")).toBe(expected)
    expect(expected).not.toBe(getModuleImageUrl("operations", "inventory", "Inventory"))
  })

  it("defines a distinct subject for image generation", () => {
    expect(getModuleImagePrompt("operations", "inventoryMinimums", "Inventory minimums"))
      .toContain("Front-facing 3D level sliders")
  })
})