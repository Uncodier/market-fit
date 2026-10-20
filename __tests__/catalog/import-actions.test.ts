/** @jest-environment node */
import { randomBytes } from "node:crypto"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserSiteRole } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { revalidateTag } from "next/cache"
import { importCatalogBatch, previewCatalogImportBatch } from "@/app/catalog/import-actions"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/auth/api-site-access", () => ({ getCurrentUserSiteRole: jest.fn() }))
jest.mock("@/lib/permissions/site-access", () => ({ userCanOnSite: jest.fn() }))
jest.mock("next/cache", () => ({ revalidateTag: jest.fn(), revalidatePath: jest.fn() }))
jest.mock("@/app/shop/[siteSlug]/shop-catalog-shared", () => ({ shopCacheTag: (id: string) => `shop:${id}` }))
jest.mock("@/app/commerce/pdp-actions", () => ({ pdpCacheTag: (id: string) => `pdp:${id}` }))
jest.mock("@/app/marketplace/load-marketplace-home", () => ({ MARKETPLACE_CACHE_TAG: "marketplace-home" }))

const siteId = "11111111-1111-4111-8111-111111111111"
const requestId = "22222222-2222-4222-8222-222222222222"
const itemId = "33333333-3333-4333-8333-333333333333"
const rows = [{ rowNumber: 2, item: { sku: "P-1", name: "Product", target_sale_price: 0 }, defaultCurrency: "USD" }]
const getUser = jest.fn()
const rpc = jest.fn()
const from = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc, from })
  jest.mocked(getCurrentUserSiteRole).mockResolvedValue("collaborator")
  jest.mocked(userCanOnSite).mockResolvedValue(true)
  rpc.mockResolvedValue({ data: { created: 1, updated: 0, skipped: 0, errors: [], item_ids: [itemId] }, error: null })
  jest.mocked(revalidateTag).mockImplementation(() => undefined)
})

describe("catalog batch actions", () => {
  it("rejects invalid identity, mode, privileged fields and oversized input before connecting", async () => {
    expect(await importCatalogBatch("invalid", rows, "skip", requestId)).toEqual({ error: "Invalid import batch" })
    expect(await importCatalogBatch(siteId, rows, "skip", "invalid")).toEqual({ error: "Invalid import batch" })
    expect(await importCatalogBatch(siteId, rows, "delete" as "skip", requestId)).toEqual({ error: "Invalid import batch" })
    const forgedRows = [{ ...rows[0], item: { ...rows[0].item, site_id: siteId } }]
    expect(await importCatalogBatch(siteId, forgedRows, "skip", requestId)).toEqual({ error: "Invalid import batch" })
    expect(createClient).not.toHaveBeenCalled()
  })

  it("rejects JSONB-expanded oversized rows before issuing an unretryable RPC", async () => {
    const oversized = Array.from({ length: 100 }, (_, i) => ({ rowNumber: i + 2, item: { sku: `SIZE-${i}`, name: "N", description: "d".repeat(3925) } }))
    expect(await importCatalogBatch(siteId, oversized, "skip", requestId)).toEqual({ error: "Invalid import batch" })
    expect(createClient).not.toHaveBeenCalled()
  })

  it("denies missing/expired authentication and cross-site access", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await importCatalogBatch(siteId, rows, "skip", requestId)).toEqual({ error: "Unauthorized" })
    expect(rpc).not.toHaveBeenCalled()
    getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null })
    jest.mocked(getCurrentUserSiteRole).mockResolvedValue(null)
    expect(await previewCatalogImportBatch(siteId, rows)).toEqual({ error: "Forbidden" })
    expect(from).not.toHaveBeenCalled()
  })

  it("checks insert/select permissions and update permission for opt-in updates", async () => {
    jest.mocked(userCanOnSite).mockImplementation(async (_client, _site, command) => command !== "update")
    expect(await importCatalogBatch(siteId, rows, "update", requestId)).toEqual({ error: "Forbidden" })
    expect(rpc).not.toHaveBeenCalled()
    expect((await importCatalogBatch(siteId, rows, "skip", requestId)).data?.created).toBe(1)
    jest.mocked(userCanOnSite).mockResolvedValue(false)
    expect(await importCatalogBatch(siteId, rows, "skip", requestId)).toEqual({ error: "Forbidden" })
  })

  it("delegates one bounded transaction and stable replay key, invalidating affected caches", async () => {
    expect(await importCatalogBatch(siteId, rows, "skip", requestId)).toEqual({ data: { created: 1, updated: 0, skipped: 0, errors: [] } })
    expect(rpc).toHaveBeenCalledWith("import_catalog_batch", { p_site_id: siteId, p_rows: rows, p_mode: "skip", p_request_id: requestId })
    expect(createClient).toHaveBeenCalledWith(true)
    expect(revalidateTag).toHaveBeenCalledWith(`shop:${siteId}`, "max")
    expect(revalidateTag).toHaveBeenCalledWith(`pdp:${itemId}`, "max")
    expect(from).not.toHaveBeenCalled()
  })

  it("does not turn a committed write into a failed batch if cache invalidation fails", async () => {
    jest.mocked(revalidateTag).mockImplementation(() => { throw new Error("cache unavailable") })
    expect((await importCatalogBatch(siteId, rows, "skip", requestId)).data?.created).toBe(1)
  })

  it("rejects unverifiable counters and hides provider error details", async () => {
    rpc.mockResolvedValue({ data: { created: 2, updated: 0, skipped: 0, errors: [], item_ids: [] }, error: null })
    expect((await importCatalogBatch(siteId, rows, "skip", requestId)).error).toContain("Resume")
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "private database details" } })
    expect((await importCatalogBatch(siteId, rows, "skip", requestId)).error).not.toContain("private")
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } })
    expect((await importCatalogBatch(siteId, rows, "skip", requestId)).error).toContain("migration")
  })

  it("previews supplied SKUs and delegates category matching to a read-only bounded RPC", async () => {
    const builders: Array<Record<string, jest.Mock>> = []
    from.mockImplementation(() => {
      const data = [{ sku: "P-1" }]
      const builder = { select: jest.fn(), eq: jest.fn(), filter: jest.fn() }
      builder.select.mockReturnValue(builder)
      builder.eq.mockReturnValue(builder)
      builder.filter.mockResolvedValue({ data, error: null })
      builders.push(builder)
      return builder
    })
    rpc.mockResolvedValue({ data: { missingCategories: ["Missing"], ambiguousCategories: [] }, error: null })
    const result = await previewCatalogImportBatch(siteId, [{ ...rows[0], category: "Clothing" }, { rowNumber: 3, item: { sku: "P-2", name: "Two" }, category: "Missing" }])
    expect(result.data).toEqual({ existingSkus: ["P-1"], missingCategories: ["Missing"], ambiguousCategories: [] })
    builders.forEach(builder => expect(builder.eq).toHaveBeenCalledWith("site_id", siteId))
    expect(builders[0].filter).toHaveBeenCalledWith("sku", "in", '("P-1","P-2")')
    expect(from).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith("preview_catalog_import_categories", { p_site_id: siteId, p_names: ["Clothing", "Missing"] })
  })

  it("preserves quoted/comma/backslash identifiers in real Supabase query URLs without making network requests", async () => {
    const urls: URL[] = []
    const bodies: string[] = []
    const sku = 'Desk 1", blue\\part'
    const category = 'Tools "Professional"'
    const client = createSupabaseClient("https://catalog.example.test", randomBytes(24).toString("hex"), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (input, init) => {
        const url = new URL(String(input))
        urls.push(url)
        bodies.push(String(init?.body ?? ""))
        const data = url.pathname.endsWith("catalog_items") ? [{ sku }] : { missingCategories: [], ambiguousCategories: [] }
        return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } })
      } },
    })
    jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, from: client.from.bind(client), rpc: client.rpc.bind(client) })
    const result = await previewCatalogImportBatch(siteId, [{ rowNumber: 2, item: { sku, name: "Product" }, category }])
    expect(result.data).toEqual({ existingSkus: [sku], missingCategories: [], ambiguousCategories: [] })
    expect(urls).toHaveLength(2)
    expect(urls[0].searchParams.get("sku")).toBe('in.("Desk 1\\", blue\\\\part")')
    expect(urls[0].searchParams.get("site_id")).toBe(`eq.${siteId}`)
    expect(urls[1].pathname).toBe("/rest/v1/rpc/preview_catalog_import_categories")
    expect(JSON.parse(bodies[1])).toEqual({ p_site_id: siteId, p_names: [category] })
  })

  it("distinguishes missing categories from ambiguous names and rejects an invalid preview receipt", async () => {
    const builder = { select: jest.fn(), eq: jest.fn(), filter: jest.fn().mockResolvedValue({ data: [], error: null }) }
    builder.select.mockReturnValue(builder)
    builder.eq.mockReturnValue(builder)
    from.mockReturnValue(builder)
    rpc.mockResolvedValue({ data: { missingCategories: ["New"], ambiguousCategories: ["Duplicate"] }, error: null })
    const supplied = [{ ...rows[0], category: "New" }, { rowNumber: 3, item: { sku: "P-2", name: "Two" }, category: "Duplicate" }]
    expect((await previewCatalogImportBatch(siteId, supplied)).data).toEqual({ existingSkus: [], missingCategories: ["New"], ambiguousCategories: ["Duplicate"] })
    rpc.mockResolvedValue({ data: { missingCategories: [] }, error: null })
    expect((await previewCatalogImportBatch(siteId, supplied)).error).toContain("Unable to validate")
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } })
    expect((await previewCatalogImportBatch(siteId, supplied)).error).toContain("categories migration")
  })
})