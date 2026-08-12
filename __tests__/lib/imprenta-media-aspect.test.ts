import {
  imprentaAspectCssFromParam,
  imprentaAspectWidthOverHeight,
  imprentaMediaBoxHeight,
  imprentaNodeMediaAspectCss,
} from "@/app/lib/imprenta-media-aspect"

describe("imprentaAspectCssFromParam", () => {
  it("maps named ratios and colon syntax to CSS aspect-ratio", () => {
    expect(imprentaAspectCssFromParam("1:1")).toBe("1/1")
    expect(imprentaAspectCssFromParam("9:16")).toBe("9/16")
    expect(imprentaAspectCssFromParam("16/9")).toBe("16/9")
  })

  it("falls back when the value is missing or unknown", () => {
    expect(imprentaAspectCssFromParam(null)).toBe("1/1")
    expect(imprentaAspectCssFromParam("wide")).toBe("1/1")
    expect(imprentaAspectCssFromParam("", "16/9")).toBe("16/9")
  })
})

describe("imprentaNodeMediaAspectCss", () => {
  it("defaults images to square and videos to 16/9", () => {
    expect(imprentaNodeMediaAspectCss({ type: "generate-image" })).toBe("1/1")
    expect(imprentaNodeMediaAspectCss({ type: "generate-video" })).toBe("16/9")
  })

  it("uses the node parameter, then the parent", () => {
    expect(
      imprentaNodeMediaAspectCss({
        type: "generate-image",
        settings: { parameters: { aspectRatio: "9:16" } },
      })
    ).toBe("9/16")
    expect(
      imprentaNodeMediaAspectCss(
        { type: "generate-image" },
        { settings: { parameters: { aspectRatio: "4:3" } } }
      )
    ).toBe("4/3")
  })
})

describe("imprentaMediaBoxHeight", () => {
  it("keeps a square box equal to content width", () => {
    expect(imprentaMediaBoxHeight(440, "1/1")).toBe(440)
  })

  it("grows portrait boxes and shrinks landscape boxes", () => {
    expect(imprentaMediaBoxHeight(440, "9/16")).toBe(Math.round(440 / (9 / 16)))
    expect(imprentaMediaBoxHeight(440, "16/9")).toBe(Math.round(440 / (16 / 9)))
  })
})

describe("imprentaAspectWidthOverHeight", () => {
  it("returns 1 for invalid strings", () => {
    expect(imprentaAspectWidthOverHeight("nope")).toBe(1)
  })
})
