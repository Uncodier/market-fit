/** @jest-environment node */

import sharp from "sharp"
import { renderCommerceIcon, renderCommerceOgImage } from "@/app/lib/commerce-og"

jest.mock("next/og", () => {
  // Keep the real ImageResponse/PNG renderer, but let Node load Next's dynamic
  // imports outside Jest's CommonJS VM (which lacks experimental VM modules).
  const nativeRequire = process.getBuiltinModule("module").createRequire(__filename)
  return nativeRequire("next/og")
})

const pngSignature = Buffer.from("89504e470d0a1a0a", "hex")

async function webpImage(): Promise<Buffer> {
  return sharp({
    create: { width: 80, height: 60, channels: 3, background: "#f37642" },
  }).webp().toBuffer()
}

async function expectPng(response: Response, size: { width: number; height: number }) {
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("image/png")
  const bytes = Buffer.from(await response.arrayBuffer())
  expect(bytes.subarray(0, 8)).toEqual(pngSignature)
  expect(await sharp(bytes).metadata()).toMatchObject({ format: "png", ...size })
}

describe("commerce image rendering", () => {
  it("renders a WebP data URL as an Open Graph PNG", async () => {
    const webp = await webpImage()
    const response = await renderCommerceOgImage({
      source: { kind: "data", dataUrl: `data:image/webp;base64,${webp.toString("base64")}` },
      title: "Product",
      subtitle: "Product description",
      eyebrow: "Shop",
    })

    await expectPng(response, { width: 1200, height: 630 })
  })

  it("renders a fetched WebP as an icon PNG", async () => {
    const webp = await webpImage()
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array(webp), { headers: { "content-type": "image/webp" } }),
    )

    try {
      const response = await renderCommerceIcon(
        { kind: "url", url: "https://cdn.example.com/product.webp" },
        { width: 64, height: 64 },
      )

      await expectPng(response, { width: 64, height: 64 })
      expect(fetchMock).toHaveBeenCalledWith(
        "https://cdn.example.com/product.webp",
        expect.objectContaining({ headers: { Accept: "image/*" } }),
      )
    } finally {
      fetchMock.mockRestore()
    }
  })

  it("falls back to a valid PNG when WebP bytes are malformed", async () => {
    const response = await renderCommerceOgImage({
      source: { kind: "data", dataUrl: "data:image/webp;base64,bm90IGFuIGltYWdl" },
      title: "Product",
    })

    await expectPng(response, { width: 1200, height: 630 })
  })
})