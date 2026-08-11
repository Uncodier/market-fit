"use client"

import { useEffect, useState } from "react"
import type { Reservation } from "@/app/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getReservationAttestationSignedUrl } from "../attestation-actions"

function initials(name?: string | null) {
  if (!name?.trim()) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("")
}

export function ReservationCustomerCell({
  reservation,
  siteId,
}: {
  reservation: Reservation
  siteId: string
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
  const email = reservation.lead?.email || t("reservations.customer.noEmail")

  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar className="h-9 w-9 shrink-0">
        {avatarSrc ? <AvatarImage src={avatarSrc} alt={name} className="object-cover" /> : null}
        <AvatarFallback className="text-xs bg-primary/10">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>
    </div>
  )
}
