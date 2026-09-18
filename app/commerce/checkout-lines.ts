import { assertCanSell } from "@/app/catalog/sell-availability"
import {
  isAccessOnlyItem,
  shouldSkipVariantSelectionForCheckoutLine,
} from "@/app/catalog/product-details"
import { getTaxesByCatalogItemIds } from "@/app/catalog/tax-actions"
import { assertCommerceReservationSlot } from "./pass-round-robin-server"
import { isRoundRobinPass } from "./pass-round-robin"
import { resolveUnitPrice } from "@/app/price-lists/actions"
import { getUsdFxRates } from "@/app/lib/fx-rates"
import {
  checkoutLinesNeedFxConversion,
  normalizeCheckoutLinesToCurrency,
  resolveCheckoutOrderCurrency,
  resolveProductCurrency,
} from "./checkout-currency"
import { calculateOrderTaxTotal } from "./taxes"
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
  siteSettings: any
  finalPriceListId?: string
  priceListChannel: any
  finalLeadId?: string
  originLocationId?: string
  existingReservationId?: string
  effectiveExistingOrderId?: string
  fulfillment: CheckoutCartParams["fulfillment"]
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
    originLocationId,
    existingReservationId,
    effectiveExistingOrderId,
    fulfillment,
  } = params
  const queryClient = isAdmin ? supabaseAdmin : supabase
  let orderSubtotal = 0
  const processedLines: ProcessedCheckoutLine[] = []
  const catalogItemsForShipping: Partial<
    import("@/app/types").CatalogItem
  >[] = []

  const resolveLinePrice = async (
    catalogItemId: string,
    unitPriceOverride?: number
  ) => {
    if (unitPriceOverride !== undefined) return unitPriceOverride
    const { price } = await resolveUnitPrice(
      siteId,
      catalogItemId,
      finalPriceListId,
      isAdmin,
      priceListChannel
    )
    return price || 0
  }

  for (const line of lines) {
    await assertCanSell(
      siteId,
      line.catalogItemId,
      line.quantity,
      originLocationId,
      isAdmin,
      {
        skipVariantSelection: shouldSkipVariantSelectionForCheckoutLine({
          existingReservationId,
          reservationStart: line.reservationStart,
        }),
      }
    )

    const { data: catalogItem } = await queryClient
      .from("catalog_items")
      .select(
        "id, name, description, is_recurring, kind, digital_subtype, is_reservation, redeem_assignment_mode, currency, metadata, target_sale_price, parent_id, parent:parent_id(name)"
      )
      .eq("id", line.catalogItemId)
      .single()
    const isAccessOnly = isAccessOnlyItem({
      is_recurring: Boolean(catalogItem?.is_recurring),
      kind: catalogItem?.kind,
      digital_subtype: catalogItem?.digital_subtype,
      redeem_assignment_mode: catalogItem?.redeem_assignment_mode,
    } as any)

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
        const { data: parentItem } = await queryClient
          .from("catalog_items")
          .select("redeem_assignment_mode")
          .eq("id", catalogItem.parent_id)
          .single()
        if (parentItem?.redeem_assignment_mode === "round_robin") {
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

    const price = await resolveLinePrice(
      line.catalogItemId,
      line.unitPriceOverride
    )
    const subtotal = price * line.quantity
    orderSubtotal += subtotal
    if (catalogItem) catalogItemsForShipping.push(catalogItem as any)

    const clientLineKey =
      line.clientLineKey || `${line.catalogItemId}:${processedLines.length}`
    processedLines.push({
      site_id: siteId,
      catalog_item_id: line.catalogItemId,
      name: catalogItem?.name || "Unknown Item",
      description: catalogItem?.description,
      currency: resolveProductCurrency(
        catalogItem?.currency,
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
      if (!modifier.catalogItemId || !(modifier.quantity > 0)) continue
      const modifierQuantity = modifier.quantity * line.quantity
      await assertCanSell(
        siteId,
        modifier.catalogItemId,
        modifierQuantity,
        originLocationId,
        isAdmin,
        { skipVariantSelection: true }
      )
      const { data: modifierItem } = await queryClient
        .from("catalog_items")
        .select("name, description, currency")
        .eq("id", modifier.catalogItemId)
        .single()
      const modifierPrice = await resolveLinePrice(
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
        currency: resolveProductCurrency(
          modifierItem?.currency || catalogItem?.currency,
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

  const orderCurrency = resolveCheckoutOrderCurrency(
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

  const { data: taxesByItem } = await getTaxesByCatalogItemIds(
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
    processedLines,
    orderSubtotal,
    orderTaxTotal,
    orderShippingCost,
    orderCurrency,
  }
}
