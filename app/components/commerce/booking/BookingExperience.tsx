"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CatalogItem } from "@/app/types"
import { resolveItemImage } from "@/app/lib/image-utils"
import { ReservationSlotPicker } from "../ReservationSlotPicker"
import { Button } from "@/app/components/ui/button"
import { ArrowLeft, CheckCircle, User, Calendar, Clock, MapPin, Search } from "@/app/components/ui/icons"
import { resolveItemSpecDisplay, resolveVenueLocation } from "@/app/catalog/product-details"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { bookWithEntitlement } from "@/app/commerce/redeem-reservation"
import { toast } from "sonner"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { upsertReservation } from "@/app/reservations/actions"
import { assertReservationSlot } from "@/app/reservations/availability"
import { CommerceShellHeader } from "@/app/components/commerce/CommerceShellHeader"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { PdpMetricChips } from "@/app/components/commerce/pdp/PdpMetricChips"

interface BookingExperienceProps {
  mode: "cart" | "entitlement" | "pos" | "admin"
  item: CatalogItem
  siteId?: string
  backUrl?: string
  entitlementId?: string
  passItem?: any // for entitlement mode
  leads?: any[] // for admin mode
  onCartAdd?: (startIso: string, endIso: string, available?: number) => void // for cart mode
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
  passItem,
  leads = [],
  onCartAdd,
  onSuccess,
  headerAction,
  hideHeader = false,
}: BookingExperienceProps) {
  const { t } = useLocalization()
  const router = useRouter()
  const { user } = useAuth()
  const { formatPrice } = useDisplayCurrency()
  const session = user ? { user } : null
  const [booking, setBooking] = useState(false)

  const metadata = item.metadata || {}
  const attributes = metadata.attributes || {}
  const instructor = resolveItemSpecDisplay(item, "instructor") || resolveItemSpecDisplay(item, "host")
  const venueLocation = resolveVenueLocation(item)


  // Only used for admin mode
  const [leadValue, setLeadValue] = useState<any>(null)

  const handleSelect = async (startIso: string, endIso: string, details?: any) => {
    if (mode === "cart" || mode === "pos") {
      if (onCartAdd) {
        onCartAdd(startIso, endIso, details?.available)
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

  const imageUrl = resolveItemImage(item) || (passItem ? resolveItemImage(passItem) : null)

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
        className={`flex-1 w-full flex flex-col items-center justify-center min-h-0 overflow-y-auto overflow-x-hidden ${
          hideHeader
            ? "p-4 md:p-8"
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

        <div className="grid md:grid-cols-3 gap-8 w-full mx-auto max-w-4xl mt-4 shrink-0 pb-4">
          <div className="md:col-span-1 relative z-10 md:pr-8 md:h-[590px] overflow-y-auto no-scrollbar flex flex-col w-full mx-auto max-w-[590px]">
            <div className="space-y-6 flex flex-col items-center md:items-start text-center md:text-left my-auto py-4 md:py-8 w-full">
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
                <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-widest text-center md:text-left mb-1">
                  {mode === "entitlement" ? (t("booking.redeemTitle") || "Book with Pass") : mode === "admin" ? (t("booking.adminTitle") || "Create Reservation") : (t("booking.selectTime") || "Select a Time")}
                </h2>
                
                {passItem && (
                  <div className="mb-4">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight text-center md:text-left mb-1">
                      {passItem.name}
                    </h1>
                    <div className="text-sm font-medium text-muted-foreground text-center md:text-left">
                      {passItem.is_recurring
                        ? t("pdp.subscriptionBadge") || "Subscription"
                        : t("pdp.accessPassBadge") || "Access Pass"}
                    </div>
                  </div>
                )}
                
                {((item as any)._parent?.name || (item as any).parent?.name) && ((item as any)._parent?.name !== item.name && (item as any).parent?.name !== item.name) && (
                  <div className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider mt-3 text-center md:text-left">
                    {(item as any)._parent?.name || (item as any).parent?.name}
                  </div>
                )}
                
                {passItem ? (
                  <h3 className="text-xl font-semibold mt-1 text-center md:text-left text-muted-foreground">{item.name}</h3>
                ) : (
                  <h1 className="text-2xl font-semibold mt-1 text-center md:text-left">{item.name}</h1>
                )}
                
                {item.target_sale_price != null && item.target_sale_price > 0 && mode !== "entitlement" && (
                  <div className="mt-2 text-lg font-medium text-foreground text-center md:text-left">
                    {formatPrice(item.target_sale_price, item.currency)}
                  </div>
                )}
              </div>

              <div className="w-full">
                <PdpMetricChips
                  className="mb-4 justify-center md:justify-start"
                  chips={[
                    instructor
                      ? {
                          icon: <User className="w-4 h-4 sm:w-5 sm:h-5" />,
                          imageUrl: instructor.image_url,
                          label: instructor.name,
                        }
                      : attributes.instructor
                        ? { icon: <User className="w-4 h-4 sm:w-5 sm:h-5" />, label: attributes.instructor }
                        : null,
                    venueLocation.name
                      ? {
                          icon: <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />,
                          imageUrl: venueLocation.image_url,
                          label: venueLocation.name,
                        }
                      : null,
                    attributes.duration
                      ? { icon: <Clock className="w-4 h-4 sm:w-5 sm:h-5" />, label: attributes.duration }
                      : null,
                  ]}
                />
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
          </div>

          <div className="md:col-span-2 relative w-full overflow-visible z-0 flex justify-center md:block">
            <div className="w-full max-w-[590px] mx-auto md:w-full">
              <ReservationSlotPicker
                catalogItemId={item.id}
                layout="page"
                hideDetailsStep={mode !== "admin"} // Only admin needs the full details step natively for now
                onSelect={handleSelect}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
