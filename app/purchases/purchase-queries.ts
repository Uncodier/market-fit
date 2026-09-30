"use server"

import { mapPurchase } from "./purchase-mappers"
import { authenticatePurchaseRequest, authorizePurchaseSite, purchaseListClient, requirePurchaseAccess, validatePurchaseId } from "./purchase-access"

export async function listPurchases(params: {
  siteId: string
  page?: number
  pageSize?: number
  status?: string
  locationId?: string
  q?: string
  sort?: string
}) {
  try {
    const { supabase, isDemo } = await purchaseListClient(params.siteId)
    if (!isDemo && params.locationId && params.locationId !== "all") validatePurchaseId(params.locationId, "location")

    const page = params.page || 1
    const pageSize = params.pageSize || 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from("purchases")
      .select("*, vendor:companies!vendor_company_id(id, name)", { count: "exact" })
      .eq("site_id", params.siteId)
      .range(from, to)

    if (params.sort === 'oldest') {
      query = query.order("created_at", { ascending: true })
    } else if (params.sort === 'updated_at') {
      query = query.order("updated_at", { ascending: false }).order("created_at", { ascending: false })
    } else {
      query = query.order("purchase_date", { ascending: false }).order("created_at", { ascending: false })
    }

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status)
    }

    if (params.locationId && params.locationId !== "all") {
      query = query.eq("location_id", params.locationId)
    }

    if (params.q) {
      query = query.ilike("title", `%${params.q}%`)
    }

    const { data, count, error } = await query
    if (error) throw new Error(error.message)

    return {
      data: (data || []).map(mapPurchase),
      count: count || 0,
      error: null,
    }
  } catch (error) {
    console.error("Error in listPurchases:", error)
    return {
      data: null,
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function getPurchaseById(siteId: string, id: string) {
  try {
    const { supabase } = await requirePurchaseAccess(siteId, "select", id)

    const { data, error } = await supabase
      .from("purchases")
      .select(`
        *,
        vendor:companies!vendor_company_id(id, name, email),
        purchase_items(*, catalog_items(id, name, kind))
      `)
      .eq("id", id)
      .eq("site_id", siteId)
      .single()

    if (error) throw new Error(error.message)
    return { purchase: mapPurchase(data), error: null }
  } catch (error) {
    console.error("Error in getPurchaseById:", error)
    return {
      purchase: null,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function getPurchaseWithoutContext(id: string) {
  try {
    validatePurchaseId(id)
    const { supabase } = await authenticatePurchaseRequest()
    const { data: source, error: sourceError } = await supabase.from("purchases")
      .select("site_id").eq("id", id).single()
    if (sourceError || !source) throw new Error("Purchase not found")
    await authorizePurchaseSite(supabase, source.site_id, "select")

    const { data, error } = await supabase
      .from("purchases")
      .select(`
        *,
        vendor:companies!vendor_company_id(id, name, email),
        purchase_items(*, catalog_items(id, name, kind)),
        site:sites(id, name, url, logo_url, settings)
      `)
      .eq("id", id)
      .eq("site_id", source.site_id)
      .single()

    if (error) throw new Error(error.message)
    return { purchase: mapPurchase(data), site: data.site, error: null }
  } catch (error) {
    console.error("Error in getPurchaseWithoutContext:", error)
    return {
      purchase: null,
      site: null,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

