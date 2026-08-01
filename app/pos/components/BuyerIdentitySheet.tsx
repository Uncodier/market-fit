"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { X, Calendar, Ticket, ShoppingCart, User } from "@/app/components/ui/icons"
import type { BuyerIdentityResolution } from "@/app/commerce/resolve-buyer-qr"

export function BuyerIdentitySheet({
  data,
  open,
  onClose
}: {
  data: BuyerIdentityResolution | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useLocalization()
  const router = useRouter()

  if (!open || !data) return null

  const handleAddToPos = () => {
    // Navigate to POS with leadId and buyerUserId
    const params = new URLSearchParams()
    params.set("leadId", data.lead.id)
    params.set("buyerUserId", data.user.id)
    router.push(`/pos?${params.toString()}`)
  }

  return (
    <>
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[480px] bg-background border-l shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b flex items-center justify-between p-4 md:p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0 border">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{data.user.name}</h2>
              <p className="text-sm text-muted-foreground">{data.user.email}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 md:p-6 flex flex-col gap-8">
          
          {/* Action */}
          <div className="bg-card border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div>
              <p className="font-medium">{t("pos.checkIn.identity.posAction") || "Start a sale"}</p>
              <p className="text-sm text-muted-foreground">
                {t("pos.checkIn.identity.posDesc") || "Attach customer to the cart"}
              </p>
            </div>
            <Button onClick={handleAddToPos} className="w-full sm:w-auto">
              {t("pos.checkIn.identity.addToPos") || "Add to POS"}
            </Button>
          </div>

          {/* Reservations */}
          {data.reservations && data.reservations.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                {t("pos.checkIn.identity.reservations") || "Upcoming reservations"}
              </h3>
              <div className="grid gap-3">
                {data.reservations.map((res: any) => (
                  <div key={res.id} className="border rounded-lg p-3 text-sm flex justify-between items-center bg-card">
                    <div>
                      <p className="font-medium">{res.catalog_item?.name || "Reservation"}</p>
                      <p className="text-muted-foreground">
                        {new Date(res.start_time).toLocaleString(undefined, { 
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tickets / Passes */}
          {data.tickets && data.tickets.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <Ticket className="w-5 h-5 text-muted-foreground" />
                {t("pos.checkIn.identity.tickets") || "Active tickets & passes"}
              </h3>
              <div className="grid gap-3">
                {data.tickets.map((tix: any) => (
                  <div key={tix.id} className="border rounded-lg p-3 text-sm flex justify-between items-center bg-card">
                    <div>
                      <p className="font-medium">{tix.catalog_item?.name || "Pass"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Orders */}
          {data.orders && data.orders.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                {t("pos.checkIn.identity.orders") || "Recent orders"}
              </h3>
              <div className="grid gap-3">
                {data.orders.map((ord: any) => (
                  <div key={ord.id} className="border rounded-lg p-3 text-sm flex justify-between items-center bg-card">
                    <div>
                      <p className="font-medium uppercase text-xs text-muted-foreground mb-1">
                        {ord.public_id || ord.id.slice(0, 8)}
                      </p>
                      <p>
                        {new Date(ord.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
