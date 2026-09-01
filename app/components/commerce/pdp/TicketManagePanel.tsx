"use client"

import React, { useRef, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Calendar, Clock, Download } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import QRCode from "react-qr-code"
import { downloadAccessPass } from "@/app/lib/download-access-pass"
import { toast } from "sonner"

export function TicketManagePanel({ 
  entitlement,
  item,
  event,
  venueLocation,
  attributes
}: { 
  entitlement: any
  item: any
  event: any
  venueLocation: any
  attributes: any
}) {
  const { t } = useLocalization()
  const qrRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  
  const isUsed = entitlement.status === 'used' || entitlement.uses_remaining === 0

  const handleDownloadPass = async () => {
    const svg = qrRef.current?.querySelector("svg")
    if (!svg) return
    setIsDownloading(true)
    try {
      const code =
        entitlement.metadata?.access_token ||
        entitlement.metadata?.ticket_token ||
        entitlement.id
      await downloadAccessPass({
        qrSvg: svg,
        title: event?.name || item.name,
        brandName: item._shop?.site_name || "Market Fit",
        kind: "ticket",
        dateLabel: attributes.event_date,
        timeLabel: attributes.event_time || attributes.doors_open,
        venueLabel: [venueLocation.name, venueLocation.city].filter(Boolean).join(" · ") || undefined,
        codeLabel: code,
        footnote: t("buyer.reservations.presentQr") || "Present this QR at the entrance",
        filename: `ticket-${entitlement.id.slice(0, 8)}.png`,
      })
    } catch {
      toast.error(t("buyer.reservations.downloadFailed") || "Failed to download pass")
    } finally {
      setIsDownloading(false)
    }
  }
  
  const statusKey = isUsed ? 'used' : entitlement.status
  const statusLabel = () => {
    if (isUsed) return t("ticket.checkedIn") || "Checked In"
    if (statusKey === 'active') return t("ticket.valid") || "Valid Ticket"
    return statusKey
  }

  return (
    <div className="lg:sticky lg:top-32 bg-card border border-border/50 rounded-3xl p-6 lg:p-8 shadow-sm shadow-black/5 relative">
      <div className="mb-6">
        <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide mb-4 ${
          isUsed 
            ? "bg-muted text-muted-foreground" 
            : statusKey === 'cancelled' 
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
        }`}>
          {statusLabel()}
        </div>
        
        <div className="flex flex-col gap-3 text-muted-foreground mb-6">
          {attributes.event_date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-foreground/70" />
              <span className="font-medium text-foreground">
                {attributes.event_date}
              </span>
            </div>
          )}
          {(attributes.event_time || attributes.doors_open) && (
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-foreground/70" />
              <span className="font-medium text-foreground">
                {attributes.event_time || attributes.doors_open}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-background border rounded-2xl">
          <div ref={qrRef} className="relative bg-white p-3 rounded-xl shadow-sm border mb-3">
            <QRCode
              value={entitlement.metadata?.access_token || entitlement.metadata?.ticket_token || entitlement.id}
              size={160}
              level="H"
              style={{ opacity: isUsed ? 0.3 : 1 }}
            />
            {isUsed && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-background/90 text-foreground font-black px-4 py-2 rounded-lg border shadow-lg text-xs tracking-widest uppercase rotate-12">
                  {t("ticket.checkedIn") || "Checked In"}
                </div>
              </div>
            )}
          </div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
            {t("ticket.ticketId") || "Ticket ID"}
          </p>
          <p className="font-mono font-medium text-sm text-foreground mb-4">{entitlement.id}</p>
          {!isUsed && (
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
      </div>
    </div>
  )
}