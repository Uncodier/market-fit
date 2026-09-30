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
  lineSubtotal,
} from "./purchase-mappers"

export { listPurchases, getPurchaseById, getPurchaseWithoutContext } from "./purchase-queries"
import { getPurchaseById } from "./purchase-queries"
import { purchaseAmountDue } from "./purchase-payment-state"
import { deleteAccountingSource, hasSourceJournal } from '@/app/accounting/source-lifecycle'

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

    const { data: current, error: currentError } = await supabase.from("purchases")
      .select("amount, amount_due, payments, accounting_state, updated_at")
      .eq("id", values.id).eq("site_id", values.siteId).single()
    if (currentError || !current) throw new Error("Purchase not found in this site")
    if (!values.items && values.amountDue !== undefined &&
      (!Number.isFinite(values.amountDue) || values.amountDue < 0 || values.amountDue > Number(current.amount))) {
      throw new Error("Invalid amount due")
    }
    const hasJournal = current.accounting_state === 'posted' || (current.accounting_state !== 'unpublished'
      && await hasSourceJournal(supabase, values.siteId, 'purchase', values.id))
    if (values.status === 'draft' && (hasJournal || current.accounting_state === 'unpublished'
      || Number(current.amount) > Number(current.amount_due) || current.payments?.length)) {
      throw new Error('A paid or previously posted purchase cannot return to draft')
    }
    const wasPosted = hasJournal && current.accounting_state !== 'unpublished'
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      ...(wasPosted ? { accounting_state: "pending" } : {}),
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
    if (values.payments !== undefined && !values.items) {
      updateData.amount_due = purchaseAmountDue(current, Number(current.amount), {
        payments: values.payments, amountDue: values.amountDue,
      })
    }

    if (values.items) {
      if (values.payments !== undefined) {
        throw new Error("Save purchase items and payment changes separately")
      }
      const amount = Math.round(
        values.items.reduce((sum, line) => sum + lineSubtotal(line), 0) * 100
      ) / 100
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid purchase amount")
      updateData.amount = amount
      updateData.amount_due = purchaseAmountDue(current, amount,
        values.payments === undefined ? undefined : { payments: values.payments, amountDue: values.amountDue })

      const itemRows = values.items.map((line) => ({
        catalog_item_id: line.catalogItemId || null,
        name: line.name,
        quantity: line.quantity,
        unit_cost: line.unitCost,
        subtotal: lineSubtotal(line),
      }))
      const { updated_at: _version, accounting_state: _state, amount: _amount, amount_due: _due, ...header } = updateData
      // The authenticated RPC checks capabilities, locks the source version, and
      // saves header + items together. Failures leave the previous source intact.
      const { error } = await supabase.rpc("accounting_update_purchase_items", {
        p_site_id: values.siteId,
        p_purchase_id: values.id,
        p_expected_updated_at: current.updated_at,
        p_items: itemRows,
        p_update: header,
      })
      if (error?.code === "40001") throw new Error("Purchase changed while editing. Reload and retry.")
      if (error) throw new Error("Unable to save purchase items. The previous purchase was preserved.")
    } else {
      const { error } = await supabase.from("purchases").update(updateData)
        .eq("id", values.id).eq("site_id", values.siteId)
      if (error) throw new Error(error.message)
    }

    if (wasPosted) {
      try {
        await upsertPolizaForPurchase(values.id, values.siteId)
      } catch {
        revalidatePath("/bills")
        revalidatePath(`/bills/${values.id}`)
        throw new Error("Purchase saved, but accounting synchronization failed. It remains pending accounting review.")
      }
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
    if (!Number.isFinite(amount) || amount <= 0) return { purchase: null, error: "Invalid payment amount" }
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
      const result = await updatePurchase({
        siteId,
        id: purchaseId,
        status: purchase.amountDue > 0 ? "pending" : "completed",
      })
      if (result.error) return { error: result.error }
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

    await removePolizaForSource("purchase", purchaseId, siteId)
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

    await deleteAccountingSource(siteId, 'purchase', purchaseId)
    revalidatePath("/bills")
    return { error: null }
  } catch (error) {
    console.error("Error in deletePurchase:", error)
    return { error: error instanceof Error ? error.message : "Failed to delete purchase" }
  }
}
