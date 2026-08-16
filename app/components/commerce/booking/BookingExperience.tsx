"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CatalogItem } from "@/app/types"
import { resolveItemImage } from "@/app/lib/image-utils"
import { ReservationSlotPicker } from "../ReservationSlotPicker"
import { Button } from "@/app/components/ui/button"
import { ArrowLeft, CheckCircle, User } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { bookWithEntitlement } from "@/app/commerce/redeem-reservation"
import { toast } from "sonner"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { upsertReservation } from "@/app/reservations/actions"
import { assertReservationSlot } from "@/app/reservations/availability"
import { CommerceShellHeader } from "@/app/components/commerce/CommerceShellHeader"

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
  const { user } = useAuth()
  const session = user ? { user } : null
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

  const title =
    mode === "entitlement"
      ? t("booking.redeemTitle") || "Book with Pass"
      : mode === "admin"
        ? t("booking.adminTitle") || "Create Reservation"
        : t("booking.selectTime") || "Select a Time"

  const backLabel = t("booking.back") || "Back"

  // Standalone commerce surfaces (shop / marketplace) use the floating pill header.
  // POS / admin sit under the seller TopBar and keep the compact sub-header.
  const useShellHeader = !hideHeader && (mode === "cart" || mode === "entitlement")

  const shellActions = headerAction ? (
    <div className="flex items-center gap-2">{headerAction}</div>
  ) : session ? (
    <div className="flex items-center gap-2 shrink-0">
      {session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture ? (
        <img
          src={session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture}
          alt="Avatar"
          className="w-8 h-8 min-w-8 rounded-full object-cover border border-border shadow-sm shrink-0"
        />
      ) : (
        <div className="w-8 h-8 min-w-8 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm shrink-0">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  ) : (
    <div />
  )

  return (
    <div className={`flex-1 flex flex-col ${hideHeader ? "" : "bg-muted/30 min-h-screen"}`}>
      {useShellHeader && (
        <>
          <div className="h-4 w-full shrink-0" />
          <CommerceShellHeader
            brand={
              backUrl ? (
                <Link
                  href={backUrl}
                  className="flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  <span className="font-medium">{backLabel}</span>
                </Link>
              ) : (
                <div />
              )
            }
            center={
              <span className="font-black text-xl tracking-tight uppercase truncate">
                {title}
              </span>
            }
            actions={shellActions}
          />
        </>
      )}

      {!hideHeader && !useShellHeader && (
        <header
          className={
            mode === "pos" || mode === "admin"
              ? "absolute top-16 left-0 right-0 z-40 bg-background border-b h-16 flex items-center justify-center px-4 md:px-8"
              : "absolute top-0 left-0 right-0 z-40 bg-background border-b h-16 flex items-center justify-center px-4 md:px-8"
          }
        >
          <div className="w-full max-w-7xl flex items-center justify-between">
            <div className="flex items-center">
              {backUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full pr-4 mr-4"
                  onClick={() => router.push(backUrl)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  <span className="font-medium">{backLabel}</span>
                </Button>
              )}
              <h1 className="text-lg font-bold tracking-tight">{title}</h1>
            </div>
            {headerAction && (
              <div className="flex items-center gap-2">{headerAction}</div>
            )}
          </div>
        </header>
      )}

      <main
        className={`flex-1 w-full flex flex-col items-center justify-center ${
          hideHeader
            ? "p-4"
            : useShellHeader
              ? "max-w-5xl mx-auto p-4 md:p-8"
              : "max-w-5xl mx-auto p-4 md:p-8 pt-24 md:pt-28"
        }`}
      >
        {booking && (
          <div className="fixed inset-0 z-50 bg-background/50 backdrop-blur-sm flex items-center justify-center">
            <div className="px-6 py-4 bg-card border rounded-full shadow-2xl font-bold text-lg flex items-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              {t("booking.processing") || "Processing..."}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8 w-full mx-auto max-w-4xl mt-4">
          <div className="md:col-span-1 space-y-6 flex flex-col justify-center items-center md:items-start text-center md:text-left relative z-10 md:-mr-8 md:pr-8">
            <div className="space-y-4 flex flex-col items-center md:items-start w-full">
              {imageUrl ? (
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full border border-primary/10 overflow-hidden shadow-sm shrink-0 mb-2">
                  <img src={imageUrl} alt={item.name} className="w-full h-full object-cover object-center bg-muted" />
                </div>
              ) : (
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center shadow-sm mb-2">
                  <span className="text-muted-foreground font-medium text-xs">{t("booking.noImage") || "No Image"}</span>
                </div>
              )}
              
              <div className="w-full">
                {mode === "entitlement" && (
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-3">
                    <CheckCircle className="w-3 h-3" />
                    {t("booking.usingPass") || "Using Pass"}
                  </div>
                )}
                <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-widest text-center md:text-left">
                  {mode === "entitlement" ? (t("booking.redeemTitle") || "Book with Pass") : mode === "admin" ? (t("booking.adminTitle") || "Create Reservation") : (t("booking.selectTime") || "Select a Time")}
                </h2>
                <h1 className="text-2xl font-semibold mt-1 text-center md:text-left">{item.name}</h1>
              </div>

              {item.description && (
                <p className="text-muted-foreground text-sm leading-relaxed text-center md:text-left w-full">
                  {item.description}
                </p>
              )}
            </div>

            {mode === "admin" && (
              <div className="w-full pt-4 mt-2 flex flex-col justify-center md:justify-start">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">{t("booking.customerDetails") || "Customer Details"}</h3>
                <RelationSelect 
                  options={leads.map((l: any) => ({ id: l.id, label: l.name || l.email }))}
                  value={leadValue} 
                  onValueChange={setLeadValue}
                  placeholder={t("booking.selectCustomer") || "Select customer..."}
                  emptyMessage={t("booking.noCustomers") || "No customers found"}
                />
              </div>
            )}
          </div>

          <div className="md:col-span-2 relative w-full overflow-visible z-0">
            <ReservationSlotPicker
              catalogItemId={item.id}
              layout="page"
              hideDetailsStep={mode !== "admin"} // Only admin needs the full details step natively for now
              onSelect={handleSelect}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
