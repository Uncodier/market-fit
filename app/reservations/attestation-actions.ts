"use server"

import { createClient } from "@/lib/supabase/server"
import { visitAttestationStoragePath } from "@/app/visits/visit-helpers"

export async function getReservationAttestationSignedUrl(
  siteId: string,
  reservationId: string,
  kind: "signature" | "photo" | "id"
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not logged in" }

    const { data: membership } = await supabase
      .from("site_members")
      .select("status")
      .eq("site_id", siteId)
      .eq("user_id", user.id)
      .maybeSingle()

    const { data: site } = await supabase.from("sites").select("user_id").eq("id", siteId).maybeSingle()
    const isOwner = site?.user_id === user.id
    if ((!membership || membership.status !== "active") && !isOwner) {
      return { error: "Not authorized" }
    }

    const { data: reservation, error } = await supabase
      .from("reservations")
      .select("id, site_id, signature_url, photo_url, id_url")
      .eq("id", reservationId)
      .eq("site_id", siteId)
      .maybeSingle()

    if (error || !reservation) return { error: error?.message || "Reservation not found" }

    const raw =
      kind === "signature"
        ? reservation.signature_url
        : kind === "photo"
          ? reservation.photo_url
          : reservation.id_url
    const path = visitAttestationStoragePath(raw)
    if (!path) return { error: "Attestation file not found" }

    const { data: signed, error: signError } = await supabase.storage
      .from("visit-attestations")
      .createSignedUrl(path, 60 * 10)

    if (signError || !signed?.signedUrl) {
      return { error: signError?.message || "Could not create signed URL" }
    }

    return { url: signed.signedUrl }
  } catch (e: any) {
    return { error: e.message }
  }
}
