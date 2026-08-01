"use client"

import React, { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cancelBuyerReservation, rescheduleBuyerReservation } from "@/app/buyer/reservation-actions"
import { Calendar, Clock, Download } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { ReservationSlotPicker } from "@/app/components/commerce/ReservationSlotPicker"
import QRCode from "react-qr-code"
import { downloadAccessPass } from "@/app/lib/download-access-pass"
import { resolveVenueLocation } from "@/app/catalog/product-details"
import { toast } from "sonner"

export function ReservationManagePanel({ 
  reservation, 
  schedules = [] 
}: { 
  reservation: any, 
  schedules?: any[] 
}) {
  const { t } = useLocalization()
  const router = useRouter()
  const qrRef = useRef<HTMLDivElement>(null)
  
  const [isCancelling, setIsCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ startIso: string; endIso: string } | null>(null)

  const handleDownloadPass = async () => {
    const svg = qrRef.current?.querySelector("svg")
    if (!svg) return
    setIsDownloading(true)
    try {
      const itemName =
        reservation.catalog_item?.name ||
        reservation.entitlement?.catalog_item?.name ||
        t("buyer.reservations.title") ||
        "Reservation"
      const dateLabel = new Date(reservation.start_time).toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
      const timeLabel = `${new Date(reservation.start_time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })} – ${new Date(reservation.end_time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
      const venueLoc = reservation.catalog_item
        ? resolveVenueLocation(reservation.catalog_item)
        : { name: "", address: "", city: "" }
      const venue =
        [venueLoc.name, venueLoc.city].filter(Boolean).join(" · ") ||
        reservation.site?.name ||
        undefined
      await downloadAccessPass({
        qrSvg: svg,
        title: itemName,
        brandName: reservation.site?.name || "Market Fit",
        kind: "pass",
        dateLabel,
        timeLabel,
        venueLabel: venue,
        codeLabel: reservation.id,
        footnote: t("buyer.reservations.presentQr") || "Present this QR at the entrance",
        filename: `pass-${reservation.id.slice(0, 8)}.png`,
      })
    } catch {
      toast.error(t("buyer.reservations.downloadFailed") || "Failed to download pass")
    } finally {
      setIsDownloading(false)
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    const { success, error } = await cancelBuyerReservation(reservation.id)
    setIsCancelling(false)
    if (success) {
      alert(t("buyer.reservations.cancelled") || "Reservation cancelled successfully")
      router.push("/buyer")
      router.refresh()
    } else {
      alert(error || t("buyer.reservations.failed") || "Failed to cancel")
    }
    setShowCancelConfirm(false)
  }

  const handleReschedule = async () => {
    if (!selectedSlot) return
    setIsRescheduling(true)
    const { success, error } = await rescheduleBuyerReservation({ 
      id: reservation.id, 
      startIso: selectedSlot.startIso, 
      endIso: selectedSlot.endIso 
    })
    setIsRescheduling(false)
    if (success) {
      setShowRescheduleDialog(false)
      router.refresh()
    } else {
      alert(error || t("buyer.reservations.failed") || "Failed to reschedule")
    }
  }

  const isPast = new Date(reservation.end_time) < new Date()
  const canModify = !isPast && (reservation.status === 'pending' || reservation.status === 'confirmed')

  const isCompleted = reservation.status === 'completed' || (isPast && (reservation.status === 'pending' || reservation.status === 'confirmed'))
  const statusKey = isCompleted ? 'completed' : reservation.status
  
  const statusLabel = () => {
    const key = `buyer.reservations.status.${statusKey}`
    return t(key) || statusKey
  }

  return (
    <div className="lg:sticky lg:top-32 bg-card border border-border/50 rounded-3xl p-6 lg:p-8 shadow-sm shadow-black/5 relative">
      <div className="mb-6">
        <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide mb-4 ${
          isCompleted 
            ? "bg-green-500/10 text-green-700 dark:text-green-400" 
            : statusKey === 'cancelled' 
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
        }`}>
          {statusLabel()}
        </div>
        
        <div className="flex flex-col gap-3 text-muted-foreground mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-foreground/70" />
            <span className="font-medium text-foreground">
              {new Date(reservation.start_time).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-foreground/70" />
            <span className="font-medium text-foreground">
              {new Date(reservation.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(reservation.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {(canModify || isCompleted) && statusKey !== "cancelled" && (
          <div className="flex flex-col items-center justify-center p-4 mb-6 bg-white dark:bg-background border rounded-2xl">
            <div ref={qrRef} className="relative bg-white p-3 rounded-xl shadow-sm border mb-3">
              <QRCode
                value={reservation.id}
                size={160}
                level="H"
                style={{ opacity: isCompleted ? 0.3 : 1 }}
              />
              {isCompleted && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-background/90 text-foreground font-black px-4 py-2 rounded-lg border shadow-lg text-xs tracking-widest uppercase rotate-12">
                    {t("ticket.checkedIn") || "Checked In"}
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
              {t("buyer.reservations.checkInQr") || "Check-in QR"}
            </p>
            {!isCompleted && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownloadPass}
                disabled={isDownloading}
              >
                <Download className="w-4 h-4 mr-2" />
                {isDownloading
                  ? "..."
                  : t("buyer.reservations.downloadPass") || "Download Pass"}
              </Button>
            )}
          </div>
        )}

        {canModify && (
          <div className="flex flex-col gap-3 w-full">
            <Button 
              variant="default" 
              className="w-full h-12 text-base font-semibold"
              onClick={() => setShowRescheduleDialog(true)}
            >
              {t("buyer.reservations.reschedule") || "Reschedule"}
            </Button>
            <Button 
              variant="outline" 
              className="w-full h-12 text-base font-semibold text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowCancelConfirm(true)}
            >
              {t("buyer.reservations.cancel") || "Cancel Reservation"}
            </Button>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("buyer.reservations.cancel") || "Cancel Reservation"}</DialogTitle>
            <DialogDescription>
              {t("buyer.reservations.confirmCancel") || "Are you sure you want to cancel this reservation?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)} disabled={isCancelling}>
              {t("common.back") || "Back"}
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling ? "..." : t("buyer.reservations.cancel") || "Cancel Reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("buyer.reservations.reschedule") || "Reschedule"}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <ReservationSlotPicker
              catalogItemId={reservation.catalog_item_id}
              quantity={reservation.quantity || 1}
              onSelect={(start, end) => setSelectedSlot({ startIso: start, endIso: end })}
              selectedStartIso={selectedSlot?.startIso}
              hideDetailsStep={true}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRescheduleDialog(false)} disabled={isRescheduling}>
              {t("common.back") || "Back"}
            </Button>
            <Button 
              onClick={handleReschedule} 
              disabled={!selectedSlot || isRescheduling}
            >
              {isRescheduling ? "..." : t("buyer.reservations.save") || "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}