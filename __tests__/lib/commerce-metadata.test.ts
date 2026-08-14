import {
  resolveShopIconVisual,
  resolveShopShareVisual,
} from "../../app/lib/commerce-metadata"

const siteWithBoth = {
  name: "Pigs",
  logo_url: "https://cdn.example.com/pigs-logo.png",
  settings: {
    shop: {
      hero_title: "Come hungry",
      hero_image_url: "https://cdn.example.com/pigs-hero.jpg",
    },
  },
}

describe("resolveShopShareVisual", () => {
  it("prefers the hero image for social previews when both exist", () => {
    const visual = resolveShopShareVisual(siteWithBoth)
    expect(visual.source).toEqual({
      kind: "url",
      url: "https://cdn.example.com/pigs-hero.jpg",
    })
    expect(visual.fit).toBe("cover")
  })

  it("falls back to the site logo when there is no hero", () => {
    const visual = resolveShopShareVisual({
      name: "Pigs",
      logo_url: "https://cdn.example.com/pigs-logo.png",
    })
    expect(visual.source).toEqual({
      kind: "url",
      url: "https://cdn.example.com/pigs-logo.png",
    })
    expect(visual.fit).toBe("contain")
  })
})

describe("resolveShopIconVisual", () => {
  it("uses the site logo for the tab icon even when a hero exists", () => {
    const visual = resolveShopIconVisual(siteWithBoth)
    expect(visual.source).toEqual({
      kind: "url",
      url: "https://cdn.example.com/pigs-logo.png",
    })
    expect(visual.fit).toBe("contain")
  })

  it("does not use the hero as the tab icon when there is no logo", () => {
    const visual = resolveShopIconVisual({
      name: "Pigs",
      settings: {
        shop: { hero_image_url: "https://cdn.example.com/pigs-hero.jpg" },
      },
    })
    expect(visual.source.kind).toBe("url")
    if (visual.source.kind !== "url") return
    expect(visual.source.url).not.toContain("pigs-hero.jpg")
  })
})
