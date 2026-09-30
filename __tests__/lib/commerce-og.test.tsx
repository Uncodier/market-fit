/** @jest-environment node */

import sharp from "sharp"
import { renderCommerceIcon, renderCommerceOgImage } from "@/app/lib/commerce-og"

jest.mock("server-only", () => ({}))

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

  it("renders prompt fallbacks without calling a private API or the web application", async () => {
    jest.mocked(fetch).mockClear()
    const response = await renderCommerceOgImage({
      source: { kind: "url", url: "https://api.example.test/api/public/image/prompt/Coffee?width=512&height=512" },
      title: "Coffee",
    })
    await expectPng(response, { width: 1200, height: 630 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("renders an existing site-scoped public prompt cache without generation credentials", async () => {
    const original = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    try {
      jest.mocked(fetch).mockReset().mockResolvedValueOnce(new Response(new Uint8Array(await webpImage()), {
        headers: { 'content-type': 'image/webp' },
      }))
      const response = await renderCommerceOgImage({
        source: { kind: 'url', url: '/api/images/prompt?prompt=Coffee&width=400&height=400&site_id=00000000-0000-4000-8000-000000000001' },
        title: 'Coffee',
      })
      await expectPng(response, { width: 1200, height: 630 })
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(String(jest.mocked(fetch).mock.calls[0][0])).toContain('/storage/v1/object/public/generative_images/prompt_cache/')
      expect(jest.mocked(fetch).mock.calls[0][1]).toMatchObject({ headers: { Accept: 'image/*' }, credentials: 'omit', redirect: 'error' })
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
      else process.env.NEXT_PUBLIC_SUPABASE_URL = original
    }
  })
})