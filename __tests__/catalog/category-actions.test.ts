/** @jest-environment node */
import { revalidatePath, updateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserSiteRole } from "@/lib/auth/api-site-access"
import { archiveCatalogCategory } from "@/app/catalog/category-actions"
import { findOrCreateCatalogCategory, listCatalogCategories } from "@/app/catalog/actions"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn(), updateTag: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/auth/api-site-access", () => ({
  getCurrentUserSiteRole: jest.fn(),
  isSiteManagerRole: (role: string) => role === "owner" || role === "admin",
}))
jest.mock("@/app/commerce/pdp-actions", () => ({ pdpCacheTag: (id: string) => `pdp:${id}` }))
jest.mock("@/app/marketplace/load-marketplace-home", () => ({ MARKETPLACE_CACHE_TAG: "marketplace-home" }))
jest.mock("@/app/catalog/relation-summaries", () => ({ attachCatalogRelationSummaries: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const categoryId = "22222222-2222-4222-8222-222222222222"
const itemId = "33333333-3333-4333-8333-333333333333"
const variantId = "44444444-4444-4444-8444-444444444444"
const getUser = jest.fn()
const rpc = jest.fn()
const from = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null })
  rpc.mockResolvedValue({ data: { item_ids: [itemId, variantId] }, error: null })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc, from })
  jest.mocked(getCurrentUserSiteRole).mockResolvedValue("owner")
})

describe("archiveCatalogCategory", () => {
  it.each([["bad", categoryId], [siteId, "bad"], ["", categoryId]])("rejects malformed identifiers", async (site, category) => {
    expect(await archiveCatalogCategory(site, category)).toEqual({ error: "Invalid site or category ID" })
    expect(createClient).not.toHaveBeenCalled()
  })

  it("requires a verified user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await archiveCatalogCategory(siteId, categoryId)).toEqual({ error: "Unauthorized" })
    expect(rpc).not.toHaveBeenCalled()
    expect(getCurrentUserSiteRole).not.toHaveBeenCalled()
  })

  it("rejects failed authentication even with user data", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: { message: "expired" } })
    expect(await archiveCatalogCategory(siteId, categoryId)).toEqual({ error: "Unauthorized" })
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([null, "marketing", "collaborator"])("denies role %s", async (role) => {
    jest.mocked(getCurrentUserSiteRole).mockResolvedValue(role)
    expect(await archiveCatalogCategory(siteId, categoryId)).toEqual({ error: "Forbidden" })
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each(["owner", "admin"])("archives atomically as %s and expires affected caches", async (role) => {
    jest.mocked(getCurrentUserSiteRole).mockResolvedValue(role)
    expect(await archiveCatalogCategory(siteId, categoryId)).toEqual({ success: true })
    expect(createClient).toHaveBeenCalledWith(true)
    expect(getCurrentUserSiteRole).toHaveBeenCalledWith(expect.anything(), siteId)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith("archive_catalog_category", { p_site_id: siteId, p_category_id: categoryId })
    expect(from).not.toHaveBeenCalled()
    expect(updateTag).toHaveBeenCalledWith(`shop:${siteId}`)
    expect(updateTag).toHaveBeenCalledWith("marketplace-home")
    expect(updateTag).toHaveBeenCalledWith(`pdp:${itemId}`)
    expect(updateTag).toHaveBeenCalledWith(`pdp:${variantId}`)
    expect(revalidatePath).toHaveBeenCalledWith("/catalog", "layout")
    expect(revalidatePath).toHaveBeenCalledWith("/pos")
  })

  it.each([
    ["42501", "Forbidden"],
    ["P0002", "Category not found"],
    ["55P03", "The catalog is being updated. Please try again."],
    ["XX000", "Failed to archive category"],
  ])("handles RPC failure %s without exposing database details", async (code, error) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "private database details" } })
    expect(await archiveCatalogCategory(siteId, categoryId)).toEqual({ error })
    expect(updateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("supports empty categories and idempotent retries", async () => {
    rpc.mockResolvedValue({ data: { item_ids: [] }, error: null })
    expect(await archiveCatalogCategory(siteId, categoryId)).toEqual({ success: true })
    expect(await archiveCatalogCategory(siteId, categoryId)).toEqual({ success: true })
  })

  it.each([null, {}, { item_ids: ["invalid"] }])("does not claim success for an invalid response", async (data) => {
    rpc.mockResolvedValue({ data, error: null })
    expect(await archiveCatalogCategory(siteId, categoryId)).toHaveProperty("error", expect.stringContaining("Unable to confirm"))
    expect(updateTag).not.toHaveBeenCalled()
  })

  it("handles a lost response without exposing internal details", async () => {
    rpc.mockRejectedValue(new Error("private transport error"))
    expect(await archiveCatalogCategory(siteId, categoryId)).toHaveProperty("error", expect.stringContaining("Unable to confirm"))
  })
})

describe("category lifecycle reads", () => {
  it("excludes archived categories from default pickers but supports history", async () => {
    const active = { id: "active", status: "active" }
    const archived = { id: "archived", status: "archived" }
    const legacy = { id: "legacy" }
    const query = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => void) => resolve({ data: [active, archived, legacy], error: null }),
    }
    from.mockReturnValue(query)
    expect(await listCatalogCategories(siteId)).toEqual({ data: [active, legacy] })
    expect(await listCatalogCategories(siteId, "archived")).toEqual({ data: [archived] })
    expect(await listCatalogCategories(siteId, "all")).toEqual({ data: [active, archived, legacy] })
    expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
  })

  it("does not silently reuse an archived category by name", async () => {
    const query = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: categoryId, status: "archived" }, error: null }),
      insert: jest.fn(),
    }
    from.mockReturnValue(query)
    expect(await findOrCreateCatalogCategory(siteId, "Archived category")).toEqual({
      category: null, error: "This category is archived. Choose an active category or a different name.",
    })
    expect(query.insert).not.toHaveBeenCalled()
  })
})