/** @jest-environment node */

import { createHash } from "node:crypto"
import { generatePromotionImage } from "@/app/promotions/generate-promotion-image"
import { createClient } from "@/lib/supabase/server"
import { MAX_IMAGE_BYTES } from "@/lib/images/prompt-image-cache"

jest.mock("server-only", () => ({}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))

const siteId = "00000000-0000-4000-8000-000000000001"
const otherSite = "00000000-0000-4000-8000-000000000002"
const userId = "00000000-0000-4000-8000-000000000003"
const getUser = jest.fn()
const getSession = jest.fn()
const rpc = jest.fn()
const env = { ...process.env }
const png = new Uint8Array(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1sAAAAASUVORK5CYII=", "base64",
))
const params = { siteId, name: "Summer offer", discount_type: "percent", discount_value: 20, siteName: "Store" }
const prompt = 'Promotional ecommerce banner for "Summer offer", offer 20% OFF, brand Store. Bold clean product photography style, no text overlays, square crop.'
const cacheHash = createHash("sha256").update(`v2:${siteId}:${prompt.toLowerCase()}|1024x1024`).digest("hex")
const cacheUrl = `https://unit-project.supabase.co/storage/v1/object/public/generative_images/prompt_cache/${cacheHash}`

function imageResponse() {
  return new Response(png, { headers: { "Content-Type": "image/png" } })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_SERVER_URL = "https://api.example.test"
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test"
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-project.supabase.co"
  delete process.env.NEXT_PUBLIC_API_SERVER_URL
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser, getSession }, rpc } as never)
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null })
  getSession.mockResolvedValue({ data: { session: { access_token: "verified-token", user: { id: userId } } }, error: null })
  rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "marketing" : true, error: null }))
  jest.mocked(fetch).mockReset().mockImplementation(async () => imageResponse())
})
afterAll(() => { process.env = env })

it("generates with verified site permission and token, then returns only a confirmed persistent cache URL", async () => {
  expect(await generatePromotionImage(params)).toEqual({ imageUrl: cacheUrl })
  expect(createClient).toHaveBeenCalledWith(true)
  expect(rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: siteId })
  expect(rpc).toHaveBeenCalledWith("user_can", { p_site_id: siteId, p_command: "insert" })
  expect(fetch).toHaveBeenCalledTimes(2)
  const [target, options] = jest.mocked(fetch).mock.calls[0]
  expect(String(target)).toBe(`https://api.example.test/api/public/image/prompt/${encodeURIComponent(prompt)}?site_id=${siteId}&width=1024&height=1024`)
  expect(options).toEqual({
    headers: { Authorization: "Bearer verified-token", Accept: "image/*" },
    credentials: "omit", redirect: "error", cache: "no-store", signal: expect.any(AbortSignal),
  })
  expect(String(jest.mocked(fetch).mock.calls[1][0])).toBe(cacheUrl)
  expect(jest.mocked(fetch).mock.calls[1][1]).toEqual({
    headers: { Accept: "image/*" }, credentials: "omit", redirect: "error", cache: "no-store", signal: expect.any(AbortSignal),
  })
})

it.each([null, { id: userId }])("rejects unauthenticated or unverifiable users without fetching (%j)", async user => {
  getUser.mockResolvedValueOnce({ data: { user }, error: user ? { message: "private auth detail" } : null })
  expect(await generatePromotionImage(params)).toEqual({ error: "Please sign in to generate promotion images." })
  expect(rpc).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("authorizes the supplied site ID, never the site name or a different site membership", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: null })
  expect(await generatePromotionImage({ ...params, siteId: otherSite })).toEqual({ error: "Image generation is not permitted for this site." })
  expect(rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: otherSite })
  expect(getSession).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  { data: false, error: null }, { data: null, error: null }, { data: "true", error: null },
  { data: true, error: { message: "private capability detail" } },
])("denies read-only or failed insert permission checks (%j)", async result => {
  rpc.mockResolvedValueOnce({ data: "collaborator", error: null }).mockResolvedValueOnce(result)
  expect(await generatePromotionImage(params)).toEqual({ error: "Image generation is not permitted for this site." })
  expect(getSession).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  { data: { session: null }, error: null },
  { data: { session: { access_token: "", user: { id: userId } } }, error: null },
  { data: { session: { access_token: "token", user: { id: "another-user" } } }, error: null },
  { data: { session: { access_token: "token", user: { id: userId } } }, error: { message: "private session detail" } },
])("rejects missing, mismatched or unverified forwarding sessions (%j)", async result => {
  getSession.mockResolvedValueOnce(result)
  expect(await generatePromotionImage(params)).toEqual({ error: "Please sign in again to generate promotion images." })
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  { siteId: undefined }, { siteId: "demo-site" }, { name: "" }, { name: "x".repeat(201) },
  { name: "Bad\u0000name" }, { siteName: "x".repeat(201) }, { siteName: "Bad\nbrand" },
  { discount_type: "unrecognized" }, { discount_value: Number.NaN }, { discount_value: Number.POSITIVE_INFINITY },
  { discount_value: -1 }, { discount_value: 101 }, { bogo_buy_qty: 0 }, { bogo_get_qty: 1.5 },
  { target: "https://evil.test" }, { userId: "forged-user" },
])("rejects invalid or unbounded client inputs before authentication (%j)", async patch => {
  expect(await generatePromotionImage({ ...params, ...patch } as typeof params)).toEqual({ error: "Invalid promotion image request." })
  expect(createClient).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("uses the same bounded prompt/cache dimensions for BOGO offers", async () => {
  const result = await generatePromotionImage({ ...params, discount_type: "bogo", bogo_buy_qty: 2, bogo_get_qty: 1, discount_value: 0 })
  expect(result).toHaveProperty("imageUrl")
  const target = new URL(String(jest.mocked(fetch).mock.calls[0][0]))
  expect(decodeURIComponent(target.pathname)).toContain("offer Buy 2 Get 1")
  expect(target.searchParams.get("width")).toBe("1024")
})

it.each([400, 401, 403, 409, 429, 500, 503])("does not convert provider failure %i into a successful URL or retry", async status => {
  jest.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "private provider details", url: "https://evil.test/fake.png" }, { status }))
  expect(await generatePromotionImage(params)).toEqual({ error: "Promotion image generation could not be confirmed. Please try again later." })
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([
  () => new Response("html", { headers: { "content-type": "text/html" } }),
  () => new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }),
  () => Response.json({ url: "https://evil.test/fake.png" }),
  () => new Response(null, { headers: { "content-type": "image/png" } }),
  () => new Response(png, { headers: { "content-type": "image/png", "content-length": String(MAX_IMAGE_BYTES + 1) } }),
  () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(MAX_IMAGE_BYTES + 1))
    controller.close()
  } }), { headers: { "content-type": "image/png" } }),
])("rejects non-raster, empty or oversized responses without reading cache", async response => {
  jest.mocked(fetch).mockResolvedValueOnce(response())
  expect(await generatePromotionImage(params)).toHaveProperty("error")
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("does not claim persistence when generation succeeds but the public cache is absent", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(imageResponse()).mockResolvedValueOnce(new Response(null, { status: 404 }))
  expect(await generatePromotionImage(params)).toEqual({ error: "The promotion image could not be saved. Please try again later." })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it("catches network and cache failures without exposing private details or replaying generation", async () => {
  jest.mocked(fetch).mockRejectedValueOnce(new Error("private network error"))
  expect(await generatePromotionImage(params)).toEqual({ error: "Promotion image generation is temporarily unavailable. Please try again later." })
  expect(fetch).toHaveBeenCalledTimes(1)
  jest.mocked(fetch).mockClear().mockResolvedValueOnce(imageResponse()).mockRejectedValueOnce(new Error("private storage error"))
  expect(await generatePromotionImage(params)).toEqual({ error: "The promotion image could not be saved. Please try again later." })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each(["", "https://app.example.test", "https://user:secret@api.example.test", "http://api.example.test", "https://api.example.test/untrusted"])(
  "fails closed for missing or unsafe API configuration (%s)", async url => {
    process.env.API_SERVER_URL = url
    expect(await generatePromotionImage(params)).toEqual({ error: "Image generation is not configured." })
    expect(fetch).not.toHaveBeenCalled()
  },
)

it("fails before generation when persistent public cache configuration is not trusted", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://evil.test"
  expect(await generatePromotionImage(params)).toEqual({ error: "Image generation is not configured." })
  expect(fetch).not.toHaveBeenCalled()
})