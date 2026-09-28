/** @jest-environment node */

import sharp from "sharp"
import { renderCommerceIcon, renderCommerceOgImage } from "@/app/lib/commerce-og"

const pngSignature = Buffer.from("89504e470d0a1a0a", "hex")

async function webpImage(): Promise<Buffer> {
  return sharp({
    create: { width: 80, height: 60, channels: 3, background: "#f37642" },
  }).webp().toBuffer()
}

async function expectPng(response: Response) {
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("image/png")
  expect(Buffer.from(await response.arrayBuffer()).subarray(0, 8)).toEqual(pngSignature)
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

    await expectPng(response)
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

      await expectPng(response)
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

    await expectPng(response)
  })
})