"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { CatalogItem } from "@/app/types"
import { resolveItemImage } from "@/app/lib/image-utils"
import { ReservationSlotPicker } from "../ReservationSlotPicker"
import { Button } from "@/app/components/ui/button"
import { ArrowLeft, CheckCircle } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { bookWithEntitlement } from "@/app/commerce/redeem-reservation"
import { toast } from "sonner"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { upsertReservation } from "@/app/reservations/actions"
import { assertReservationSlot } from "@/app/reservations/availability"

interface BookingExperienceProps {
  mode: "cart" | "entitlement" | "pos" | "admin"
  item: CatalogItem
  siteId?: string
  backUrl?: string
  entitlementId?: string
  leads?: any[] // for admin mode
  onCartAdd?: (startIso: string, endIso: string) => void // for cart mode
  onSuccess?: () => void
  headerAction?: React.ReactNode
  hideHeader?: boolean
}

export function BookingExperience({
  mode,
  item,
  siteId,
  backUrl,
  entitlementId,
  leads = [],
  onCartAdd,
  onSuccess,
  headerAction,
  hideHeader = false,
}: BookingExperienceProps) {
  const { t } = useLocalization()
  const router = useRouter()
  const [booking, setBooking] = useState(false)

  // Only used for admin mode
  const [leadValue, setLeadValue] = useState<any>(null)

  const handleSelect = async (startIso: string, endIso: string, details?: any) => {
    if (mode === "cart" || mode === "pos") {
      if (onCartAdd) {
        onCartAdd(startIso, endIso)
      }
      return
    }

    if (mode === "entitlement") {
      if (!entitlementId) return
      setBooking(true)
      try {
        await bookWithEntitlement({
          entitlementId,
          reservableCatalogItemId: item.id,
          startIso,
          endIso,
          quantity: 1
        })
        toast.success(t("booking.confirmed") || "Reservation confirmed")
        if (onSuccess) onSuccess()
        if (backUrl) router.push(backUrl)
      } catch (error: any) {
        toast.error(error.message || "Failed to book")
      } finally {
        setBooking(false)
      }
      return
    }

    if (mode === "admin") {
      if (!siteId) return
      if (!leadValue || leadValue.mode !== "existing") {
        toast.error("Please select a customer")
        return
      }
      setBooking(true)
      try {
        await assertReservationSlot(siteId, item.id, startIso, endIso, 1, true)
        const res = await upsertReservation({
          site_id: siteId,
          catalog_item_id: item.id,
          lead_id: leadValue.id,
          start_time: startIso,
          end_time: endIso,
          notes: details?.notes,
          status: 'confirmed'
        })
        if (res.error) throw new Error(res.error)
        toast.success("Reservation created successfully")
        if (onSuccess) onSuccess()
        if (backUrl) router.push(backUrl)
      } catch (error: any) {
        toast.error(error.message || "Failed to create reservation")
      } finally {
        setBooking(false)
      }
    }
  }

  const imageUrl = resolveItemImage(item)

  return (
    <div className={`flex-1 flex flex-col ${hideHeader ? "" : "bg-muted/20"}`}>
      {!hideHeader && (
        <header className={mode === "entitlement" ? "absolute top-20 left-0 right-0 z-40 bg-transparent h-16 flex items-center justify-center px-4 md:px-8" : (mode === "pos" || mode === "admin") ? "absolute top-16 left-0 right-0 z-40 bg-background border-b h-16 flex items-center justify-center px-4 md:px-8" : "absolute top-0 left-0 right-0 z-40 bg-background border-b h-16 flex items-center justify-center px-4 md:px-8"}>
          <div className="w-full max-w-7xl flex items-center justify-between">
            <div className="flex items-center">
              {backUrl && (
                <Button variant="ghost" size="sm" className="rounded-full pr-4 mr-4" onClick={() => router.push(backUrl)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  <span className="font-medium">{t("booking.back") || "Back"}</span>
                </Button>
              )}
              <h1 className="text-lg font-bold tracking-tight">
                {mode === "entitlement" ? (t("booking.redeemTitle") || "Book with Pass") : 
                 mode === "admin" ? (t("booking.adminTitle") || "Create Reservation") : 
                 (t("booking.selectTime") || "Select a Time")}
              </h1>
            </div>
            {headerAction && (
              <div className="flex items-center gap-2">
                {headerAction}
              </div>
            )}
          </div>
        </header>
      )}

      <main className={`flex-1 w-full flex flex-col ${hideHeader ? "p-0" : "max-w-7xl mx-auto p-4 md:p-8 pt-24 md:pt-28"}`}>
        {booking && (
          <div className="fixed inset-0 z-50 bg-background/50 backdrop-blur-sm flex items-center justify-center">
            <div className="px-6 py-4 bg-card border rounded-full shadow-2xl font-bold text-lg flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              {t("booking.processing") || "Processing..."}
            </div>
          </div>
        )}

        <div className="mb-8">
        <div className="bg-card border rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {imageUrl ? (
            <img src={imageUrl} alt={item.name} className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl object-cover bg-muted shrink-0" />
          ) : (
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-muted shrink-0 flex items-center justify-center">
              <span className="text-muted-foreground font-medium text-sm">{t("booking.noImage") || "No Image"}</span>
            </div>
          )}
          <div className="flex-1">
            {mode === "entitlement" && (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full mb-3">
                <CheckCircle className="w-3.5 h-3.5" />
                {t("booking.usingPass") || "Using Pass"}
              </div>
            )}
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">{item.name}</h2>
            <p className="text-muted-foreground line-clamp-2 max-w-2xl text-sm">
              {item.description || (t("booking.serviceDesc") || "Select a time for this service.")}
            </p>
          </div>
        </div>
        </div>

        {mode === "admin" && (
          <div className="mb-8 bg-card border rounded-3xl p-6 shadow-sm max-w-3xl">
            <h3 className="text-lg font-bold mb-4">{t("booking.customerDetails") || "Customer Details"}</h3>
            <RelationSelect 
              options={leads.map((l: any) => ({ id: l.id, label: l.name || l.email }))}
              value={leadValue} 
              onValueChange={setLeadValue}
              placeholder={t("booking.selectCustomer") || "Select customer..."}
              emptyMessage={t("booking.noCustomers") || "No customers found"}
            />
          </div>
        )}

        <div className="flex-1 w-full">
          <ReservationSlotPicker
            catalogItemId={item.id}
            layout="page"
            hideDetailsStep={mode !== "admin"} // Only admin needs the full details step natively for now
            onSelect={handleSelect}
          />
        </div>
      </main>
    </div>
  )
}
