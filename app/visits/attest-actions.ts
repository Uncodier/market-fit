"use server"

import { revalidatePath } from "next/cache"
import type { Reservation, ReservationChannel, VisitsSettings } from "@/app/types"
import {
  assertMissingVisitAttestation,
  getVisitAttestationGaps,
  hasVisitAttestationGaps,
  mergeVisitsSettings,
  reservationResourceLabel,
  resolveVisitTermsText,
  type VisitAttestationGaps,
} from "./visit-helpers"
import { requireSiteMember, requireVisitUser, uploadAttestation } from "./visit-server"

export type ReservationForVisit = {
  id: string
  site_id: string
  status: Reservation["status"]
  start_time: string
  end_time: string
  channel: ReservationChannel | null
  terms_accepted_at: string | null
  signature_url: string | null
  photo_url: string | null
  id_url: string | null
  visitorName: string
  visitorEmail: string | null
  resourceLabel: string
  durationMinutes: number
  gaps: VisitAttestationGaps
}

export type AttestReservationInput = {
  siteId: string
  reservationId: string
  termsAccepted: boolean
  acceptedTermsText?: string | null
  signatureDataUrl?: string | null
  photoDataUrl?: string | null
  idDataUrl?: string | null
}

export async function getReservationForVisit(siteId: string, reservationId: string) {
  try {
    const auth = await requireVisitUser()
    if (auth.error || !auth.user) return { error: auth.error || "Not logged in" }

    const member = await requireSiteMember(auth.supabase, siteId, auth.user.id)
    if (member.error) return { error: member.error }

    const { data: settingsRow } = await auth.supabase
      .from("settings")
      .select("visits")
      .eq("site_id", siteId)
      .maybeSingle()
    const settings = mergeVisitsSettings(settingsRow?.visits as Partial<VisitsSettings> | null)

    const { data, error } = await auth.supabase
      .from("reservations")
      .select(
        `
        id, site_id, status, start_time, end_time, channel,
        terms_accepted_at, signature_url, photo_url, id_url,
        resource_type, catalog_item_id, location_id, assignee_user_id,
        lead:leads(id, name, email, phone),
        catalog_item:catalog_items(id, name),
        location:locations(id, name)
      `
      )
      .eq("id", reservationId)
      .eq("site_id", siteId)
      .maybeSingle()

    if (error) return { error: error.message }
    if (!data) return { error: "Reservation not found" }

    let assigneeName: string | null = null
    if (data.assignee_user_id) {
      const { data: profile } = await auth.supabase
        .from("profiles")
        .select("name")
        .eq("id", data.assignee_user_id)
        .maybeSingle()
      assigneeName = profile?.name || null
    }

    const start = new Date(data.start_time).getTime()
    const end = new Date(data.end_time).getTime()
    const durationMinutes = Number.isFinite(start) && Number.isFinite(end)
      ? Math.max(1, Math.round((end - start) / 60_000))
      : settings.default_duration_minutes || 60

    const leadRaw = data.lead as
      | { name?: string | null; email?: string | null }
      | { name?: string | null; email?: string | null }[]
      | null
    const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw
    const catalogRaw = data.catalog_item as { name?: string | null } | { name?: string | null }[] | null
    const locationRaw = data.location as { name?: string | null } | { name?: string | null }[] | null
    const catalogItem = Array.isArray(catalogRaw) ? catalogRaw[0] : catalogRaw
    const location = Array.isArray(locationRaw) ? locationRaw[0] : locationRaw
    const gaps = getVisitAttestationGaps(settings, data)

    const row: ReservationForVisit = {
      id: data.id,
      site_id: data.site_id,
      status: data.status,
      start_time: data.start_time,
      end_time: data.end_time,
      channel: (data.channel as ReservationChannel | null) || "physical",
      terms_accepted_at: data.terms_accepted_at,
      signature_url: data.signature_url,
      photo_url: data.photo_url,
      id_url: data.id_url,
      visitorName: lead?.name || "Visitor",
      visitorEmail: lead?.email || null,
      resourceLabel: reservationResourceLabel({
        resource_type: data.resource_type,
        catalog_item: catalogItem,
        location,
        assignee_name: assigneeName,
      }),
      durationMinutes,
      gaps,
    }

    return { data: row, settings }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function attestReservation(input: AttestReservationInput) {
  try {
    const auth = await requireVisitUser()
    if (auth.error || !auth.user) return { error: auth.error || "Not logged in" }

    const member = await requireSiteMember(auth.supabase, input.siteId, auth.user.id)
    if (member.error) return { error: member.error }

    const { data: reservation, error: loadError } = await auth.supabase
      .from("reservations")
      .select(
        "id, site_id, status, channel, terms_accepted_at, signature_url, photo_url, id_url, terms_text"
      )
      .eq("id", input.reservationId)
      .eq("site_id", input.siteId)
      .maybeSingle()

    if (loadError) return { error: loadError.message }
    if (!reservation) return { error: "Reservation not found" }
    if (reservation.status === "cancelled") return { error: "Reservation is cancelled" }

    const { data: settingsRow } = await auth.supabase
      .from("settings")
      .select("visits")
      .eq("site_id", input.siteId)
      .maybeSingle()
    const settings = mergeVisitsSettings(settingsRow?.visits as Partial<VisitsSettings> | null)

    const gaps = getVisitAttestationGaps(settings, reservation)
    if (!hasVisitAttestationGaps(gaps)) {
      return { error: "Reservation already has all required visitor attestation" }
    }

    const channel: ReservationChannel = (reservation.channel as ReservationChannel) || "physical"
    const attestationError = assertMissingVisitAttestation({
      settings,
      channel,
      gaps,
      termsAccepted: input.termsAccepted || !gaps.terms,
      signatureDataUrl: input.signatureDataUrl,
      photoDataUrl: input.photoDataUrl,
      idDataUrl: input.idDataUrl,
    })
    if (attestationError) return attestationError

    const nowIso = new Date().toISOString()
    const termsText = resolveVisitTermsText(settings.terms_text, input.acceptedTermsText)

    let signatureUrl: string | null = reservation.signature_url
    let photoUrl: string | null = reservation.photo_url
    let idUrl: string | null = reservation.id_url

    if (gaps.signature && input.signatureDataUrl) {
      const up = await uploadAttestation(
        auth.supabase,
        input.siteId,
        input.reservationId,
        "signature",
        input.signatureDataUrl
      )
      if (up.error) return { error: up.error }
      signatureUrl = up.url || null
    }
    if (gaps.photo && input.photoDataUrl) {
      const up = await uploadAttestation(
        auth.supabase,
        input.siteId,
        input.reservationId,
        "photo",
        input.photoDataUrl
      )
      if (up.error) return { error: up.error }
      photoUrl = up.url || null
    }
    if (gaps.id && input.idDataUrl) {
      const up = await uploadAttestation(
        auth.supabase,
        input.siteId,
        input.reservationId,
        "id",
        input.idDataUrl
      )
      if (up.error) return { error: up.error }
      idUrl = up.url || null
    }

    const patch: Record<string, unknown> = {
      status: "completed",
      updated_at: nowIso,
    }

    if (gaps.terms) {
      patch.terms_text = termsText
      patch.terms_accepted_at = input.termsAccepted ? nowIso : null
    }
    if (gaps.signature) {
      patch.signature_url = signatureUrl
      patch.signed_at = signatureUrl ? nowIso : null
    }
    if (gaps.photo) patch.photo_url = photoUrl
    if (gaps.id) patch.id_url = idUrl

    const { data: updated, error: updateError } = await auth.supabase
      .from("reservations")
      .update(patch)
      .eq("id", input.reservationId)
      .eq("site_id", input.siteId)
      .select()
      .single()

    if (updateError) return { error: updateError.message }

    revalidatePath("/visits")
    revalidatePath("/reservations")
    return { data: updated as Reservation }
  } catch (e: any) {
    return { error: e.message }
  }
}
