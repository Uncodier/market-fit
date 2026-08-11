"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { Reservation } from "@/app/types"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getReservationSignatureKind } from "@/app/visits/visit-helpers"
import { getReservationAttestationSignedUrl } from "../attestation-actions"

export function ReservationAttestationCell({
  reservation,
  siteId,
}: {
  reservation: Reservation
  siteId: string
}) {
  const { t } = useLocalization()
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null)
  const [loading, setLoading] = useState<"signature" | "photo" | "id" | null>(null)

  const signatureKind = getReservationSignatureKind(reservation)
  const hasTerms = Boolean(reservation.terms_accepted_at)
  const hasPhoto = Boolean(reservation.photo_url)
  const hasId = Boolean(reservation.id_url)
  const hasCapturedSignature = Boolean(reservation.signature_url)
  const showChannel =
    reservation.channel === "online" || hasTerms || hasPhoto || hasId || hasCapturedSignature
  const hasAny = hasTerms || hasPhoto || hasId || signatureKind !== "none" || showChannel

  if (!hasAny) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const openAttestation = async (kind: "signature" | "photo" | "id") => {
    setLoading(kind)
    const res = await getReservationAttestationSignedUrl(siteId, reservation.id, kind)
    setLoading(null)
    if (res.error || !res.url) {
      toast.error(res.error || t("reservations.attestation.openError"))
      return
    }
    setPreview({
      title:
        kind === "signature"
          ? t("reservations.attestation.signaturePreview")
          : kind === "photo"
            ? t("reservations.attestation.photoPreview")
            : t("reservations.attestation.idPreview"),
      url: res.url,
    })
  }

  const signatureLabel =
    signatureKind === "digital"
      ? t("reservations.attestation.signatureDigital")
      : signatureKind === "physical"
        ? t("reservations.attestation.signaturePhysical")
        : t("reservations.attestation.signatureNone")

  return (
    <>
      <div className="flex flex-wrap gap-1.5 max-w-[220px]">
        {hasTerms && (
          <Badge variant="outline" className="text-[10px] font-normal">
            {t("reservations.attestation.terms")}
          </Badge>
        )}
        <Badge
          variant="outline"
          className="text-[10px] font-normal"
          title={
            signatureKind === "digital"
              ? t("reservations.attestation.signatureDigitalHint")
              : signatureKind === "physical"
                ? t("reservations.attestation.signaturePhysicalHint")
                : undefined
          }
        >
          {signatureLabel}
        </Badge>
        {hasPhoto && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-5 px-2 text-[10px] rounded-full"
            disabled={loading === "photo"}
            onClick={() => openAttestation("photo")}
          >
            {t("reservations.attestation.photo")}
          </Button>
        )}
        {hasId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-5 px-2 text-[10px] rounded-full"
            disabled={loading === "id"}
            onClick={() => openAttestation("id")}
          >
            {t("reservations.attestation.id")}
          </Button>
        )}
        {hasCapturedSignature && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-5 px-2 text-[10px] rounded-full"
            disabled={loading === "signature"}
            onClick={() => openAttestation("signature")}
          >
            {t("reservations.attestation.viewSignature")}
          </Button>
        )}
        {showChannel && reservation.channel && (
          <Badge variant="secondary" className="text-[10px] font-normal capitalize">
            {reservation.channel === "online"
              ? t("reservations.attestation.channelOnline")
              : t("reservations.attestation.channelPhysical")}
          </Badge>
        )}
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
          </DialogHeader>
          {preview?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.url}
              alt={preview.title}
              className="w-full rounded-lg border bg-white object-contain max-h-[420px]"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
