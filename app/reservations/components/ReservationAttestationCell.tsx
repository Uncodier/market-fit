"use client"

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import type { Reservation } from "@/app/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getReservationSignatureKind } from "@/app/visits/visit-helpers"
import { getReservationAttestationSignedUrl } from "../attestation-actions"

function AttestationLink({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
    >
      {label}
    </button>
  )
}

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

  const signatureKind = getReservationSignatureKind(reservation)
  const hasTerms = Boolean(reservation.terms_accepted_at)
  const hasPhoto = Boolean(reservation.photo_url)
  const hasId = Boolean(reservation.id_url)
  const hasCapturedSignature = Boolean(reservation.signature_url)
  const channelLabel =
    reservation.channel === "online"
      ? t("reservations.attestation.channelOnline")
      : reservation.channel === "physical"
        ? t("reservations.attestation.channelPhysical")
        : null
  const signatureLabel =
    signatureKind === "digital"
      ? t("reservations.attestation.signatureDigital")
      : signatureKind === "physical"
        ? t("reservations.attestation.signaturePhysical")
        : null

  const parts: ReactNode[] = []
  if (channelLabel) parts.push(<span key="channel">{channelLabel}</span>)
  if (hasTerms) parts.push(<span key="terms">{t("reservations.attestation.terms")}</span>)
  if (signatureLabel) parts.push(<span key="sig">{signatureLabel}</span>)
  if (hasPhoto) {
    parts.push(
      <AttestationLink
        key="photo"
        label={t("reservations.attestation.photo")}
        disabled={loading === "photo"}
        onClick={() => openAttestation("photo")}
      />
    )
  }
  if (hasId) {
    parts.push(
      <AttestationLink
        key="id"
        label={t("reservations.attestation.id")}
        disabled={loading === "id"}
        onClick={() => openAttestation("id")}
      />
    )
  }
  if (hasCapturedSignature) {
    parts.push(
      <AttestationLink
        key="view-sig"
        label={t("reservations.attestation.viewSignature")}
        disabled={loading === "signature"}
        onClick={() => openAttestation("signature")}
      />
    )
  }

  if (parts.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-tight text-muted-foreground">
        {parts.map((part, index) => (
          <span key={index} className="inline-flex items-center gap-1.5">
            {index > 0 ? <span className="opacity-40">·</span> : null}
            {part}
          </span>
        ))}
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
