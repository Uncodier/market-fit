"use server"

import { createClient } from "@/lib/supabase/server"
import { Tax, CatalogItemTax } from "@/app/types"

export async function listTaxes(siteId: string, activeOnly = true) {
  try {
    const supabase = await createClient()
    let query = supabase
      .from("taxes")
      .select("*")
      .eq("site_id", siteId)
      .order("name", { ascending: true })

    if (activeOnly) {
      query = query.eq("is_active", true)
    }

    const { data, error } = await query
    if (error) return { data: [] as Tax[], error: error.message }
    return { data: (data || []) as Tax[] }
  } catch (error: any) {
    return { data: [] as Tax[], error: error.message }
  }
}

export async function upsertTax(tax: {
  id?: string
  site_id: string
  name: string
  rate: number
  is_active?: boolean
}) {
  try {
    const name = tax.name?.trim()
    if (!name) return { error: "Tax name is required" }
    if (tax.rate < 0 || tax.rate > 100) return { error: "Tax rate must be between 0 and 100" }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("taxes")
      .upsert({
        ...tax,
        name,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return { error: error.message }
    return { data: data as Tax }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function findOrCreateTax(siteId: string, name: string, rate: number) {
  try {
    const trimmed = name?.trim()
    if (!trimmed) return { tax: null, error: "Tax name is required" }
    if (rate < 0 || rate > 100) return { tax: null, error: "Tax rate must be between 0 and 100" }

    const supabase = await createClient()
    const { data: existing, error: searchError } = await supabase
      .from("taxes")
      .select("*")
      .eq("site_id", siteId)
      .ilike("name", trimmed)
      .limit(1)
      .maybeSingle()

    if (searchError) return { tax: null, error: searchError.message }
    if (existing) {
      if (Number(existing.rate) !== rate) {
        return { tax: null, error: `Tax "${existing.name}" already exists with rate ${existing.rate}%` }
      }
      return { tax: existing as Tax, error: null }
    }

    const { data: tax, error } = await supabase
      .from("taxes")
      .insert({
        site_id: siteId,
        name: trimmed,
        rate,
        is_active: true,
      })
      .select()
      .single()

    return { tax: tax as Tax | null, error: error?.message || null }
  } catch (error: any) {
    return { tax: null, error: error.message }
  }
}

export async function getCatalogItemTaxes(catalogItemId: string) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("catalog_item_taxes")
      .select("*, tax:taxes(*)")
      .eq("catalog_item_id", catalogItemId)
      .order("created_at", { ascending: true })

    if (error) return { data: [] as CatalogItemTax[], error: error.message }
    return { data: (data || []) as CatalogItemTax[] }
  } catch (error: any) {
    return { data: [] as CatalogItemTax[], error: error.message }
  }
}

/** Batch-load taxes for many catalog items. Returns map of catalog_item_id -> Tax[]. */
export async function getTaxesByCatalogItemIds(siteId: string, catalogItemIds: string[]) {
  try {
    if (!catalogItemIds.length) return { data: {} as Record<string, Tax[]>, error: null }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("catalog_item_taxes")
      .select("catalog_item_id, tax:taxes(*)")
      .eq("site_id", siteId)
      .in("catalog_item_id", catalogItemIds)

    if (error) return { data: {} as Record<string, Tax[]>, error: error.message }

    const map: Record<string, Tax[]> = {}
    for (const row of data || []) {
      const tax = row.tax as Tax | Tax[] | null
      const resolved = Array.isArray(tax) ? tax[0] : tax
      if (!resolved || resolved.is_active === false) continue
      if (!map[row.catalog_item_id]) map[row.catalog_item_id] = []
      map[row.catalog_item_id].push(resolved)
    }
    return { data: map, error: null }
  } catch (error: any) {
    return { data: {} as Record<string, Tax[]>, error: error.message }
  }
}

export async function addCatalogItemTax(siteId: string, catalogItemId: string, taxId: string) {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("catalog_item_taxes")
      .insert({
        site_id: siteId,
        catalog_item_id: catalogItemId,
        tax_id: taxId,
      })
      .select("*, tax:taxes(*)")
      .single()

    if (error) {
      if (error.code === "23505") return { error: "Tax is already linked to this product" }
      return { error: error.message }
    }
    return { data: data as CatalogItemTax }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function removeCatalogItemTax(id: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from("catalog_item_taxes").delete().eq("id", id)
    return { error: error?.message }
  } catch (error: any) {
    return { error: error.message }
  }
}
