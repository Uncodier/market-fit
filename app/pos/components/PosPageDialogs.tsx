"use client"

import dynamic from "next/dynamic"
import { createContext, useContext, useEffect } from "react"
import type { Dispatch, SetStateAction } from "react"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { isAccessOnlyItem } from "@/app/catalog/product-details"
import { DynamicQuoteFieldsModal } from "@/app/components/commerce/DynamicQuoteFieldsModal"
import { resolveUnitPriceLocal } from "@/app/pos/local/resolve-unit-price-local"
import { PosOptionsDialog } from "./PosOptionsDialog"
import { PosRequireLeadDialog } from "./PosRequireLeadDialog"
import { PaymentDialogSkeleton } from "./payment-dialog-skeleton"
import { PaymentCashRegisterDialog } from "../register/CashRegisterOptions"
import { resolveSiteCurrency } from "@/app/commerce/checkout-currency"
import {
  scheduleDialogChunkWarming,
  warmSelectedReservationAvailability,
} from "./pos-dialog-preload"
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

type LoadingDialog = {
  title: string
  cancelLabel: string
  loadingLabel: string
  onOpenChange: (open: boolean) => void
  size: "md" | "lg" | "xl"
  payment?: boolean
}

// next/dynamic's loading component receives loading state, not the dialog props.
const LoadingDialogContext = createContext<LoadingDialog | null>(null)

function PosDialogLoading() {
  const dialog = useContext(LoadingDialogContext)
  if (!dialog) return null
  return (
    <Dialog open onOpenChange={dialog.onOpenChange}>
      <DialogContent size={dialog.size}>
        <DialogHeader>
          <DialogTitle>{dialog.title}</DialogTitle>
          <DialogDescription role="status">{dialog.loadingLabel}</DialogDescription>
        </DialogHeader>
        <DialogBody aria-busy="true">
          {dialog.payment ? (
            <PaymentDialogSkeleton />
          ) : (
            <div className="space-y-4" aria-hidden="true">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => dialog.onOpenChange(false)}
          >
            {dialog.cancelLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const PaymentConfirmationDialog = dynamic(
  () =>
    import("./PaymentConfirmationDialog").then(
      (module) => module.PaymentConfirmationDialog,
    ),
  { ssr: false, loading: PosDialogLoading },
)
const PosReservationDialog = dynamic(
  () =>
    import("./PosReservationDialog").then(
      (module) => module.PosReservationDialog,
    ),
  { ssr: false, loading: PosDialogLoading },
)
const PosDigitalAssetDialog = dynamic(
  () =>
    import("./PosDigitalAssetDialog").then(
      (module) => module.PosDigitalAssetDialog,
    ),
  { ssr: false, loading: PosDialogLoading },
)
const PosSplitBillDialog = dynamic(
  () =>
    import("./PosSplitBillDialog").then(
      (module) => module.PosSplitBillDialog,
    ),
  { ssr: false, loading: PosDialogLoading },
)

// Keep literal imports inside each dynamic loader above for Next's chunk mapping.
const dialogChunkLoaders = [
  () => import("./PaymentConfirmationDialog"),
  () => import("./PosReservationDialog"),
  () => import("./PosDigitalAssetDialog"),
  () => import("./PosSplitBillDialog"),
]

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
  useEffect(() => scheduleDialogChunkWarming(dialogChunkLoaders), [])
  const selectedReservationId = addApi.reservationItem?.id ??
    (addApi.optionsParentItem?.is_reservation && !isAccessOnlyItem(addApi.optionsParentItem)
      ? addApi.optionsParentItem.id
      : undefined)
  useEffect(() => {
    if (!siteId || !selectedReservationId) return
    return warmSelectedReservationAvailability(selectedReservationId)
  }, [siteId, selectedReservationId])

  const translate = (key: string, fallback: string) => {
    const value = t(key)
    return !value || value === key ? fallback : value
  }
  const loadingLabels = {
    cancelLabel: translate("common.cancel", "Cancel"),
    loadingLabel: translate("common.loading", "Loading..."),
  }

  return (
    <>
      {checkout.isPaymentDialogOpen && cartApi.sessionReady &&
        (cartApi.loadingOrder || cartApi.cart.length > 0) && (
        <LoadingDialogContext.Provider
          value={{
            ...loadingLabels,
            title: translate("pos.payment.title", "Complete Payment"),
            size: "xl",
            payment: true,
            onOpenChange: checkout.setIsPaymentDialogOpen,
          }}
        >
          <PaymentConfirmationDialog
            key={`${siteId}:${cartApi.activeOrderId}`}
            open={checkout.isPaymentDialogOpen}
            onOpenChange={checkout.setIsPaymentDialogOpen}
            totalAmount={checkout.amountDue}
            currency={cartApi.cartCurrency}
            onConfirm={checkout.handleCheckout}
            isLoading={checkout.checkoutLoading}
            isPreparing={cartApi.loadingOrder}
            onContinueSelling={() => {
              checkout.setIsPaymentDialogOpen(false)
              void cartApi.resetToNewOrder()
            }}
            hasCustomer={Boolean(cartApi.leadValue)}
          >
            <PaymentCashRegisterDialog
              open={checkout.isRegisterDialogOpen}
              onOpenChange={checkout.setIsRegisterDialogOpen}
              siteId={siteId}
              locationId={cartApi.originLocationId}
              onLocationChange={cartApi.setOriginLocationId}
              locations={catalog.locations}
              currency={resolveSiteCurrency(cartApi.cartCurrency)}
            />
          </PaymentConfirmationDialog>
        </LoadingDialogContext.Provider>
      )}

      <PosOptionsDialog
        catalogItems={catalog.catalogItems}
        getAvailability={cartApi.getItemAvailability}
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

      {addApi.reservationItem && (
        <LoadingDialogContext.Provider
          value={{
            ...loadingLabels,
            title: `${addApi.reservationItem.name} - ${translate("pos.reservation.title", "Book service")}`,
            size: "lg",
            onOpenChange: (open) => { if (!open) addApi.setReservationItem(null) },
          }}
        >
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
        </LoadingDialogContext.Provider>
      )}

      {addApi.digitalItem && (
        <LoadingDialogContext.Provider
          value={{
            ...loadingLabels,
            title: `${addApi.digitalItem.name} - ${translate("pos.digital.title", "Assign buyer")}`,
            size: "md",
            onOpenChange: (open) => { if (!open) addApi.setDigitalItem(null) },
          }}
        >
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
        </LoadingDialogContext.Provider>
      )}

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

      {isSplitBillOpen && (
        <LoadingDialogContext.Provider
          value={{
            ...loadingLabels,
            title: translate("pos.cart.splitTitle", "Split Bill"),
            size: "xl",
            onOpenChange: setIsSplitBillOpen,
          }}
        >
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
        </LoadingDialogContext.Provider>
      )}
    </>
  )
}
