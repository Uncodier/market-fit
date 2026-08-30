import { haveTagsChanged } from "@/app/content/utils"

describe("haveTagsChanged", () => {
  it("does not mutate the input arrays", () => {
    const current = ["beta", "alpha"]
    const original = ["gamma", "alpha"]

    haveTagsChanged(current, original)

    expect(current).toEqual(["beta", "alpha"])
    expect(original).toEqual(["gamma", "alpha"])
  })

  it("ignores tag order", () => {
    expect(haveTagsChanged(["b", "a"], ["a", "b"])).toBe(false)
  })

  it("detects added, removed, and empty tags", () => {
    expect(haveTagsChanged(["a", "b"], ["a"])).toBe(true)
    expect(haveTagsChanged(["a"], ["a", "b"])).toBe(true)
    expect(haveTagsChanged([], [])).toBe(false)
    expect(haveTagsChanged(null, undefined)).toBe(false)
    expect(haveTagsChanged(["a"], null)).toBe(true)
  })
})
