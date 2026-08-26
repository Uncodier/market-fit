"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { Reservation } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { PaymentConfirmationDialog } from "@/app/pos/components/PaymentConfirmationDialog"
import {
  getReservationPaymentContext,
  recordReservationPayment,
} from "../sale-order-actions"

export function ReservationPaymentDialog({
  reservation,
  siteId,
  open,
  onOpenChange,
  onSuccess,
}: {
  reservation: Reservation | null
  siteId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { t } = useLocalization()
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [amountDue, setAmountDue] = useState(0)
  const [currency, setCurrency] = useState<string | null>(null)
  const [hasCustomer, setHasCustomer] = useState(false)

  useEffect(() => {
    if (!open || !reservation || !siteId) {
      setLoading(true)
      setAmountDue(0)
      return
    }
    let cancelled = false
    setLoading(true)
    setAmountDue(0)
    void getReservationPaymentContext(siteId, reservation.id).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.error || !result.data) {
        toast.error(result.error || t("reservations.toast.paymentLoadFailed") || "Failed to load payment")
        onOpenChange(false)
        return
      }
      if (result.data.amountDue <= 0) {
        toast.success(t("reservations.toast.alreadyPaid") || "This reservation is already paid")
        onOpenChange(false)
        onSuccess()
        return
      }
      setAmountDue(result.data.amountDue)
      setCurrency(result.data.currency || null)
      setHasCustomer(result.data.hasCustomer)
    })
    return () => {
      cancelled = true
    }
    // Load once when the dialog opens for this reservation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservation?.id, siteId])

  const handleConfirm = async (
    payments: { method: string; amount: number; tendered: number; change: number }[],
    _promo?: string,
    intent?: "complete" | "pay" | "send",
  ) => {
    if (!reservation) return
    setConfirming(true)
    try {
      const result = await recordReservationPayment({
        siteId,
        reservationId: reservation.id,
        payments,
        intent,
      })
      if (result.error) throw new Error(result.error)
      toast.success(t("reservations.toast.paymentRegistered") || "Payment registered successfully")
      onOpenChange(false)
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || t("reservations.toast.paymentFailed") || "Failed to register payment")
    } finally {
      setConfirming(false)
    }
  }

  return (
    <PaymentConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      totalAmount={amountDue}
      currency={currency}
      onConfirm={handleConfirm}
      isPreparing={loading}
      isLoading={confirming}
      hasCustomer={hasCustomer}
    />
  )
}
