import type { CheckoutLine, CheckoutLineModifier } from "@/app/commerce/checkout"
import {
  resolveLineCurrency,
  resolveProductCurrency,
} from "@/app/commerce/checkout-currency"
import { roundMoney } from "@/app/commerce/taxes"

export type SaleOrderItemLike = {
  id: string
  catalog_item_id: string
  quantity: number
  unit_price?: number | null
  parent_sale_order_item_id?: string | null
  metadata?: {
    client_line_key?: string
    is_modifier?: boolean
    modifier_group_id?: string
  } | null
}

export type ReservationPaymentEntry = {
  method: string
  amount: number
  tendered?: number
  change?: number
}

export function shouldEnsureReservationSaleOrder(reservation: {
  is_task?: boolean
  id?: string
}) {
  if (reservation.is_task) return false
  if (reservation.id?.startsWith("task_")) return false
  return true
}

export function resolveExistingSaleOrderId(params: {
  saleOrderItemId?: string | null
  item?: { id: string; sale_order_id?: string | null } | null
}): string | undefined {
  if (!params.saleOrderItemId) return undefined
  if (!params.item || params.item.id !== params.saleOrderItemId) return undefined
  return params.item.sale_order_id || undefined
}

export function reservationHostLineKey(reservationId: string) {
  return `reservation:${reservationId}`
}

export function shouldRewriteExistingSaleOrder(params: {
  existingOrderId?: string
  hasExplicitLines: boolean
  currencyMismatch?: boolean
}) {
  if (!params.existingOrderId) return true
  if (params.hasExplicitLines) return true
  if (params.currencyMismatch) return true
  return false
}

export function saleCatalogCurrencyMismatch(params: {
  saleCurrency?: string | null
  catalogCurrency?: string | null
}) {
  if (!params.saleCurrency || !params.catalogCurrency) return false
  return resolveLineCurrency(params.saleCurrency) !== resolveLineCurrency(params.catalogCurrency)
}

/** Existing sale currency, else the product, else the site. */
export function resolveReservationChargeCurrency(params: {
  saleCurrency?: string | null
  catalogCurrency?: string | null
  siteCurrency?: string | null
}) {
  return resolveProductCurrency(
    params.saleCurrency || params.catalogCurrency,
    params.siteCurrency,
  )
}

export function stripCheckoutLinePriceOverrides(lines: CheckoutLine[]): CheckoutLine[] {
  return lines.map((line) => ({
    ...line,
    unitPriceOverride: undefined,
    modifiers: (line.modifiers || []).map((modifier) => ({
      ...modifier,
      unitPriceOverride: undefined,
    })),
  }))
}

export function checkoutSourceFromSale(
  source?: string | null,
): "pos" | "shop" | "sales" | "marketplace" | "quote" {
  if (source === "pos" || source === "shop" || source === "marketplace" || source === "quote") {
    return source
  }
  return "sales"
}

export function checkoutFulfillmentFromOrder(
  method?: string | null,
): "pickup" | "ship" | "dine_in" | "none" {
  if (method === "pickup" || method === "ship" || method === "dine_in" || method === "none") {
    return method
  }
  return "none"
}

export function checkoutLinesFromModifiers(params: {
  reservationId: string
  catalogItemId: string
  quantity?: number
  reservationStart: string
  reservationEnd: string
  modifiers?: CheckoutLineModifier[]
}): CheckoutLine[] {
  return [
    {
      catalogItemId: params.catalogItemId,
      quantity: params.quantity || 1,
      reservationStart: params.reservationStart,
      reservationEnd: params.reservationEnd,
      clientLineKey: reservationHostLineKey(params.reservationId),
      modifiers: params.modifiers || [],
    },
  ]
}

export function checkoutLinesFromSaleOrderItems(params: {
  reservationId: string
  reservationStart: string
  reservationEnd: string
  catalogItemId: string
  quantity?: number
  items: SaleOrderItemLike[]
}): CheckoutLine[] {
  const parents = params.items.filter((item) => !item.parent_sale_order_item_id)
  const children = params.items.filter((item) => item.parent_sale_order_item_id)
  if (parents.length === 0) {
    return checkoutLinesFromModifiers({
      reservationId: params.reservationId,
      catalogItemId: params.catalogItemId,
      quantity: params.quantity,
      reservationStart: params.reservationStart,
      reservationEnd: params.reservationEnd,
    })
  }

  return parents.map((parent) => {
    const hostQty = parent.quantity || 1
    const modifiers: CheckoutLineModifier[] = children
      .filter((child) => child.parent_sale_order_item_id === parent.id)
      .map((child) => ({
        catalogItemId: child.catalog_item_id,
        quantity: hostQty > 0 ? child.quantity / hostQty : child.quantity,
        groupId: child.metadata?.modifier_group_id,
        unitPriceOverride:
          child.unit_price == null ? undefined : Number(child.unit_price),
      }))
    return {
      catalogItemId: parent.catalog_item_id,
      quantity: hostQty,
      unitPriceOverride:
        parent.unit_price == null ? undefined : Number(parent.unit_price),
      reservationStart: params.reservationStart,
      reservationEnd: params.reservationEnd,
      clientLineKey:
        parent.metadata?.client_line_key || reservationHostLineKey(params.reservationId),
      modifiers,
    }
  })
}

export function siblingCheckoutLinesFromOrderItems(
  items: SaleOrderItemLike[],
  excludeParentId?: string | null,
): CheckoutLine[] {
  const parents = items.filter(
    (item) => !item.parent_sale_order_item_id && item.id !== excludeParentId,
  )
  const children = items.filter((item) => item.parent_sale_order_item_id)
  return parents.map((parent) => {
    const hostQty = parent.quantity || 1
    const modifiers: CheckoutLineModifier[] = children
      .filter((child) => child.parent_sale_order_item_id === parent.id)
      .map((child) => ({
        catalogItemId: child.catalog_item_id,
        quantity: hostQty > 0 ? child.quantity / hostQty : child.quantity,
        groupId: child.metadata?.modifier_group_id,
        unitPriceOverride:
          child.unit_price == null ? undefined : Number(child.unit_price),
      }))
    return {
      catalogItemId: parent.catalog_item_id,
      quantity: hostQty,
      unitPriceOverride:
        parent.unit_price == null ? undefined : Number(parent.unit_price),
      clientLineKey: parent.metadata?.client_line_key || parent.id,
      modifiers,
    }
  })
}

export function mergeReservationLinesIntoOrder(params: {
  reservationLines: CheckoutLine[]
  existingItems: SaleOrderItemLike[]
  excludeParentId?: string | null
}): CheckoutLine[] {
  return [
    ...siblingCheckoutLinesFromOrderItems(params.existingItems, params.excludeParentId),
    ...params.reservationLines,
  ]
}

export function applyReservationPayments(params: {
  amountDue: number
  existingPayments?: unknown[]
  newPayments: ReservationPaymentEntry[]
  intent?: "complete" | "pay" | "send"
  orderStatus?: string | null
}) {
  const paid = roundMoney(
    params.newPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
  )
  const amountDue = roundMoney(Math.max(0, (Number(params.amountDue) || 0) - paid))
  const fullyPaid = amountDue <= 0
  const payments = [
    ...(Array.isArray(params.existingPayments) ? params.existingPayments : []),
    ...params.newPayments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      tendered: payment.tendered ?? payment.amount,
      change: payment.change || 0,
      date: new Date().toISOString(),
      status: "completed",
    })),
  ]

  const completeOnAccount = params.intent === "complete"
  const saleStatus = fullyPaid ? "completed" : "pending"
  const orderCompleted =
    fullyPaid || completeOnAccount || params.orderStatus === "completed"

  return {
    amountDue,
    fullyPaid,
    payments,
    saleStatus: saleStatus as "completed" | "pending",
    orderCompleted,
    grantEntitlements: fullyPaid || completeOnAccount,
  }
}

export async function loadReservationSalePayments(
  supabase: { from: (table: string) => any },
  itemIds: string[],
) {
  const map = new Map<
    string,
    { sale_order_id: string | null; amount: number | null; amount_due: number | null }
  >()
  if (itemIds.length === 0) return map

  const { data: items } = await supabase
    .from("sale_order_items")
    .select("id, sale_order_id")
    .in("id", itemIds)

  const orderIds = Array.from(
    new Set((items || []).map((row: any) => row.sale_order_id).filter(Boolean)),
  ) as string[]
  if (orderIds.length === 0) return map

  const { data: orders } = await supabase
    .from("sale_orders")
    .select("id, sale_id")
    .in("id", orderIds)

  const saleIds = Array.from(
    new Set((orders || []).map((row: any) => row.sale_id).filter(Boolean)),
  ) as string[]
  const { data: sales } =
    saleIds.length > 0
      ? await supabase.from("sales").select("id, amount, amount_due").in("id", saleIds)
      : { data: [] as any[] }

  const orderById = new Map((orders || []).map((row: any) => [row.id, row]))
  const saleById = new Map((sales || []).map((row: any) => [row.id, row]))

  for (const row of items || []) {
    const order = orderById.get(row.sale_order_id)
    const sale = order?.sale_id ? saleById.get(order.sale_id) : null
    map.set(row.id, {
      sale_order_id: row.sale_order_id || order?.id || null,
      amount: sale?.amount ?? null,
      amount_due: sale?.amount_due ?? null,
    })
  }
  return map
}
