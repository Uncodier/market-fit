"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ModifierGroupWithItems } from "./modifier-types"

export async function listModifierGroups(siteId: string, q?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("modifier_groups")
    .select("*")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (q?.trim()) {
    query = query.ilike("name", `%${q.trim()}%`)
  }

  const { data, error } = await query
  return { data: data || [], error: error?.message }
}

export async function getModifierGroup(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("modifier_groups")
    .select("*")
    .eq("id", id)
    .single()
  return { data, error: error?.message }
}

export async function upsertModifierGroup(input: {
  id?: string
  site_id: string
  name: string
  description?: string | null
  min_select?: number
  max_select?: number | null
  sort_order?: number
}) {
  const supabase = await createClient()
  const name = input.name?.trim()
  if (!name) return { data: null, error: "Name is required" }

  const minSelect = Math.max(0, Number(input.min_select ?? 0))
  const maxSelect =
    input.max_select === undefined || input.max_select === null
      ? null
      : Number(input.max_select)

  if (maxSelect != null && maxSelect < minSelect) {
    return { data: null, error: "Max select must be greater than or equal to min select" }
  }

  const payload = {
    site_id: input.site_id,
    name,
    description: input.description ?? null,
    min_select: minSelect,
    max_select: maxSelect,
    sort_order: input.sort_order ?? 0,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { data, error } = await supabase
      .from("modifier_groups")
      .update(payload)
      .eq("id", input.id)
      .select()
      .single()
    if (!error) {
      revalidatePath("/catalog/modifier-groups")
      revalidatePath(`/catalog/modifier-groups/${input.id}`)
    }
    return { data, error: error?.message }
  }

  const { data, error } = await supabase
    .from("modifier_groups")
    .insert(payload)
    .select()
    .single()
  if (!error) revalidatePath("/catalog/modifier-groups")
  return { data, error: error?.message }
}

export async function deleteModifierGroup(siteId: string, id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("modifier_groups")
    .delete()
    .eq("id", id)
    .eq("site_id", siteId)
  if (!error) {
    revalidatePath("/catalog/modifier-groups")
    revalidatePath("/catalog")
  }
  return { error: error?.message }
}

export async function listModifierGroupItems(modifierGroupId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("modifier_group_items")
    .select(
      "*, catalog_item:catalog_items!catalog_item_id(id, name, kind, description, target_sale_price, currency, image_url, status, category:catalog_categories(name))",
    )
    .eq("modifier_group_id", modifierGroupId)
    .order("sort_order", { ascending: true })
  return { data: data || [], error: error?.message }
}

export async function addModifierGroupItem(
  siteId: string,
  modifierGroupId: string,
  catalogItemId: string,
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("modifier_group_items")
    .insert({
      site_id: siteId,
      modifier_group_id: modifierGroupId,
      catalog_item_id: catalogItemId,
    })
    .select()
    .single()
  if (!error) revalidatePath(`/catalog/modifier-groups/${modifierGroupId}`)
  return { data, error: error?.message }
}

export async function removeModifierGroupItem(id: string, modifierGroupId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("modifier_group_items").delete().eq("id", id)
  if (!error) revalidatePath(`/catalog/modifier-groups/${modifierGroupId}`)
  return { error: error?.message }
}

export async function listCatalogItemModifierGroups(catalogItemId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catalog_item_modifier_groups")
    .select("*, modifier_group:modifier_groups(*)")
    .eq("catalog_item_id", catalogItemId)
    .order("sort_order", { ascending: true })
  return { data: data || [], error: error?.message }
}

export async function attachModifierGroupToCatalogItem(
  siteId: string,
  catalogItemId: string,
  modifierGroupId: string,
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("catalog_item_modifier_groups")
    .insert({
      site_id: siteId,
      catalog_item_id: catalogItemId,
      modifier_group_id: modifierGroupId,
    })
    .select()
    .single()
  if (!error) revalidatePath(`/catalog/${catalogItemId}`)
  return { data, error: error?.message }
}

export async function detachModifierGroupFromCatalogItem(
  linkId: string,
  catalogItemId: string,
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("catalog_item_modifier_groups")
    .delete()
    .eq("id", linkId)
  if (!error) revalidatePath(`/catalog/${catalogItemId}`)
  return { error: error?.message }
}

function categoryNameFromJoin(category: unknown): string | null {
  if (!category) return null
  if (Array.isArray(category)) {
    const name = category[0]?.name
    return typeof name === "string" && name.trim() ? name.trim() : null
  }
  if (typeof category === "object" && category !== null) {
    const name = (category as { name?: unknown }).name
    return typeof name === "string" && name.trim() ? name.trim() : null
  }
  return null
}

function mapGroupWithItems(
  group: any,
  items: any[],
): ModifierGroupWithItems {
  return {
    id: group.id,
    site_id: group.site_id,
    name: group.name,
    description: group.description,
    min_select: group.min_select ?? 0,
    max_select: group.max_select ?? null,
    sort_order: group.sort_order ?? 0,
    items: (items || []).map((row: any) => ({
      id: row.id,
      catalog_item_id: row.catalog_item_id,
      sort_order: row.sort_order ?? 0,
      name: row.catalog_item?.name || "Unknown",
      price: Number(row.catalog_item?.target_sale_price || 0),
      currency: row.catalog_item?.currency || null,
      image_url: row.catalog_item?.image_url || null,
      description: row.catalog_item?.description || null,
      categoryName: categoryNameFromJoin(row.catalog_item?.category),
    })),
  }
}

/** Groups attached to a host (or its parent), with option products. */
export async function getModifierGroupsForCatalogItem(
  catalogItemId: string,
): Promise<{ data: ModifierGroupWithItems[]; error?: string }> {
  // Service role: shop/marketplace PDP are public; RLS only allows site members.
  const supabase = await createServiceClient(true)

  const { data: item, error: itemError } = await supabase
    .from("catalog_items")
    .select("id, parent_id")
    .eq("id", catalogItemId)
    .single()

  if (itemError) return { data: [], error: itemError.message }

  const hostIds = [catalogItemId]
  if (item?.parent_id) hostIds.push(item.parent_id)

  const { data: links, error: linksError } = await supabase
    .from("catalog_item_modifier_groups")
    .select("*, modifier_group:modifier_groups(*)")
    .in("catalog_item_id", hostIds)
    .order("sort_order", { ascending: true })

  if (linksError) return { data: [], error: linksError.message }

  // Prefer groups on the specific item; fall back to parent if child has none
  const onItem = (links || []).filter((l: any) => l.catalog_item_id === catalogItemId)
  const effectiveLinks =
    onItem.length > 0
      ? onItem
      : (links || []).filter((l: any) => l.catalog_item_id === item?.parent_id)

  const groups: ModifierGroupWithItems[] = []
  const seen = new Set<string>()

  for (const link of effectiveLinks) {
    const group = link.modifier_group
    if (!group?.id || seen.has(group.id)) continue
    seen.add(group.id)

    const { data: items, error: itemsError } = await supabase
      .from("modifier_group_items")
      .select(
        "*, catalog_item:catalog_items!catalog_item_id(id, name, kind, description, target_sale_price, currency, image_url, status, category:catalog_categories(name))",
      )
      .eq("modifier_group_id", group.id)
      .order("sort_order", { ascending: true })

    if (itemsError) return { data: [], error: itemsError.message }

    const activeItems = (items || []).filter(
      (row: any) => !row.catalog_item?.status || row.catalog_item.status === "active",
    )
    groups.push(mapGroupWithItems(group, activeItems))
  }

  return { data: groups }
}

/** All host → groups map for POS snapshot (includes options). */
export async function listAllModifierGroupsForPos(siteId: string): Promise<{
  data: Record<string, ModifierGroupWithItems[]>
  error?: string
}> {
  // Service role: POS pull must include modifiers even when nested joins hit RLS edge cases
  const supabase = await createServiceClient(true)

  const { data: links, error: linksError } = await supabase
    .from("catalog_item_modifier_groups")
    .select("catalog_item_id, sort_order, modifier_group:modifier_groups(*)")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: true })

  if (linksError) return { data: {}, error: linksError.message }
  if (!links?.length) return { data: {} }

  const groupIds = Array.from(
    new Set(
      links
        .map((l: any) => l.modifier_group?.id)
        .filter(Boolean) as string[],
    ),
  )

  const { data: allItems, error: itemsError } = await supabase
    .from("modifier_group_items")
    .select(
      "*, catalog_item:catalog_items!catalog_item_id(id, name, kind, description, target_sale_price, currency, image_url, status, category:catalog_categories(name))",
    )
    .in("modifier_group_id", groupIds)
    .order("sort_order", { ascending: true })

  if (itemsError) return { data: {}, error: itemsError.message }

  const itemsByGroup = new Map<string, any[]>()
  for (const row of allItems || []) {
    const list = itemsByGroup.get(row.modifier_group_id) || []
    if (!row.catalog_item?.status || row.catalog_item.status === "active") {
      list.push(row)
    }
    itemsByGroup.set(row.modifier_group_id, list)
  }

  const byHost: Record<string, ModifierGroupWithItems[]> = {}
  const seenPerHost = new Map<string, Set<string>>()

  for (const link of links) {
    const hostId = link.catalog_item_id as string
    const group = (link as any).modifier_group
    if (!group?.id) continue

    const seen = seenPerHost.get(hostId) || new Set<string>()
    if (seen.has(group.id)) continue
    seen.add(group.id)
    seenPerHost.set(hostId, seen)

    if (!byHost[hostId]) byHost[hostId] = []
    byHost[hostId].push(
      mapGroupWithItems(group, itemsByGroup.get(group.id) || []),
    )
  }

  return { data: byHost }
}
