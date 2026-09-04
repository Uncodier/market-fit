import { isEmojiIcon, getCategoryIconComponent } from "@/app/records/components/category-icon"

describe("isEmojiIcon", () => {
  it("accepts emoji characters", () => {
    expect(isEmojiIcon("📁")).toBe(true)
    expect(isEmojiIcon("🚀")).toBe(true)
  })

  it("rejects named icons and empty values", () => {
    expect(isEmojiIcon("FileText")).toBe(false)
    expect(isEmojiIcon("rocket")).toBe(false)
    expect(isEmojiIcon("life-buoy")).toBe(false)
    expect(isEmojiIcon("")).toBe(false)
    expect(isEmojiIcon(null)).toBe(false)
  })
})

describe("getCategoryIconComponent", () => {
  it("resolves project icon components", () => {
    expect(getCategoryIconComponent("Folder")).toEqual(expect.any(Function))
    expect(getCategoryIconComponent("FileText")).toEqual(expect.any(Function))
  })

  it("returns null for emojis and unknown names", () => {
    expect(getCategoryIconComponent("📁")).toBeNull()
    expect(getCategoryIconComponent("rocket")).toBeNull()
    expect(getCategoryIconComponent("")).toBeNull()
  })
})
