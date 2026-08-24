"use client"

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from "react"
import type { BuyerGeo } from "@/app/commerce/buyer-geo"
import {
  isBuyerParticularlyClose,
  type NearbyLocationRef,
} from "@/app/commerce/buyer-location-availability"
import {
  defaultFulfillment,
  type CheckoutFulfillmentMethod,
} from "@/app/commerce/delivery-options"
import {
  defaultPaymentMethod,
  type PaymentMethodType,
} from "@/app/commerce/payment-options"

type UserChoseRef = MutableRefObject<boolean>

/**
 * Defaults shop/marketplace checkout to pickup + cash when the buyer is within
 * 500m of a store (or picked one). Parent refs survive cart panel unmount.
 */
export function useNearbyCheckoutDefaults(params: {
  allowedOptions: CheckoutFulfillmentMethod[]
  fulfillment: CheckoutFulfillmentMethod
  setFulfillment: (value: CheckoutFulfillmentMethod) => void
  availablePaymentMethods: PaymentMethodType[]
  paymentMethod: string
  setPaymentMethod: (value: string) => void
  buyerGeo?: BuyerGeo | null
  inventoryLocations?: NearbyLocationRef[] | null
  settingsLocations?: NearbyLocationRef[] | null
  selectedLocationId?: string | null
  userChoseFulfillmentRef?: UserChoseRef
  userChosePaymentRef?: UserChoseRef
}) {
  const {
    allowedOptions,
    fulfillment,
    setFulfillment,
    availablePaymentMethods,
    paymentMethod,
    setPaymentMethod,
    buyerGeo,
    inventoryLocations,
    settingsLocations,
    selectedLocationId,
  } = params

  const localFulfillmentRef = useRef(false)
  const localPaymentRef = useRef(false)
  const userChoseFulfillmentRef = params.userChoseFulfillmentRef || localFulfillmentRef
  const userChosePaymentRef = params.userChosePaymentRef || localPaymentRef

  const nearby = useMemo(
    () =>
      isBuyerParticularlyClose({
        buyerGeo,
        inventoryLocations,
        settingsLocations,
        selectedLocationId,
      }),
    [buyerGeo, inventoryLocations, settingsLocations, selectedLocationId]
  )

  const setFulfillmentByUser = useCallback(
    (value: CheckoutFulfillmentMethod) => {
      userChoseFulfillmentRef.current = true
      setFulfillment(value)
    },
    [setFulfillment, userChoseFulfillmentRef]
  )

  const setPaymentMethodByUser = useCallback(
    (value: string) => {
      userChosePaymentRef.current = true
      setPaymentMethod(value)
    },
    [setPaymentMethod, userChosePaymentRef]
  )

  useEffect(() => {
    if (allowedOptions.length === 0) return

    if (!allowedOptions.includes(fulfillment)) {
      setFulfillment(defaultFulfillment(allowedOptions, { preferPickup: nearby }) || "none")
      return
    }

    if (userChoseFulfillmentRef.current) return

    const next = defaultFulfillment(allowedOptions, { preferPickup: nearby }) || "none"
    if (next !== fulfillment) setFulfillment(next)
  }, [
    allowedOptions,
    fulfillment,
    nearby,
    setFulfillment,
    userChoseFulfillmentRef,
  ])

  useEffect(() => {
    if (availablePaymentMethods.length === 0) {
      if (paymentMethod) setPaymentMethod("")
      return
    }

    const current = paymentMethod as PaymentMethodType
    if (!paymentMethod || !availablePaymentMethods.includes(current)) {
      setPaymentMethod(
        defaultPaymentMethod(availablePaymentMethods, { preferCash: nearby }) || ""
      )
      return
    }

    if (userChosePaymentRef.current) return

    const next = defaultPaymentMethod(availablePaymentMethods, { preferCash: nearby })
    if (next && next !== paymentMethod) setPaymentMethod(next)
  }, [
    availablePaymentMethods,
    nearby,
    paymentMethod,
    setPaymentMethod,
    userChosePaymentRef,
  ])

  return { nearby, setFulfillmentByUser, setPaymentMethodByUser }
}
