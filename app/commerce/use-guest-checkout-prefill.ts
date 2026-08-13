"use client"

import { useEffect, useRef } from "react"
import {
  getGuestCheckoutPrefill,
  type GuestShippingAddress,
} from "@/app/commerce/device-order-storage"

type SessionLike = {
  user?: {
    email?: string
    user_metadata?: { name?: string; full_name?: string }
  }
} | null

/** Signed-in account wins; otherwise prefill from the anonymous device-order cache. */
export function useGuestCheckoutPrefill(params: {
  session: SessionLike
  isLoading?: boolean
  siteId?: string | null
  setCustomerName: (value: string) => void
  setCustomerEmail: (value: string) => void
  setShippingAddress: (value: GuestShippingAddress) => void
}) {
  const {
    session,
    isLoading = false,
    siteId,
    setCustomerName,
    setCustomerEmail,
    setShippingAddress,
  } = params
  const appliedGuest = useRef(false)

  useEffect(() => {
    if (isLoading) return

    if (session?.user) {
      const email = session.user.email || ""
      const name =
        session.user.user_metadata?.name ||
        session.user.user_metadata?.full_name ||
        ""
      if (email) setCustomerEmail(email)
      if (name) setCustomerName(name)
      return
    }

    if (appliedGuest.current) return
    const cached = getGuestCheckoutPrefill(siteId)
    if (!cached) return
    appliedGuest.current = true
    if (cached.customerName) setCustomerName(cached.customerName)
    if (cached.customerEmail) setCustomerEmail(cached.customerEmail)
    if (cached.shippingAddress) setShippingAddress(cached.shippingAddress)
  }, [isLoading, session, siteId, setCustomerName, setCustomerEmail, setShippingAddress])
}
