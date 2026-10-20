"use server"

import { z } from "zod"
import { revalidatePath, revalidateTag } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserSiteRole } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { shopCacheTag } from "@/app/shop/[siteSlug]/shop-catalog-shared"
import { pdpCacheTag } from "@/app/commerce/pdp-actions"
import { MARKETPLACE_CACHE_TAG } from "@/app/marketplace/load-marketplace-home"
import { catalogImportBatchSchema, type CatalogImportError, type CatalogImportMode, type CatalogImportRow } from "./import-schema"
import { catalogImportInFilter, catalogImportLookupChunks } from "./import-lookups"

const uuidSchema = z.string().uuid()
const categoryPreviewSchema = z.object({
  missingCategories: z.array(z.string()),
  ambiguousCategories: z.array(z.string()),
})
const batchResultSchema = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  errors: z.array(z.object({ rowNumber: z.number().int(), message: z.string() })),
  item_ids: z.array(uuidSchema),
})

async function authorizeImport(siteId: string, mode: CatalogImportMode) {
  const supabase = await createClient(true)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: "Unauthorized" } as const
  const role = await getCurrentUserSiteRole(supabase, siteId)
  if (!role || !await userCanOnSite(supabase, siteId, "select") || !await userCanOnSite(supabase, siteId, "insert") ||
      (mode === "update" && !await userCanOnSite(supabase, siteId, "update"))) {
    return { error: "Forbidden" } as const
  }
  return { supabase } as const
}

export async function previewCatalogImportBatch(siteId: string, rows: CatalogImportRow[]): Promise<{
  data?: { existingSkus: string[]; missingCategories: string[]; ambiguousCategories: string[] }; error?: string,
}> {
  const parsed = catalogImportBatchSchema.safeParse(rows)
  if (!uuidSchema.safeParse(siteId).success || !parsed.success) return { error: "Invalid import batch" }
  try {
    const access = await authorizeImport(siteId, "skip")
    if (access.error) return { error: access.error }
    const { supabase } = access
    const categories = [...new Set(parsed.data.flatMap(row => row.category ? [row.category] : []))]
    const existingSkus: string[] = []
    for (const skus of catalogImportLookupChunks(parsed.data.map(row => row.item.sku))) {
      const result = await supabase.from("catalog_items").select("sku").eq("site_id", siteId).filter("sku", "in", catalogImportInFilter(skus))
      if (result.error) return { error: "Unable to validate the catalog. Please try again." }
      result.data?.forEach((item: { sku: string }) => existingSkus.push(item.sku))
    }
    let categoryPreview = { missingCategories: [] as string[], ambiguousCategories: [] as string[] }
    if (categories.length) {
      // Use the database's normalization for preview and execution alike. Names
      // are JSON arguments, never interpolated into PostgREST filter syntax.
      const result = await supabase.rpc("preview_catalog_import_categories", { p_site_id: siteId, p_names: categories })
      if (result.error) {
        if (["PGRST202", "42883"].includes(result.error.code ?? "")) {
          return { error: "Automatic category import is not installed yet. Apply the catalog import categories migration before importing." }
        }
        return { error: "Unable to validate the catalog. Please try again." }
      }
      const parsedPreview = categoryPreviewSchema.safeParse(result.data)
      if (!parsedPreview.success) return { error: "Unable to validate the catalog. Please try again." }
      categoryPreview = parsedPreview.data
    }
    return { data: {
      existingSkus,
      ...categoryPreview,
    } }
  } catch { return { error: "Unable to validate the catalog. Please try again." } }
}

export async function importCatalogBatch(siteId: string, rows: CatalogImportRow[], mode: CatalogImportMode, requestId: string): Promise<{
  data?: { created: number; updated: number; skipped: number; errors: CatalogImportError[] }; error?: string,
}> {
  const parsed = catalogImportBatchSchema.safeParse(rows)
  if (!uuidSchema.safeParse(siteId).success || !uuidSchema.safeParse(requestId).success ||
      !parsed.success || !["skip", "update"].includes(mode)) return { error: "Invalid import batch" }
  try {
    const access = await authorizeImport(siteId, mode)
    if (access.error) return { error: access.error }
    const { data, error } = await access.supabase.rpc("import_catalog_batch", {
      p_site_id: siteId, p_rows: parsed.data, p_mode: mode, p_request_id: requestId,
    })
    if (error) {
      if (error.code === "42501") return { error: "Forbidden" }
      if (["PGRST202", "42883"].includes(error.code ?? "")) return { error: "Catalog import is not installed yet. Apply the catalog batch import migration before importing." }
      if (["55P03", "57014"].includes(error.code ?? "")) return { error: "The catalog is busy. Resume to retry this batch safely." }
      return { error: "Unable to confirm this batch. Resume to retry it safely." }
    }
    const result = batchResultSchema.safeParse(data)
    if (!result.success || result.data.created + result.data.updated + result.data.skipped + result.data.errors.length !== parsed.data.length) {
      return { error: "Unable to confirm this batch. Resume to retry it safely." }
    }
    // Invalidation happens after commit. A cache failure must not misreport a
    // successful database write; the import dialog refreshes its own SWR data.
    try {
      if (result.data.created || result.data.updated) {
        revalidateTag(shopCacheTag(siteId), "max")
        revalidateTag(MARKETPLACE_CACHE_TAG, "max")
        for (const itemId of result.data.item_ids) revalidateTag(pdpCacheTag(itemId), "max")
        revalidatePath("/catalog")
        revalidatePath("/pos")
      }
    } catch { /* The committed receipt remains safe to replay. */ }
    return { data: {
      created: result.data.created, updated: result.data.updated,
      skipped: result.data.skipped, errors: result.data.errors,
    } }
  } catch { return { error: "Unable to confirm this batch. Resume to retry it safely." } }
}