import { isAccessOnlyItem } from "@/app/catalog/product-details"
import { allocateCheckoutBackorders, revalidateCheckoutAvailability } from "./checkout-availability"
import { getTaxesByCatalogItemIds } from "@/app/catalog/tax-actions"
import { assertCommerceReservationSlot } from "./pass-round-robin-server"
import { isRoundRobinPass } from "./pass-round-robin"
import { loadCheckoutCatalogItems, loadCheckoutParentModes, loadCheckoutResolvedPrices } from "./checkout-line-reads"
import { getUsdFxRates } from "@/app/lib/fx-rates"
import {
  checkoutLinesNeedFxConversion,
  normalizeCheckoutLinesToCurrency,
  resolveCheckoutOrderCurrency,
  resolveProductCurrency,
} from "./checkout-currency"
import { calculateOrderTaxTotal } from "./taxes"
import { resolveExistingCheckoutCurrency } from "./checkout-existing-currency"
import { loadSelfServicePricing } from "./self-service-pricing"
import type { CatalogItem } from "@/app/types"
import {
  CheckoutCartParams,
  CheckoutLine,
  CheckoutSupabaseClient,
  ProcessedCheckoutLine,
} from "./checkout-types"

type ProcessCheckoutLinesParams = {
  supabase: CheckoutSupabaseClient
  supabaseAdmin: CheckoutSupabaseClient
  siteId: string
  lines: CheckoutLine[]
  isAdmin: boolean
  isStaffCheckout: boolean
  siteSettings: {
    [key: string]: unknown
    currency?: string | null
    shop?: { free_shipping_threshold?: number | null; shipping_cost?: number | null }
  } | null | undefined
  finalPriceListId?: string
  priceListChannel: string | null | undefined
  finalLeadId?: string
  originLocationId?: string
  existingReservationId?: string
  effectiveExistingOrderId?: string
  fulfillment: CheckoutCartParams["fulfillment"]
  selfServiceLocationId?: string
  publicCheckout?: boolean
}

export async function processCheckoutLines(params: ProcessCheckoutLinesParams) {
  const {
    supabase,
    supabaseAdmin,
    siteId,
    lines,
    isAdmin,
    isStaffCheckout,
    siteSettings,
    finalPriceListId,
    priceListChannel,
    finalLeadId,
    existingReservationId,
    effectiveExistingOrderId,
    fulfillment,
  } = params
  const queryClient = isAdmin ? supabaseAdmin : supabase
  const existingCurrency = await resolveExistingCheckoutCurrency(params)
  const checkoutStock = await revalidateCheckoutAvailability(params)
  const selfServicePricing = params.selfServiceLocationId || (params.publicCheckout && ["shop", "marketplace"].includes(priceListChannel ?? "")) ? await loadSelfServicePricing(queryClient, siteId,
    lines.flatMap((line) => [line.catalogItemId, ...(line.modifiers || []).map((modifier) => modifier.catalogItemId)]), priceListChannel === "marketplace" ? "marketplace" : "shop") : null
  const catalogItems = await loadCheckoutCatalogItems(queryClient, siteId, lines)
  const [parentModes, resolvedPrices] = await Promise.all([
    loadCheckoutParentModes(queryClient, siteId, catalogItems, lines),
    selfServicePricing ? Promise.resolve(new Map<string, number>()) : loadCheckoutResolvedPrices({
      siteId, lines, finalPriceListId, isAdmin, priceListChannel,
    }),
  ])
  let orderSubtotal = 0
  const processedLines: ProcessedCheckoutLine[] = []
  const catalogItemsForShipping: Partial<
    import("@/app/types").CatalogItem
  >[] = []

  const resolveLinePrice = (
    catalogItemId: string,
    unitPriceOverride?: number
  ) => {
    if (selfServicePricing) {
      const mapped = selfServicePricing.priceByItemId.get(catalogItemId)
      if (mapped !== undefined) return mapped
      const item = catalogItems.get(catalogItemId)
      const price = Number(item?.target_sale_price ?? 0)
      if (!item || !Number.isFinite(price) || price < 0) throw new Error("Unable to verify item price.")
      return price
    }
    if (unitPriceOverride !== undefined) return unitPriceOverride
    const resolved = resolvedPrices.get(catalogItemId)
    if (resolved && typeof resolved === "object") throw resolved.error
    return resolved || 0
  }

  for (const line of lines) {
    const catalogItem = catalogItems.get(line.catalogItemId)
    const isAccessOnly = isAccessOnlyItem({
      is_recurring: Boolean(catalogItem?.is_recurring),
      kind: catalogItem?.kind,
      digital_subtype: catalogItem?.digital_subtype,
      redeem_assignment_mode: catalogItem?.redeem_assignment_mode,
    } as CatalogItem)

    let isRoundRobinDropin = false
    let effectiveAssignmentMode = catalogItem?.redeem_assignment_mode
    if (catalogItem?.is_reservation && !isAccessOnly) {
      const hasReservationDates = Boolean(
        line.reservationStart && line.reservationEnd
      )
      const canReuseLinkedReservation = Boolean(
        existingReservationId || effectiveExistingOrderId
      )
      if (!hasReservationDates && !canReuseLinkedReservation) {
        throw new Error(
          "Reservation dates are required for drop-in reservable items."
        )
      }
      if (!finalLeadId && !isAdmin) {
        throw new Error("Reservable items require a customer.")
      }
      isRoundRobinDropin = isRoundRobinPass(catalogItem)
      if (!isRoundRobinDropin && catalogItem?.parent_id) {
        if (parentModes.get(catalogItem.parent_id) === "round_robin") {
          isRoundRobinDropin = true
          effectiveAssignmentMode = "round_robin"
        }
      }
      if (hasReservationDates) {
        await assertCommerceReservationSlot({
          siteId,
          catalogItem: {
            id: catalogItem.id,
            kind: catalogItem.kind,
            digital_subtype: catalogItem.digital_subtype,
            redeem_assignment_mode: effectiveAssignmentMode,
          },
          startIso: line.reservationStart!,
          endIso: line.reservationEnd!,
          quantity: line.quantity,
          isAdmin: isStaffCheckout,
          ignoreReservationId: existingReservationId,
        })
      }
    }

    const price = resolveLinePrice(
      line.catalogItemId,
      line.unitPriceOverride
    )
    const subtotal = price * line.quantity
    orderSubtotal += subtotal
    if (catalogItem) catalogItemsForShipping.push(catalogItem)

    const clientLineKey =
      line.clientLineKey || `${line.catalogItemId}:${processedLines.length}`
    processedLines.push({
      site_id: siteId,
      catalog_item_id: line.catalogItemId,
      name: catalogItem?.name || "Unknown Item",
      description: catalogItem?.description,
      currency: line.saleOrderItemId && line.unitPriceOverride !== undefined
        ? existingCurrency!.currency : resolveProductCurrency(
        selfServicePricing?.priceByItemId.has(line.catalogItemId) ? selfServicePricing.currencyBySiteId.get(siteId) : catalogItem?.currency,
        siteSettings?.currency
      ),
      quantity: line.quantity,
      unit_price: price,
      subtotal,
      is_reservation_dropin: Boolean(
        catalogItem?.is_reservation && !isAccessOnly
      ),
      reservationStart: line.reservationStart,
      reservationEnd: line.reservationEnd,
      isRoundRobinDropin,
      client_line_key: clientLineKey,
      parent_client_line_key: null,
      modifier_group_id: null,
      parent_name:
        catalogItem?.parent?.name &&
        catalogItem.parent.name !== catalogItem?.name
          ? catalogItem.parent.name
          : null,
    })

    for (const modifier of line.modifiers || []) {
      const modifierQuantity = modifier.quantity * line.quantity
      const modifierItem = catalogItems.get(modifier.catalogItemId)
      const modifierPrice = resolveLinePrice(
        modifier.catalogItemId,
        modifier.unitPriceOverride
      )
      const modifierSubtotal = modifierPrice * modifierQuantity
      orderSubtotal += modifierSubtotal
      processedLines.push({
        site_id: siteId,
        catalog_item_id: modifier.catalogItemId,
        name: modifierItem?.name || "Extra",
        description: modifierItem?.description,
        currency: modifier.saleOrderItemId && modifier.unitPriceOverride !== undefined
          ? existingCurrency!.currency : resolveProductCurrency(
           selfServicePricing?.priceByItemId.has(modifier.catalogItemId) ? selfServicePricing.currencyBySiteId.get(siteId) : modifierItem?.currency || catalogItem?.currency,
          siteSettings?.currency
        ),
        quantity: modifierQuantity,
        unit_price: modifierPrice,
        subtotal: modifierSubtotal,
        is_reservation_dropin: false,
        reservationStart: undefined,
        reservationEnd: undefined,
        isRoundRobinDropin: false,
        client_line_key: `${clientLineKey}:mod:${modifier.groupId || "g"}:${modifier.catalogItemId}`,
        parent_client_line_key: clientLineKey,
        modifier_group_id: modifier.groupId || null,
        parent_name: null,
      })
    }
  }

  const orderCurrency = existingCurrency?.currency || resolveCheckoutOrderCurrency(
    processedLines,
    siteSettings?.currency
  )
  if (checkoutLinesNeedFxConversion(processedLines, orderCurrency)) {
    const { rates } = await getUsdFxRates()
    const normalized = normalizeCheckoutLinesToCurrency(
      processedLines,
      orderCurrency,
      rates
    )
    processedLines.length = 0
    processedLines.push(...normalized.lines)
    orderSubtotal = normalized.subtotal
  }

  const { data: taxesByItem } = selfServicePricing ? { data: selfServicePricing.taxesByItem } : await getTaxesByCatalogItemIds(
    siteId,
    processedLines.map((line) => line.catalog_item_id)
  )
  const orderTaxTotal = calculateOrderTaxTotal(
    processedLines.map((line) => ({
      catalogItemId: line.catalog_item_id,
      subtotal: line.subtotal,
    })),
    taxesByItem || {}
  )

  let orderShippingCost = 0
  if (fulfillment === "ship") {
    const { resolveOrderShippingCost } = await import("./delivery-options")
    orderShippingCost = resolveOrderShippingCost(
      fulfillment,
      orderSubtotal,
      siteSettings?.shop?.free_shipping_threshold,
      siteSettings?.shop?.shipping_cost,
      catalogItemsForShipping
    )
  }

  return {
    processedLines: allocateCheckoutBackorders(processedLines, checkoutStock),
    orderSubtotal,
    orderTaxTotal,
    orderShippingCost,
    orderCurrency,
  }
}
