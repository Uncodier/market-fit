"use client"

import { useEffect, useState } from "react"
import type { Reservation } from "@/app/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { useLocalization } from "@/app/context/LocalizationContext"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { getReservationAttestationSignedUrl } from "../attestation-actions"

export function ReservationCustomerCell({
  reservation,
  siteId,
  meta,
}: {
  reservation: Reservation
  siteId: string
  meta?: string | null
}) {
  const { t } = useLocalization()
  const [visitPhotoUrl, setVisitPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!reservation.photo_url) {
      setVisitPhotoUrl(null)
      return
    }
    getReservationAttestationSignedUrl(siteId, reservation.id, "photo").then((res) => {
      if (!cancelled && res.url) setVisitPhotoUrl(res.url)
    })
    return () => {
      cancelled = true
    }
  }, [siteId, reservation.id, reservation.photo_url])

  const profileAvatar = reservation.buyer_profile?.avatar_url || null
  const avatarSrc = visitPhotoUrl || profileAvatar || undefined
  const name = reservation.lead?.name || reservation.buyer_profile?.name || t("reservations.customer.unknown")
  const email = reservation.lead?.email || null

  return (
    <div className="flex min-w-0 items-center gap-3">
      {avatarSrc ? (
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={avatarSrc} alt={name} className="object-cover" />
          <AvatarFallback className="text-[11px] font-semibold">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      ) : (
        <EntityAvatar name={name} />
      )}
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium leading-tight text-foreground">{name}</p>
        {email ? (
          <p className="truncate text-[11px] leading-tight text-muted-foreground">{email}</p>
        ) : null}
        {meta ? (
          <p className="truncate text-[11px] leading-tight text-muted-foreground/80">{meta}</p>
        ) : null}
      </div>
    </div>
  )
}
