import {
  buildItemImagePrompt,
  buildPdpGalleryEntries,
  buildPdpGalleryUrls,
  realImageUrl,
  resolveItemImage,
} from "@/app/lib/image-utils"

describe("buildItemImagePrompt", () => {
  it("includes description, category, and site description", () => {
    const prompt = buildItemImagePrompt({
      name: "Cold Brew",
      description: "Smooth nitro coffee",
      category: "Brews",
      siteDescription: "Specialty coffee bar in CDMX",
    })

    expect(prompt).toContain("Cold Brew")
    expect(prompt).toContain("Smooth nitro coffee")
    expect(prompt).toContain("category Brews")
    expect(prompt).toContain("Specialty coffee bar in CDMX")
  })

  it("includes parent name and description for variants", () => {
    const prompt = buildItemImagePrompt({
      name: "Large",
      description: "20oz cup",
      parent: { name: "Mocha", description: "Chocolate espresso drink" },
      _shop: { categoryName: "Coffee" },
      siteDescription: "Neighborhood cafe",
    })

    expect(prompt).toContain("Large")
    expect(prompt).toContain("variant of Mocha: Chocolate espresso drink")
    expect(prompt).toContain("20oz cup")
    expect(prompt).toContain("category Coffee")
    expect(prompt).toContain("Neighborhood cafe")
  })

  it("phrases parent as add-on for modifiers and includes site name", () => {
    const prompt = buildItemImagePrompt({
      name: "Almond milk",
      description: "Dairy-free alternative",
      parent: { name: "Mocha", description: "Chocolate espresso drink" },
      parentRelation: "addon",
      category: "Milk",
      site: { name: "Pigs Cafe", description: "Specialty coffee bar" },
      siteDescription: "Specialty coffee bar",
    })

    expect(prompt).toContain("Almond milk")
    expect(prompt).toContain("add-on for Mocha: Chocolate espresso drink")
    expect(prompt).toContain("sold at Pigs Cafe")
    expect(prompt).toContain("category Milk")
    expect(prompt).toContain("Specialty coffee bar")
  })

  it("reads category and site description from _shop / site", () => {
    const prompt = buildItemImagePrompt({
      name: "Latte",
      _shop: { categoryName: "Espresso", siteDescription: "From site shop" },
      site: { description: "Should prefer _shop siteDescription" },
    })

    expect(prompt).toContain("category Espresso")
    expect(prompt).toContain("From site shop")
  })
})

describe("buildPdpGalleryEntries", () => {
  it("uses AI images for variants without uploads", () => {
    const parent = {
      id: "p1",
      name: "Mocha",
      description: "Chocolate espresso",
      image_url: "https://cdn.example/mocha.jpg",
      metadata: {},
      _shop: { categoryName: "Coffee", siteDescription: "Cafe downtown" },
    }
    const entries = buildPdpGalleryEntries({
      parent,
      children: [
        { id: "c1", name: "Frappe", image_url: "https://cdn.example/frappe.jpg" },
        { id: "c2", name: "Helado", description: "Iced version", image_url: null },
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
      url: resolveItemImage({
        name: "Helado",
        description: "Iced version",
        image_url: null,
        parent: { name: "Mocha", description: "Chocolate espresso" },
        category: "Coffee",
        siteDescription: "Cafe downtown",
        _shop: parent._shop,
      }),
      catalogItemId: "c2",
    })
    expect(entries[3]).toEqual({
      url: resolveItemImage({
        name: "Caliente",
        image_url: null,
        parent: { name: "Mocha", description: "Chocolate espresso" },
        category: "Coffee",
        siteDescription: "Cafe downtown",
        _shop: parent._shop,
      }),
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
    const parent = {
      id: "p1",
      name: "Mocha",
      description: "Chocolate espresso",
      image_url: null,
      metadata: {},
      _shop: { categoryName: "Coffee", siteDescription: "Cafe downtown" },
    }
    const entries = buildPdpGalleryEntries({
      parent,
      children: [
        { id: "c1", name: "Frappe", image_url: null },
        { id: "c2", name: "Helado", image_url: null },
      ],
    })

    expect(entries).toEqual([
      {
        url: resolveItemImage({
          name: "Frappe",
          image_url: null,
          parent: { name: "Mocha", description: "Chocolate espresso" },
          category: "Coffee",
          siteDescription: "Cafe downtown",
          _shop: parent._shop,
        }),
        catalogItemId: "c1",
      },
      {
        url: resolveItemImage({
          name: "Helado",
          image_url: null,
          parent: { name: "Mocha", description: "Chocolate espresso" },
          category: "Coffee",
          siteDescription: "Cafe downtown",
          _shop: parent._shop,
        }),
        catalogItemId: "c2",
      },
    ])
  })
})

describe("buildPdpGalleryUrls", () => {
  it("includes parent upload plus AI urls for children without images", () => {
    const parent = {
      id: "p1",
      name: "Mocha",
      description: "Chocolate espresso",
      image_url: "https://cdn.example/mocha.jpg",
      metadata: {},
      _shop: { categoryName: "Coffee", siteDescription: "Cafe downtown" },
    }
    const urls = buildPdpGalleryUrls({
      parent,
      children: [
        { id: "c1", name: "A", image_url: null },
        { id: "c2", name: "B", image_url: null },
      ],
    })

    expect(urls[0]).toBe("https://cdn.example/mocha.jpg")
    expect(urls[1]).toBe(
      resolveItemImage({
        name: "A",
        image_url: null,
        parent: { name: "Mocha", description: "Chocolate espresso" },
        category: "Coffee",
        siteDescription: "Cafe downtown",
        _shop: parent._shop,
      })
    )
    expect(urls[2]).toBe(
      resolveItemImage({
        name: "B",
        image_url: null,
        parent: { name: "Mocha", description: "Chocolate espresso" },
        category: "Coffee",
        siteDescription: "Cafe downtown",
        _shop: parent._shop,
      })
    )
  })
})

describe("realImageUrl", () => {
  it("trims and rejects blanks", () => {
    expect(realImageUrl(" https://x ")).toBe("https://x")
    expect(realImageUrl("")).toBeNull()
    expect(realImageUrl(null)).toBeNull()
  })
})
