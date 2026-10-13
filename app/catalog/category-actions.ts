"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserSiteRole, isSiteManagerRole } from "@/lib/auth/api-site-access"
import { shopCacheTag } from "@/app/shop/[siteSlug]/shop-catalog-shared"
import { pdpCacheTag } from "@/app/commerce/pdp-actions"
import { MARKETPLACE_CACHE_TAG } from "@/app/marketplace/load-marketplace-home"

const archiveInput = z.object({ siteId: z.string().uuid(), categoryId: z.string().uuid() })
const archiveResult = z.object({ item_ids: z.array(z.string().uuid()) })

export async function archiveCatalogCategory(siteId: string, categoryId: string) {
  if (!archiveInput.safeParse({ siteId, categoryId }).success) {
    return { error: "Invalid site or category ID" }
  }

  try {
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { error: "Unauthorized" }

    const role = await getCurrentUserSiteRole(supabase, siteId)
    if (!isSiteManagerRole(role)) return { error: "Forbidden" }

    // The RPC verifies the category's site and archives all items in one transaction.
    const { data, error } = await supabase.rpc("archive_catalog_category", {
      p_site_id: siteId,
      p_category_id: categoryId,
    })
    if (error) {
      if (error.code === "42501") return { error: "Forbidden" }
      if (error.code === "P0002") return { error: "Category not found" }
      if (error.code === "55P03") return { error: "The catalog is being updated. Please try again." }
      return { error: "Failed to archive category" }
    }

    const result = archiveResult.safeParse(data)
    if (!result.success) return { error: "Unable to confirm category archival. Refresh the catalog before retrying." }

    updateTag(shopCacheTag(siteId))
    updateTag(MARKETPLACE_CACHE_TAG)
    for (const itemId of result.data.item_ids) updateTag(pdpCacheTag(itemId))
    revalidatePath("/catalog", "layout")
    revalidatePath("/pos")
    return { success: true }
  } catch {
    return { error: "Unable to confirm category archival. Refresh the catalog before retrying." }
  }
}