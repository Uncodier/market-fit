"use client"

import dynamic from "next/dynamic"
import type { Dispatch, SetStateAction } from "react"
import { DynamicQuoteFieldsModal } from "@/app/components/commerce/DynamicQuoteFieldsModal"
import { resolveUnitPriceLocal } from "@/app/pos/local/resolve-unit-price-local"
import { PosOptionsDialog } from "./PosOptionsDialog"
import { PosRequireLeadDialog } from "./PosRequireLeadDialog"
import { cartHasReservationSlot } from "@/app/pos/cart-line-utils"
import {
  buyerUserFromLeads,
  commitPosDigitalBuyer,
} from "@/app/pos/assign-digital-buyer"
import type { usePosAddItem } from "@/app/pos/hooks/use-pos-add-item"
import type { usePosCart } from "@/app/pos/hooks/use-pos-cart"
import type { usePosCatalog } from "@/app/pos/hooks/use-pos-catalog"
import type { usePosCheckout } from "@/app/pos/hooks/use-pos-checkout"
import type { usePosLead } from "@/app/pos/hooks/use-pos-lead"

const PaymentConfirmationDialog = dynamic(
  () =>
    import("./PaymentConfirmationDialog").then(
      (module) => module.PaymentConfirmationDialog,
    ),
  { ssr: false },
)
const PosReservationDialog = dynamic(
  () =>
    import("./PosReservationDialog").then(
      (module) => module.PosReservationDialog,
    ),
  { ssr: false },
)
const PosDigitalAssetDialog = dynamic(
  () =>
    import("./PosDigitalAssetDialog").then(
      (module) => module.PosDigitalAssetDialog,
    ),
  { ssr: false },
)
const PosSplitBillDialog = dynamic(
  () =>
    import("./PosSplitBillDialog").then(
      (module) => module.PosSplitBillDialog,
    ),
  { ssr: false },
)

type LeadGate = null | "promo" | "checkout" | "send"

type PosPageDialogsProps = {
  siteId?: string
  cartApi: ReturnType<typeof usePosCart>
  catalog: ReturnType<typeof usePosCatalog>
  checkout: ReturnType<typeof usePosCheckout>
  addApi: ReturnType<typeof usePosAddItem>
  leadApi: ReturnType<typeof usePosLead>
  leadGate: LeadGate
  setLeadGate: Dispatch<SetStateAction<LeadGate>>
  isSplitBillOpen: boolean
  setIsSplitBillOpen: Dispatch<SetStateAction<boolean>>
  t: (key: string) => string
}

export function PosPageDialogs({
  siteId,
  cartApi,
  catalog,
  checkout,
  addApi,
  leadApi,
  leadGate,
  setLeadGate,
  isSplitBillOpen,
  setIsSplitBillOpen,
  t,
}: PosPageDialogsProps) {
  return (
    <>
      <PaymentConfirmationDialog
        open={checkout.isPaymentDialogOpen}
        onOpenChange={checkout.setIsPaymentDialogOpen}
        totalAmount={checkout.amountDue}
        currency={cartApi.cartCurrency}
        onConfirm={checkout.handleCheckout}
        isLoading={checkout.checkoutLoading}
        hasCustomer={Boolean(cartApi.leadValue)}
      />

      <PosOptionsDialog
        item={addApi.optionsParentItem}
        open={Boolean(addApi.optionsParentItem)}
        onOpenChange={(open) => {
          if (!open) addApi.setOptionsParentItem(null)
        }}
        onConfirm={({ item, modifiers }) => {
          addApi.confirmOptions(item, modifiers)
        }}
        siteId={siteId}
        modifierGroupsByHostId={catalog.modifierGroupsByHostId}
        resolvePrice={(catalogItemId, fallbackPrice) => {
          const catalogItem = catalog.catalogItems.find(
            (item) => item.id === catalogItemId,
          )
          return resolveUnitPriceLocal({
            catalogItemId,
            targetSalePrice:
              catalogItem?.target_sale_price ?? fallbackPrice,
            priceListId:
              cartApi.priceListId === "none"
                ? undefined
                : cartApi.priceListId,
            priceLists: catalog.priceLists,
            priceListItems: catalog.priceListItems,
          }).price
        }}
      />

      <PosReservationDialog
        item={addApi.reservationItem}
        open={Boolean(addApi.reservationItem)}
        onOpenChange={(open) => {
          if (!open) addApi.setReservationItem(null)
        }}
        leads={catalog.leads}
        siteId={siteId}
        initialLeadValue={leadApi.leadRelationValue}
        onLeadUpdated={leadApi.handleLeadUpdated}
        t={t}
        onConfirm={async ({
          item,
          reservationStart,
          reservationEnd,
          reservationAvailableQty,
          leadValue,
        }) => {
          await leadApi.handleLeadValueChange(leadValue)
          addApi.confirmReservation(item, {
            reservationStart,
            reservationEnd,
            reservationAvailableQty,
          })
        }}
      />

      <PosDigitalAssetDialog
        item={addApi.digitalItem}
        open={Boolean(addApi.digitalItem)}
        modifiers={addApi.digitalModifiers}
        initialBuyerUser={buyerUserFromLeads(
          cartApi.buyerUserId,
          catalog.leads,
        )}
        onOpenChange={(open) => {
          if (!open) addApi.setDigitalItem(null)
        }}
        t={t}
        onConfirm={async ({ item, buyerUser, modifiers }) => {
          if (!siteId) return
          await commitPosDigitalBuyer({
            siteId,
            buyerUser,
            handleLeadValueChange: leadApi.handleLeadValueChange,
            setBuyerUserId: cartApi.setBuyerUserId,
            setLeads: catalog.setLeads,
          })
          addApi.confirmDigital(item, modifiers)
        }}
      />

      <DynamicQuoteFieldsModal
        item={addApi.dynamicQuoteItem}
        open={Boolean(addApi.dynamicQuoteItem)}
        onOpenChange={(open) => {
          if (!open) addApi.setDynamicQuoteItem(null)
        }}
        confirming={addApi.dynamicQuoteLoading}
        onConfirm={async ({ fieldValues, quantity }) => {
          if (!addApi.dynamicQuoteItem) return
          await addApi.requestQuote(
            addApi.dynamicQuoteItem,
            fieldValues,
            quantity,
          )
        }}
      />

      <PosRequireLeadDialog
        open={Boolean(leadGate)}
        onOpenChange={(open) => {
          if (!open) setLeadGate(null)
        }}
        leads={catalog.leads}
        siteId={siteId}
        t={t}
        purpose={
          leadGate === "promo" || !cartHasReservationSlot(cartApi.cart)
            ? "promo"
            : "reservation"
        }
        oncePerUser={
          Number(
            cartApi.appliedPromo?.usageLimitPerUser ??
              catalog.promotions.find(
                (promotion) =>
                  String(promotion.code || "").trim().toUpperCase() ===
                  cartApi.promoCode.trim().toUpperCase(),
              )?.usage_limit_per_user,
          ) === 1
        }
        onLeadUpdated={leadApi.handleLeadUpdated}
        onConfirm={async (value) => {
          const action = leadGate
          const committed = await leadApi.handleLeadValueChange(value)
          setLeadGate(null)
          if (action === "promo") {
            cartApi.validatePromotion({ leadPresent: true })
          } else if (action === "checkout") {
            checkout.initiateCheckout({ customerConfirmed: true })
          } else if (action === "send" && committed) {
            await checkout.handleSendOrder({
              customerConfirmed: true,
              leadOverride: committed,
            })
          }
        }}
      />

      <PosSplitBillDialog
        open={isSplitBillOpen}
        onOpenChange={setIsSplitBillOpen}
        originalCart={cartApi.cart}
        onConfirm={(columns) => {
          if (columns.length === 0) return
          cartApi.setCart(columns[0].items)
          if (columns[0].title !== "Order 1") {
            cartApi.setOrderNotes(columns[0].title)
          }
          const otherColumns = columns.slice(1)
          if (otherColumns.length > 0) {
            void checkout.createPendingSplitOrders(otherColumns)
          }
        }}
      />
    </>
  )
}
