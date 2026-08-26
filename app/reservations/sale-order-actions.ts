"use server"

import { revalidatePath } from "next/cache"
import { checkoutCart, type CheckoutLine, type CheckoutLineModifier } from "@/app/commerce/checkout"
import {
  resolveProductCurrency,
  resolveSiteCurrency,
} from "@/app/commerce/checkout-currency"
import { grantFromOrder } from "@/app/commerce/entitlements"
import { tryUpsertPolizaForSale } from "@/app/accounting/ensure"
import { createClient } from "@/lib/supabase/server"
import type { Reservation } from "@/app/types"
import {
  applyReservationPayments,
  checkoutFulfillmentFromOrder,
  checkoutLinesFromModifiers,
  checkoutLinesFromSaleOrderItems,
  checkoutSourceFromSale,
  mergeReservationLinesIntoOrder,
  resolveExistingSaleOrderId,
  resolveReservationChargeCurrency,
  saleCatalogCurrencyMismatch,
  shouldEnsureReservationSaleOrder,
  shouldRewriteExistingSaleOrder,
  stripCheckoutLinePriceOverrides,
  type ReservationPaymentEntry,
  type SaleOrderItemLike,
} from "./ensure-sale-order"

export async function ensureReservationSaleOrder(params: {
  siteId: string
  reservationId: string
  notes?: string | null
  assigneeUserId?: string | null
  lines?: CheckoutLine[]
}): Promise<{
  data?: {
    reservation: Reservation
    saleOrderId: string
    saleId: string
    amountDue: number
    amount: number
    currency: string
  }
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: reservation, error: loadError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", params.reservationId)
      .eq("site_id", params.siteId)
      .maybeSingle()

    if (loadError) return { error: loadError.message }
    if (!reservation) return { error: "Reservation not found" }
    if (!shouldEnsureReservationSaleOrder(reservation)) {
      return { error: "Team tasks do not create sales orders" }
    }
    if (!reservation.catalog_item_id) return { error: "Service is required" }
    if (!reservation.lead_id) return { error: "Customer is required" }

    let existingItem: { id: string; sale_order_id?: string | null } | null = null
    if (reservation.sale_order_item_id) {
      const { data: item } = await supabase
        .from("sale_order_items")
        .select("id, sale_order_id")
        .eq("id", reservation.sale_order_item_id)
        .maybeSingle()
      existingItem = item
    }

    const existingOrderId = resolveExistingSaleOrderId({
      saleOrderItemId: reservation.sale_order_item_id,
      item: existingItem,
    })

    let existingItems: SaleOrderItemLike[] = []
    let existingPayments: ReservationPaymentEntry[] = []
    let existingSource: string | null = null
    let existingFulfillment: string | null = null
    let existingSaleId: string | null = null
    let existingAmountDue = 0
    let existingAmount = 0
    let existingCurrency: string | null = null
    if (existingOrderId) {
      const { data: items } = await supabase
        .from("sale_order_items")
        .select("id, catalog_item_id, quantity, unit_price, parent_sale_order_item_id, metadata")
        .eq("sale_order_id", existingOrderId)
      existingItems = (items || []) as SaleOrderItemLike[]

      const { data: orderRow } = await supabase
        .from("sale_orders")
        .select("sale_id, fulfillment_method")
        .eq("id", existingOrderId)
        .maybeSingle()
      existingFulfillment = orderRow?.fulfillment_method || null
      existingSaleId = orderRow?.sale_id || null
      if (orderRow?.sale_id) {
        const { data: sale } = await supabase
          .from("sales")
          .select("id, amount, amount_due, payments, source, currency")
          .eq("id", orderRow.sale_id)
          .maybeSingle()
        existingPayments = Array.isArray(sale?.payments)
          ? sale.payments.map((payment: any) => ({
              method: payment.method,
              amount: Number(payment.amount) || 0,
              tendered: Number(payment.tendered ?? payment.amount) || 0,
              change: Number(payment.change) || 0,
            }))
          : []
        existingSource = sale?.source || null
        existingAmountDue = Number(sale?.amount_due) || 0
        existingAmount = Number(sale?.amount) || 0
        existingCurrency = sale?.currency || null
      }
    }

    const [{ data: catalogItem }, { data: settingsRow }] = await Promise.all([
      supabase
        .from("catalog_items")
        .select("currency")
        .eq("id", reservation.catalog_item_id)
        .maybeSingle(),
      supabase
        .from("settings")
        .select("currency")
        .eq("site_id", params.siteId)
        .maybeSingle(),
    ])
    const siteCurrency = resolveSiteCurrency(settingsRow?.currency)
    const catalogOrSiteCurrency = resolveProductCurrency(
      catalogItem?.currency,
      siteCurrency,
    )
    const currencyMismatch = saleCatalogCurrencyMismatch({
      saleCurrency: existingCurrency,
      catalogCurrency: catalogOrSiteCurrency,
    })

    const hasExplicitLines = Boolean(params.lines && params.lines.length > 0)
    if (
      !shouldRewriteExistingSaleOrder({
        existingOrderId,
        hasExplicitLines,
        currencyMismatch,
      })
    ) {
      revalidatePath("/reservations")
      return {
        data: {
          reservation: reservation as Reservation,
          saleOrderId: existingOrderId!,
          saleId: existingSaleId || "",
          amountDue: existingAmountDue,
          amount: existingAmount,
          currency: resolveReservationChargeCurrency({
            saleCurrency: existingCurrency,
            catalogCurrency: catalogItem?.currency,
            siteCurrency,
          }),
        },
      }
    }

    const reservationLines =
      params.lines && params.lines.length > 0
        ? params.lines
        : checkoutLinesFromSaleOrderItems({
            reservationId: reservation.id,
            reservationStart: reservation.start_time,
            reservationEnd: reservation.end_time,
            catalogItemId: reservation.catalog_item_id,
            quantity: reservation.quantity || 1,
            items: existingItems,
          })
    const mergedLines = existingOrderId
      ? mergeReservationLinesIntoOrder({
          reservationLines,
          existingItems,
          excludeParentId: reservation.sale_order_item_id,
        })
      : reservationLines
    const lines =
      currencyMismatch && !hasExplicitLines
        ? stripCheckoutLinePriceOverrides(mergedLines)
        : mergedLines

    const result = await checkoutCart({
      siteId: params.siteId,
      lines,
      leadId: reservation.lead_id,
      source: checkoutSourceFromSale(existingSource),
      fulfillment: checkoutFulfillmentFromOrder(existingFulfillment),
      intent: "send",
      userId: user?.id,
      notes: params.notes ?? reservation.notes ?? undefined,
      existingOrderId,
      existingReservationId: reservation.id,
      ...(existingPayments.length > 0 ? { payments: existingPayments } : {}),
    })

    if (result.error || !result.orderId || !result.saleId) {
      return { error: result.error || "Failed to upsert sales order" }
    }

    const nextStatus =
      reservation.status === "cancelled" || reservation.status === "completed"
        ? reservation.status
        : "confirmed"

    const { data: patched, error: patchError } = await supabase
      .from("reservations")
      .update({
        status: nextStatus,
        assignee_user_id: params.assigneeUserId ?? reservation.assignee_user_id ?? null,
        notes: params.notes ?? reservation.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservation.id)
      .eq("site_id", params.siteId)
      .select()
      .single()

    if (patchError) return { error: patchError.message }

    const { data: sale } = await supabase
      .from("sales")
      .select("id, amount, amount_due, currency")
      .eq("id", result.saleId)
      .single()

    revalidatePath("/reservations")
    return {
      data: {
        reservation: patched as Reservation,
        saleOrderId: result.orderId,
        saleId: result.saleId,
        amountDue: Number(sale?.amount_due) || 0,
        amount: Number(sale?.amount) || 0,
        currency: resolveReservationChargeCurrency({
          saleCurrency: sale?.currency,
          catalogCurrency: catalogItem?.currency,
          siteCurrency,
        }),
      },
    }
  } catch (error: any) {
    return { error: error?.message || "Failed to upsert sales order" }
  }
}

export async function saveServiceReservation(params: {
  reservation: Partial<Reservation>
  modifiers?: CheckoutLineModifier[]
}): Promise<{ data?: Reservation; error?: string }> {
  const payload = { ...params.reservation }
  delete (payload as any).sale_order_id
  delete (payload as any).amount_due
  delete (payload as any).amount
  delete (payload as any).catalog_item
  delete (payload as any).lead
  delete (payload as any).buyer_profile
  delete (payload as any).is_task

  try {
    const supabase = await createClient()
    const { data: saved, error } = await supabase
      .from("reservations")
      .upsert({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error || !saved) return { error: error?.message || "Failed to save reservation" }

    const reservation = saved as Reservation
    if (!reservation.catalog_item_id || !reservation.start_time || !reservation.end_time) {
      revalidatePath("/reservations")
      return { data: reservation }
    }

    const lines = checkoutLinesFromModifiers({
      reservationId: reservation.id,
      catalogItemId: reservation.catalog_item_id,
      quantity: reservation.quantity || 1,
      reservationStart: reservation.start_time,
      reservationEnd: reservation.end_time,
      modifiers: params.modifiers,
    })

    const ensured = await ensureReservationSaleOrder({
      siteId: reservation.site_id,
      reservationId: reservation.id,
      notes: reservation.notes,
      assigneeUserId: reservation.assignee_user_id,
      lines,
    })
    if (ensured.error) return { error: ensured.error }
    revalidatePath("/reservations")
    return { data: ensured.data?.reservation || reservation }
  } catch (error: any) {
    return { error: error?.message || "Failed to save reservation" }
  }
}

export async function getReservationPaymentContext(
  siteId: string,
  reservationId: string,
): Promise<{
  data?: {
    amountDue: number
    amount: number
    saleId: string
    saleOrderId: string
    hasCustomer: boolean
    currency: string
  }
  error?: string
}> {
  const ensured = await ensureReservationSaleOrder({ siteId, reservationId })
  if (ensured.error || !ensured.data) return { error: ensured.error || "Failed to load payment" }
  return {
    data: {
      amountDue: ensured.data.amountDue,
      amount: ensured.data.amount,
      saleId: ensured.data.saleId,
      saleOrderId: ensured.data.saleOrderId,
      hasCustomer: Boolean(ensured.data.reservation.lead_id),
      currency: ensured.data.currency,
    },
  }
}

export async function recordReservationPayment(params: {
  siteId: string
  reservationId: string
  payments: ReservationPaymentEntry[]
  intent?: "complete" | "pay" | "send"
}): Promise<{ error?: string }> {
  try {
    const ensured = await ensureReservationSaleOrder({
      siteId: params.siteId,
      reservationId: params.reservationId,
    })
    if (ensured.error || !ensured.data) {
      return { error: ensured.error || "Failed to upsert sales order" }
    }

    const supabase = await createClient()
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, amount, amount_due, payments, status, site_id")
      .eq("id", ensured.data.saleId)
      .single()
    if (saleError || !sale) return { error: saleError?.message || "Sale not found" }

    const { data: order } = await supabase
      .from("sale_orders")
      .select("id, status")
      .eq("id", ensured.data.saleOrderId)
      .single()

    const next = applyReservationPayments({
      amountDue: Number(sale.amount_due) || 0,
      existingPayments: Array.isArray(sale.payments) ? sale.payments : [],
      newPayments: params.payments || [],
      intent: params.intent,
      orderStatus: order?.status,
    })

    const paymentMethod =
      params.payments.length === 1
        ? params.payments[0].method
        : params.payments.length > 1
          ? "multiple"
          : undefined
    const { error: updateSaleError } = await supabase
      .from("sales")
      .update({
        amount_due: next.amountDue,
        status: next.saleStatus,
        payments: next.payments,
        ...(paymentMethod ? { payment_method: paymentMethod } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sale.id)
    if (updateSaleError) return { error: updateSaleError.message }

    if (next.orderCompleted && order && order.status !== "completed") {
      const { error: orderError } = await supabase
        .from("sale_orders")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", order.id)
      if (orderError) return { error: orderError.message }
    }

    if (next.fullyPaid && ensured.data.reservation.status === "pending") {
      await supabase
        .from("reservations")
        .update({ status: "confirmed", updated_at: new Date().toISOString() })
        .eq("id", params.reservationId)
        .eq("site_id", params.siteId)
    }

    if (next.grantEntitlements) {
      try {
        await grantFromOrder(ensured.data.saleOrderId, true)
      } catch (error) {
        console.error("Failed to grant entitlements after reservation payment:", error)
      }
      await tryUpsertPolizaForSale(sale.id, params.siteId)
    }

    revalidatePath("/reservations")
    return {}
  } catch (error: any) {
    return { error: error?.message || "Failed to register payment" }
  }
}
