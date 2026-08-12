import {
  buildPdpGalleryEntries,
  buildPdpGalleryUrls,
  realImageUrl,
  resolveItemImage,
} from "@/app/lib/image-utils"

describe("buildPdpGalleryEntries", () => {
  it("uses AI images for variants without uploads", () => {
    const entries = buildPdpGalleryEntries({
      parent: { id: "p1", name: "Mocha", image_url: "https://cdn.example/mocha.jpg", metadata: {} },
      children: [
        { id: "c1", name: "Frappe", image_url: "https://cdn.example/frappe.jpg" },
        { id: "c2", name: "Helado", image_url: null },
        { id: "c3", name: "Caliente", image_url: "  " },
      ],
    })

    expect(entries[0]).toEqual({
      url: "https://cdn.example/mocha.jpg",
      catalogItemId: "p1",
    })
    expect(entries[1]).toEqual({
      url: "https://cdn.example/frappe.jpg",
      catalogItemId: "c1",
    })
    expect(entries[2]).toEqual({
      url: resolveItemImage({ name: "Helado", image_url: null }),
      catalogItemId: "c2",
    })
    expect(entries[3]).toEqual({
      url: resolveItemImage({ name: "Caliente", image_url: null }),
      catalogItemId: "c3",
    })
  })

  it("appends distinct metadata gallery urls", () => {
    const entries = buildPdpGalleryEntries({
      parent: {
        id: "p1",
        name: "Mocha",
        image_url: "https://cdn.example/mocha.jpg",
        metadata: { gallery: ["https://cdn.example/extra.jpg", "https://cdn.example/mocha.jpg", ""] },
      },
      children: [{ id: "c1", name: "Frappe", image_url: null }],
    })

    expect(entries.map((e) => e.url)).toContain("https://cdn.example/extra.jpg")
    expect(entries.filter((e) => e.url === "https://cdn.example/mocha.jpg")).toHaveLength(1)
  })

  it("falls back to AI for every child when nothing is uploaded", () => {
    const entries = buildPdpGalleryEntries({
      parent: { id: "p1", name: "Mocha", image_url: null, metadata: {} },
      children: [
        { id: "c1", name: "Frappe", image_url: null },
        { id: "c2", name: "Helado", image_url: null },
      ],
    })

    expect(entries).toEqual([
      {
        url: resolveItemImage({ name: "Frappe", image_url: null }),
        catalogItemId: "c1",
      },
      {
        url: resolveItemImage({ name: "Helado", image_url: null }),
        catalogItemId: "c2",
      },
    ])
  })
})

describe("buildPdpGalleryUrls", () => {
  it("includes parent upload plus AI urls for children without images", () => {
    const urls = buildPdpGalleryUrls({
      parent: { id: "p1", name: "Mocha", image_url: "https://cdn.example/mocha.jpg", metadata: {} },
      children: [
        { id: "c1", name: "A", image_url: null },
        { id: "c2", name: "B", image_url: null },
      ],
    })

    expect(urls[0]).toBe("https://cdn.example/mocha.jpg")
    expect(urls[1]).toBe(resolveItemImage({ name: "A", image_url: null }))
    expect(urls[2]).toBe(resolveItemImage({ name: "B", image_url: null }))
  })
})

describe("realImageUrl", () => {
  it("trims and rejects blanks", () => {
    expect(realImageUrl(" https://x ")).toBe("https://x")
    expect(realImageUrl("")).toBeNull()
    expect(realImageUrl(null)).toBeNull()
  })
})
