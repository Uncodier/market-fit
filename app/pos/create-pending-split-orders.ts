import { v4 as uuidv4 } from "uuid"
import type { RelationSelectValue } from "@/app/components/ui/relation-select"
import type { PosCartItem } from "@/app/pos/components/CartPanel"
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options"
import { planPosLeadSync } from "./lead-utils"
import { roundMoney } from "@/app/commerce/taxes"
import { enqueueCheckout, enqueueCreateLead } from "@/app/pos/local/outbox"
import { syncPosCheckout, refreshPosSyncCounts } from "@/app/pos/local/sync-engine"
import { getPosDb } from "@/app/pos/local/db"
import type { PosShippingAddress } from "@/app/pos/shipping-address"
import { requirePosPermission, isPosPermissionCurrent } from "./local/location-permission-state"

type SplitOrder = { title: string; items: PosCartItem[] }

type CreatePendingSplitOrdersParams = {
  orders: SplitOrder[]
  siteId: string
  userId: string
  sellerUserId?: string | null
  sellerName?: string | null
  leadRelationValue: RelationSelectValue
  priceListId: string
  buyerUserId?: string | null
  fulfillment: CheckoutFulfillmentMethod
  originLocationId: string
  shippingAddress?: PosShippingAddress
  promotionCode?: string
  promotionId?: string
}

async function resolveSplitLead(
  leadRelationValue: RelationSelectValue,
  siteId: string,
) {
  const plan = planPosLeadSync(leadRelationValue, uuidv4)
  if (plan.createLead) await enqueueCreateLead(siteId, { siteId, ...plan.createLead })
  return { resolvedLeadId: plan.resolvedLeadId, localLeadId: plan.localLeadId }
}

export async function createPendingSplitOrders(
  params: CreatePendingSplitOrdersParams,
) {
  const permission = requirePosPermission(params.siteId)
  const { resolvedLeadId, localLeadId } = await resolveSplitLead(
    params.leadRelationValue,
    params.siteId,
  )
  if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
  const db = getPosDb()

  for (const order of params.orders) {
    if (!isPosPermissionCurrent(permission)) throw new Error("POS access changed")
    const clientMutationId = uuidv4()
    const lines = order.items
      .filter((item) => item.cartQty > 0)
      .map((item) => ({
        catalogItemId: item.id,
        quantity: item.cartQty,
        unitPriceOverride: item.cartPrice,
        reservationStart: item.reservationStart,
        reservationEnd: item.reservationEnd,
        clientLineKey: item.lineKey || item.id,
        modifiers: (item.modifiers || []).map((modifier) => ({
          catalogItemId: modifier.catalogItemId,
          quantity: modifier.cartQty,
          unitPriceOverride: modifier.cartPrice,
          groupId: modifier.groupId,
        })),
      }))

    await enqueueCheckout(params.siteId, {
      siteId: params.siteId,
      userId: params.userId,
      sellerUserId: params.sellerUserId || undefined,
      lines,
      priceListId:
        params.priceListId !== "none" ? params.priceListId : undefined,
      leadId: resolvedLeadId || undefined,
      localLeadId: localLeadId || undefined,
      buyerUserId: params.buyerUserId || undefined,
      fulfillment: params.fulfillment,
      originLocationId: params.originLocationId,
      shippingAddress:
        params.fulfillment === "ship" ? params.shippingAddress : undefined,
      promotionCode: params.promotionCode || undefined,
      promotionId: params.promotionId || undefined,
      source: "pos",
      payments: [],
      intent: "send",
      notes: order.title.trim(),
      clientMutationId,
    })
    refreshPosSyncCounts(params.siteId)

    const amountDue = roundMoney(
      Math.max(
        0,
        order.items.reduce(
          (sum, item) =>
            sum +
            (item.cartPrice +
              (item.modifiers || []).reduce(
                (modifierSum, modifier) =>
                  modifierSum + modifier.cartPrice * modifier.cartQty,
                0,
              )) *
              item.cartQty,
          0,
        ),
      ),
    )
    const id = `local_${clientMutationId}`
    const createdAt = new Date().toISOString()
    await db.pendingOrders.put({
      id,
      site_id: params.siteId,
      status: "pending",
      created_at: createdAt,
      lead_id: resolvedLeadId,
      price_list_id:
        params.priceListId !== "none" ? params.priceListId : null,
      amount_due: amountDue,
      payment_status: "unpaid",
      raw: {
        id,
        status: "pending",
        created_at: createdAt,
        leads: null,
        amount_due: amountDue,
        payment_status: "unpaid",
        client_mutation_id: clientMutationId,
        seller_user_id: params.sellerUserId || params.userId,
        seller_name: params.sellerName || null,
        pending_sync: true,
      },
    })
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void syncPosCheckout(params.siteId, clientMutationId).catch(() => undefined)
    }
  }
}
