"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { Purchase, Payment, PurchaseLineInput } from "@/app/types"
import {
  upsertPolizaForPurchase,
  removePolizaForSource,
} from "@/app/accounting/ensure"
import {
  verifySiteMembership,
  mapPurchase,
  lineSubtotal,
} from "./purchase-mappers"

export async function listPurchases(params: {
  siteId: string
  page?: number
  pageSize?: number
  status?: string
}) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { data: null, count: 0, error: "Not authenticated" }

    const isMember = await verifySiteMembership(supabase, session.user.id, params.siteId)
    if (!isMember) return { data: null, count: 0, error: "Not authorized for this site" }

    const page = params.page || 1
    const pageSize = params.pageSize || 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from("purchases")
      .select("*, vendor:companies!vendor_company_id(id, name)", { count: "exact" })
      .eq("site_id", params.siteId)
      .order("purchase_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to)

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status)
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
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { purchase: null, error: "Not authenticated" }

    const isMember = await verifySiteMembership(supabase, session.user.id, siteId)
    if (!isMember) return { purchase: null, error: "Not authorized for this site" }

    const { data, error } = await supabase
      .from("purchases")
      .select(`
        *,
        vendor:companies!vendor_company_id(id, name),
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

export async function createPurchase(values: {
  siteId: string
  title: string
  vendorCompanyId?: string | null
  status?: Purchase["status"]
  amountDue?: number
  currency?: string
  purchaseDate: string
  locationId?: string | null
  notes?: string | null
  items: PurchaseLineInput[]
}) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { purchase: null, error: "Not authenticated" }

    const isMember = await verifySiteMembership(supabase, session.user.id, values.siteId)
    if (!isMember) return { purchase: null, error: "Not authorized for this site" }

    if (!values.items?.length) return { purchase: null, error: "At least one line is required" }

    const amount = Math.round(
      values.items.reduce((sum, line) => sum + lineSubtotal(line), 0) * 100
    ) / 100
    const amountDue =
      values.amountDue !== undefined ? Math.max(0, Number(values.amountDue)) : amount
    const status = values.status || (amountDue > 0 ? "pending" : "completed")

    const { data: purchase, error } = await supabase
      .from("purchases")
      .insert({
        site_id: values.siteId,
        vendor_company_id: values.vendorCompanyId || null,
        user_id: session.user.id,
        title: values.title || "Vendor bill",
        status,
        amount,
        amount_due: amountDue,
        currency: values.currency || "USD",
        payments: [],
        purchase_date: values.purchaseDate,
        location_id: values.locationId || null,
        accounting_state: "pending",
        stock_received: false,
        notes: values.notes || null,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    const itemRows = values.items.map((line) => ({
      purchase_id: purchase.id,
      site_id: values.siteId,
      catalog_item_id: line.catalogItemId || null,
      name: line.name,
      quantity: line.quantity,
      unit_cost: line.unitCost,
      subtotal: lineSubtotal(line),
    }))

    const { error: itemsError } = await supabase.from("purchase_items").insert(itemRows)
    if (itemsError) throw new Error(itemsError.message)

    revalidatePath("/bills")
    const full = await getPurchaseById(values.siteId, purchase.id)
    return { purchase: full.purchase, error: null }
  } catch (error) {
    console.error("Error in createPurchase:", error)
    return {
      purchase: null,
      error: error instanceof Error ? error.message : "Failed to create purchase",
    }
  }
}

export async function updatePurchase(values: {
  siteId: string
  id: string
  title?: string
  vendorCompanyId?: string | null
  status?: Purchase["status"]
  amountDue?: number
  currency?: string
  purchaseDate?: string
  locationId?: string | null
  notes?: string | null
  payments?: Payment[]
  items?: PurchaseLineInput[]
}) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { purchase: null, error: "Not authenticated" }

    const isMember = await verifySiteMembership(supabase, session.user.id, values.siteId)
    if (!isMember) return { purchase: null, error: "Not authorized for this site" }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (values.title !== undefined) updateData.title = values.title
    if (values.vendorCompanyId !== undefined) updateData.vendor_company_id = values.vendorCompanyId
    if (values.status !== undefined) updateData.status = values.status
    if (values.amountDue !== undefined) updateData.amount_due = values.amountDue
    if (values.currency !== undefined) updateData.currency = values.currency
    if (values.purchaseDate !== undefined) updateData.purchase_date = values.purchaseDate
    if (values.locationId !== undefined) updateData.location_id = values.locationId
    if (values.notes !== undefined) updateData.notes = values.notes
    if (values.payments !== undefined) updateData.payments = values.payments

    if (values.items) {
      const amount = Math.round(
        values.items.reduce((sum, line) => sum + lineSubtotal(line), 0) * 100
      ) / 100
      updateData.amount = amount
      if (values.amountDue === undefined) {
        // keep amount_due unless explicitly set; clamp to new amount
        const { data: current } = await supabase
          .from("purchases")
          .select("amount_due")
          .eq("id", values.id)
          .single()
        updateData.amount_due = Math.min(Number(current?.amount_due) || 0, amount)
      }

      await supabase.from("purchase_items").delete().eq("purchase_id", values.id)
      const itemRows = values.items.map((line) => ({
        purchase_id: values.id,
        site_id: values.siteId,
        catalog_item_id: line.catalogItemId || null,
        name: line.name,
        quantity: line.quantity,
        unit_cost: line.unitCost,
        subtotal: lineSubtotal(line),
      }))
      const { error: itemsError } = await supabase.from("purchase_items").insert(itemRows)
      if (itemsError) throw new Error(itemsError.message)
    }

    const { error } = await supabase
      .from("purchases")
      .update(updateData)
      .eq("id", values.id)
      .eq("site_id", values.siteId)

    if (error) throw new Error(error.message)

    const { data: updated } = await supabase
      .from("purchases")
      .select("accounting_state")
      .eq("id", values.id)
      .single()

    if (updated?.accounting_state === "posted") {
      await upsertPolizaForPurchase(values.id, values.siteId)
    }

    revalidatePath("/bills")
    revalidatePath(`/bills/${values.id}`)
    const full = await getPurchaseById(values.siteId, values.id)
    return { purchase: full.purchase, error: null }
  } catch (error) {
    console.error("Error in updatePurchase:", error)
    return {
      purchase: null,
      error: error instanceof Error ? error.message : "Failed to update purchase",
    }
  }
}

export async function registerPurchasePayment(params: {
  siteId: string
  purchaseId: string
  amount: number
  method: string
  notes?: string
}) {
  try {
    const { purchase, error } = await getPurchaseById(params.siteId, params.purchaseId)
    if (error || !purchase) return { purchase: null, error: error || "Purchase not found" }

    const amount = Number(params.amount)
    if (!amount || amount <= 0) return { purchase: null, error: "Invalid payment amount" }
    if (amount > purchase.amountDue) {
      return { purchase: null, error: "Payment amount cannot exceed amount due" }
    }

    const payment: Payment = {
      id: `payment-${Date.now()}`,
      date: new Date().toISOString(),
      amount,
      method: params.method,
      notes: params.notes,
    }

    const newAmountDue = Math.max(0, purchase.amountDue - amount)
    const status =
      newAmountDue === 0 && purchase.status !== "cancelled" ? "completed" : purchase.status

    return updatePurchase({
      siteId: params.siteId,
      id: params.purchaseId,
      amountDue: newAmountDue,
      payments: [...(purchase.payments || []), payment],
      status,
    })
  } catch (error) {
    console.error("Error in registerPurchasePayment:", error)
    return {
      purchase: null,
      error: error instanceof Error ? error.message : "Failed to register payment",
    }
  }
}

export async function receivePurchaseStock(siteId: string, purchaseId: string, locationId?: string | null) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { success: false, error: "Not authenticated" }

    const isMember = await verifySiteMembership(supabase, session.user.id, siteId)
    if (!isMember) return { success: false, error: "Not authorized for this site" }

    const { purchase, error } = await getPurchaseById(siteId, purchaseId)
    if (error || !purchase) return { success: false, error: error || "Purchase not found" }

    if (purchase.stockReceived) {
      return { success: true, error: null, alreadyReceived: true }
    }

    const receiveLocationId = locationId || purchase.locationId
    if (!receiveLocationId) {
      return { success: false, error: "Location is required to receive stock" }
    }

    const productLines = (purchase.items || []).filter(
      (item) => item.catalogItemId && item.catalogItemKind === "product" && (Number(item.quantity) || 0) > 0
    )
    if (productLines.length === 0) {
      return {
        success: false,
        error: "No product lines to receive into inventory",
      }
    }

    for (const item of productLines) {
      const qty = Number(item.quantity) || 0
      const { data: level } = await supabase
        .from("inventory_levels")
        .select("id, quantity")
        .eq("site_id", siteId)
        .eq("location_id", receiveLocationId)
        .eq("catalog_item_id", item.catalogItemId!)
        .maybeSingle()

      if (level) {
        await supabase
          .from("inventory_levels")
          .update({
            quantity: (Number(level.quantity) || 0) + qty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", level.id)
      } else {
        await supabase.from("inventory_levels").insert({
          site_id: siteId,
          location_id: receiveLocationId,
          catalog_item_id: item.catalogItemId,
          quantity: qty,
        })
      }
    }

    const { error: flagError } = await supabase
      .from("purchases")
      .update({
        stock_received: true,
        location_id: receiveLocationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchaseId)
      .eq("site_id", siteId)

    if (flagError) throw new Error(flagError.message)

    revalidatePath("/bills")
    revalidatePath(`/bills/${purchaseId}`)
    revalidatePath("/inventory")
    return { success: true, error: null, alreadyReceived: false }
  } catch (error) {
    console.error("Error in receivePurchaseStock:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to receive stock",
    }
  }
}

export async function publishPurchase(siteId: string, purchaseId: string) {
  try {
    const { purchase, error } = await getPurchaseById(siteId, purchaseId)
    if (error || !purchase) return { error: error || "Purchase not found" }
    if (purchase.amount <= 0) return { error: "Amount must be greater than zero to publish" }
    if (purchase.status === "draft") {
      await updatePurchase({
        siteId,
        id: purchaseId,
        status: purchase.amountDue > 0 ? "pending" : "completed",
      })
    }
    await upsertPolizaForPurchase(purchaseId, siteId)
    revalidatePath("/bills")
    revalidatePath(`/bills/${purchaseId}`)
    return { error: null }
  } catch (error) {
    console.error("Error in publishPurchase:", error)
    return { error: error instanceof Error ? error.message : "Failed to publish" }
  }
}

export async function unpublishPurchase(siteId: string, purchaseId: string) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { error: "Not authenticated" }
    const isMember = await verifySiteMembership(supabase, session.user.id, siteId)
    if (!isMember) return { error: "Not authorized for this site" }

    await removePolizaForSource("purchase", purchaseId)
    revalidatePath("/bills")
    revalidatePath(`/bills/${purchaseId}`)
    return { error: null }
  } catch (error) {
    console.error("Error in unpublishPurchase:", error)
    return { error: error instanceof Error ? error.message : "Failed to unpublish" }
  }
}

export async function deletePurchase(siteId: string, purchaseId: string) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { error: "Not authenticated" }
    const isMember = await verifySiteMembership(supabase, session.user.id, siteId)
    if (!isMember) return { error: "Not authorized for this site" }

    await removePolizaForSource("purchase", purchaseId).catch(() => undefined)

    const { error } = await supabase
      .from("purchases")
      .delete()
      .eq("id", purchaseId)
      .eq("site_id", siteId)

    if (error) throw new Error(error.message)
    revalidatePath("/bills")
    return { error: null }
  } catch (error) {
    console.error("Error in deletePurchase:", error)
    return { error: error instanceof Error ? error.message : "Failed to delete purchase" }
  }
}
